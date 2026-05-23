/**
 * Phase C — rate limit 자동 폴백.
 *
 * 호출 시점에 role 적합 공급사로 시도 → quota(429) 실패면 같은 role의
 * 다른 사용 가능 공급사로 1회 재시도. 무한 루프 방지를 위해 provider 당 1회.
 *
 * 폴백 조건:
 *   - AiCallError && kind === 'quota' 만 폴백 대상.
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

import { AiCallError } from './errors';
import {
  listAvailableProviders,
  pickProvider,
  type AiProvider,
  type AiTaskRole,
} from './providers';

type ProviderCall<T> = (provider: AiProvider, apiKey: string) => Promise<T>;

export interface RunWithFallbackOptions {
  /**
   * 폴백이 발생할 때마다 호출 (from quota 실패 → to 재시도 시작 직전).
   * UI 알림에 활용. 예외를 던지지 말 것 — 호출 흐름과 분리된 사이드이펙트만.
   */
  onFallback?: (from: AiProvider, to: AiProvider) => void;
}

export async function runWithFallback<T>(
  role: AiTaskRole,
  keys: Partial<Record<AiProvider, string>>,
  call: ProviderCall<T>,
  opts: RunWithFallbackOptions = {},
): Promise<T> {
  const tried = new Set<AiProvider>();
  let lastErr: unknown;

  const available = listAvailableProviders(keys);
  if (available.length === 0) {
    throw new Error('사용 가능한 API 키가 없습니다. /settings 에서 등록하세요.');
  }

  let provider = pickProvider(role, available);
  while (provider && !tried.has(provider)) {
    tried.add(provider);
    const apiKey = keys[provider];
    if (!apiKey) break;

    try {
      return await call(provider, apiKey);
    } catch (err) {
      lastErr = err;
      // quota 외 에러는 즉시 throw — 다른 공급사로 갈아탈 이유 없음
      if (!(err instanceof AiCallError) || err.kind !== 'quota') {
        throw err;
      }
      // 시도 안 한 다음 후보 선택
      const remaining = available.filter((p) => !tried.has(p));
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
