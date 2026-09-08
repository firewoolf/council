/**
 * Phase C — rate limit 자동 폴백.
 *
 * 호출 시점에 role 적합 공급사로 시도 → quota(429) 실패면 같은 role의
 * 다른 사용 가능 공급사로 1회 재시도. 무한 루프 방지를 위해 provider 당 1회.
 *
 * 폴백 조건:
 *   - AiCallError && isRetryable(kind) (quota 또는 overloaded) 만 폴백 대상.
 *   - 그 외 에러(invalid_key/network/unknown) 는 즉시 throw — 폴백 의미 없음.
 *
 * 모든 후보 소진 시 마지막 에러를 그대로 throw — 호출자가 showAiError 등으로
 * 사용자에게 안내.
 *
 * 사용:
 *   const result = await runWithFallback('debate', keys, (provider, apiKey) =>
 *     generateSpeech({ provider, apiKey, system, prompt }),
 *   );
 */

import { AiCallError, isRetryable } from './errors';
import { currentMode } from './access';
import {
  PROVIDERS,
  listAvailableProviders,
  pickProvider,
  type AiProvider,
  type AiTaskRole,
} from './providers';
import { useUsageStore } from '@/store/usage';

type ProviderCall<T> = (provider: AiProvider, apiKey: string) => Promise<T>;

export interface RunWithFallbackOptions {
  /**
   * 폴백이 발생할 때마다 호출 (from quota 실패 → to 재시도 시작 직전).
   * UI 알림에 활용. 예외를 던지지 말 것 — 호출 흐름과 분리된 사이드이펙트만.
   */
  onFallback?: (from: AiProvider, to: AiProvider) => void;
  /**
   * 트랙 T-3 §D-1 — demo 모드 청크 라운드로빈 결정에 쓰는 세션 식별자.
   * role === 'chunk' 이고 mode === 'demo' 일 때만 쓰인다. 상태 저장 없이
   * hash(sessionId) % 후보수 로 세션 내내 같은 공급사를 고정한다.
   */
  sessionId?: string;
}

/** djb2 — 세션 라운드로빈용 결정적 해시. 암호화 용도 아님. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

/**
 * 트랙 T-3 §D — 'chunk' role 한정, 모드별로 pickProvider 에 넘길 후보 순서를 조정한다.
 * pickProvider 시그니처는 건드리지 않는다 — 첫 매치를 고르므로, 원하는 공급사를
 * 배열 앞으로 옮기는 것만으로 우선순위를 바꿀 수 있다. 나머지 후보는 그대로 남아
 * isRetryable 폴백 경로가 살아있다.
 */
function orderChunkCandidates(
  role: AiTaskRole,
  available: readonly AiProvider[],
  sessionId: string | undefined,
): readonly AiProvider[] {
  if (role !== 'chunk') return available;

  const mode = currentMode();

  if (mode === 'paid') {
    if (!available.includes('gemini')) return available;
    return ['gemini', ...available.filter((p) => p !== 'gemini')];
  }

  if (mode === 'demo' && sessionId) {
    // chunk 를 처리할 수 있는 후보만 순환 대상 — roles 명시 없으면 범용(예: openrouter).
    const candidates = available.filter((p) => {
      const roles = PROVIDERS[p].roles;
      return !roles || roles.includes('chunk');
    });
    if (candidates.length === 0) return available;
    const chosen = candidates[hashString(sessionId) % candidates.length]!;
    return [chosen, ...available.filter((p) => p !== chosen)];
  }

  // byok — 현행 그대로.
  return available;
}

/**
 * 호출 결과 + 실제 성공한 공급사.
 * 호출자가 Session.aiProvider 메타데이터를 동기화할 수 있게 (D-1).
 */
export interface RunWithFallbackResult<T> {
  result: T;
  usedProvider: AiProvider;
}

export async function runWithFallback<T>(
  role: AiTaskRole,
  keys: Partial<Record<AiProvider, string>>,
  call: ProviderCall<T>,
  opts: RunWithFallbackOptions = {},
): Promise<RunWithFallbackResult<T>> {
  const tried = new Set<AiProvider>();
  let lastErr: unknown;

  const available = listAvailableProviders(keys);
  if (available.length === 0) {
    throw new Error('사용 가능한 API 키가 없습니다. /settings 에서 등록하세요.');
  }
  // T-3 §D — chunk role 은 접속 모드(paid=Gemini 고정 / demo=세션 해시 라운드로빈)에
  // 맞게 후보 순서만 조정한다. byok 는 원본 순서 그대로.
  const ordered = orderChunkCandidates(role, available, opts.sessionId);

  let provider = pickProvider(role, ordered);
  while (provider && !tried.has(provider)) {
    tried.add(provider);
    const apiKey = keys[provider];
    if (!apiKey) break;

    try {
      const result = await call(provider, apiKey);
      // 전체 사용량 집계 — 모든 AI 호출의 단일 성공 지점.
      try {
        useUsageStore.getState().bump(provider);
      } catch {
        // 집계 실패는 메인 흐름을 끊지 않는다.
      }
      return { result, usedProvider: provider };
    } catch (err) {
      lastErr = err;
      // quota/overloaded 외 에러는 즉시 throw — 다른 공급사로 갈아탈 이유 없음
      if (!(err instanceof AiCallError) || !isRetryable(err.kind)) {
        throw err;
      }
      // 시도 안 한 다음 후보 선택
      const remaining = ordered.filter((p) => !tried.has(p));
      const nextProvider = pickProvider(role, remaining);
      if (nextProvider && provider) {
        try {
          opts.onFallback?.(provider, nextProvider);
        } catch {
          // 사용자 콜백 실패는 메인 흐름을 끊지 않는다 (best-effort 알림).
        }
      }
      provider = nextProvider;
    }
  }

  // 모든 후보 소진 → 마지막 에러 throw (보통 마지막으로 만난 quota 에러)
  if (lastErr) throw lastErr;
  throw new Error('사용 가능한 공급사가 없습니다.');
}
