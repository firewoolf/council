/**
 * AI 호출 에러 표준화.
 *
 * 모든 lib/ai/client.ts 함수는 실패 시 AiCallError 를 throw 한다.
 * 호출자(UI)는 kind + provider 만 보고 분기하면 된다.
 *
 * - 'overloaded'   : 공급사 일시 과부하. 키·한도와 무관. 다른 공급사로 즉시 전환.
 * - 'invalid_key'  : 키 자체가 무효. 키 다시 발급/입력 안내.
 * - 'quota'        : 키는 OK, 호출 한도 초과. 잠시 후 재시도 or 다른 공급사로.
 * - 'network'      : 인터넷 연결 / CORS 문제.
 * - 'unknown'      : 분류 실패. 원본 메시지 그대로 노출.
 */

import { PROVIDERS, type AiProvider } from './providers';

export type AiErrorKind =
  | 'overloaded'
  | 'invalid_key'
  | 'quota'
  | 'network'
  | 'unknown';

/** quota/overloaded 만 runWithFallback 의 폴백 대상 — network/unknown 은 진짜 결함을 숨기므로 제외. */
export function isRetryable(kind: AiErrorKind): boolean {
  return kind === 'quota' || kind === 'overloaded';
}

export class AiCallError extends Error {
  readonly kind: AiErrorKind;
  readonly provider: AiProvider;
  readonly originalMessage: string;

  constructor(
    kind: AiErrorKind,
    provider: AiProvider,
    message: string,
    originalMessage: string,
  ) {
    super(message);
    this.name = 'AiCallError';
    this.kind = kind;
    this.provider = provider;
    this.originalMessage = originalMessage;
  }
}

/**
 * SDK/네트워크 에러 → AiCallError 정규화.
 * 키워드 매칭 기반 — 공급사가 메시지 포맷을 바꿔도 어느 정도 견디도록 광범위하게.
 */
export function classifyAiError(provider: AiProvider, err: unknown): AiCallError {
  const raw = err instanceof Error ? err.message : String(err);
  const providerName = PROVIDERS[provider].displayName;

  if (/high demand|overload|capacity|\b503\b|temporarily unavailable|try again later|\bbusy\b/i.test(raw)) {
    return new AiCallError(
      'overloaded',
      provider,
      `${providerName} 서버가 혼잡합니다. 다른 공급사로 전환합니다.`,
      raw,
    );
  }
  if (/quota|rate.?limit|\blimit\b|exhaust|\b429\b|exceed|too many requests/i.test(raw)) {
    return new AiCallError(
      'quota',
      provider,
      `${providerName} 호출 한도를 초과했습니다.`,
      raw,
    );
  }
  if (/invalid[ _-]?(api[ _-]?key|token|auth)|api[ _-]?key|unauthor|\b401\b|\b403\b/i.test(raw)) {
    return new AiCallError(
      'invalid_key',
      provider,
      `${providerName} API 키가 유효하지 않습니다. 다시 확인해주세요.`,
      raw,
    );
  }
  if (/network|fetch failed|cors|timeout|ECONN/i.test(raw)) {
    return new AiCallError(
      'network',
      provider,
      '네트워크 오류입니다. 인터넷 연결을 확인하세요.',
      raw,
    );
  }
  return new AiCallError(
    'unknown',
    provider,
    `연결 실패: ${raw}`,
    raw,
  );
}
