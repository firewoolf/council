/**
 * AI 호출 에러 표준화.
 *
 * 모든 lib/ai/client.ts 함수는 실패 시 AiCallError 를 throw 한다.
 * 호출자(UI)는 kind + provider 만 보고 분기하면 된다.
 *
 * - 'invalid_key'  : 키 자체가 무효. 키 다시 발급/입력 안내.
 * - 'quota'        : 키는 OK, 호출 한도 초과. 잠시 후 재시도 or 다른 공급사로.
 * - 'network'      : 인터넷 연결 / CORS 문제.
 * - 'unknown'      : 분류 실패. 원본 메시지 그대로 노출.
 */

import { PROVIDERS, type AiProvider } from './providers';

export type AiErrorKind = 'invalid_key' | 'quota' | 'network' | 'unknown';

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

  if (/api[_ ]?key|invalid|unauthor|401|403/i.test(raw)) {
    return new AiCallError(
      'invalid_key',
      provider,
      `${providerName} API 키가 유효하지 않습니다. 다시 확인해주세요.`,
      raw,
    );
  }
  if (/quota|rate|limit|429|exceed/i.test(raw)) {
    return new AiCallError(
      'quota',
      provider,
      `${providerName} 호출 한도를 초과했습니다.`,
      raw,
    );
  }
  if (/network|fetch|cors|timeout/i.test(raw)) {
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
