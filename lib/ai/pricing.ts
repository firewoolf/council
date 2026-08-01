import { PROVIDERS, type AiProvider } from './providers';
import type { UsageBucket } from '@/store/usage';

export interface ModelPrice {
  /** USD per 1M input tokens. null = 단가 미확인. */
  inPerM: number | null;
  /** USD per 1M output tokens. null = 단가 미확인. */
  outPerM: number | null;
  /** 캐시 적중 입력 단가. null = 미지원/미확인. */
  cachedInPerM?: number | null;
  /** 단가 확인 출처·일자 — 갱신 추적용 */
  source: string;
}

export const USD_TO_KRW = 1400;

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'gemini-2.5-flash-lite': {
    inPerM: 0.1,
    outPerM: 0.4,
    cachedInPerM: 0.01,
    source: 'Google AI pricing, 2026-08-01 확인',
  },
  'llama-3.3-70b-versatile': {
    inPerM: 0.59,
    outPerM: 0.79,
    cachedInPerM: null,
    source: 'Groq pricing, 2026-08-01 확인',
  },
  'claude-sonnet-4-6': {
    inPerM: 3,
    outPerM: 15,
    cachedInPerM: null,
    source: 'Anthropic pricing, 2026-08-01 확인',
  },
  'openrouter/free': {
    inPerM: 0,
    outPerM: 0,
    cachedInPerM: null,
    source: 'OpenRouter pricing, 2026-08-01 확인',
  },
  'gpt-oss-120b': {
    inPerM: null,
    outPerM: null,
    cachedInPerM: null,
    source: '단가 미확인, 2026-08-01',
  },
};

export function estimateCostUsd(
  provider: AiProvider,
  bucket: UsageBucket,
): number | null {
  const price = MODEL_PRICES[PROVIDERS[provider].modelId];
  if (!price || price.inPerM === null || price.outPerM === null) return null;

  const cachedTokens = Math.min(bucket.inTok, bucket.cachedTok);
  if (cachedTokens > 0 && price.cachedInPerM == null) return null;
  const regularInput = bucket.inTok - cachedTokens;
  return (
    regularInput * price.inPerM +
    cachedTokens * (price.cachedInPerM ?? price.inPerM) +
    bucket.outTok * price.outPerM
  ) / 1_000_000;
}
