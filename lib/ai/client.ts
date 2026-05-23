/**
 * 브라우저 직접 호출 AI 클라이언트 — BYOK 핵심 경로.
 *
 * 이 파일은 클라이언트 사이드에서만 import되어야 한다.
 * AI SDK + 사용자 키로 직접 LLM에 호출 → 서버 비용 $0.
 *
 * Anthropic은 CORS 불가라 여기 포함하지 않음. (서버용은 lib/ai/server.ts)
 *
 * 모든 함수는 실패 시 AiCallError 를 throw 한다.
 * UI는 err.kind + err.provider 만 보고 적절히 분기하면 된다.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createCerebras } from '@ai-sdk/cerebras';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';

import {
  buildRecommenderPrompt,
  recommendationSchema,
  type Recommendation,
} from '@/lib/prompts/recommender';
import {
  buildConclusionPrompt,
  conclusionSchema,
  type Conclusion,
} from '@/lib/prompts/orchestrator';
import type { Message } from '@/types/debate';
import type { Persona } from '@/types/persona';
import { PROVIDERS, type AiProvider } from './providers';
import { AiCallError, classifyAiError } from './errors';

/**
 * 공급사 + 키 → AI SDK 모델 인스턴스 생성.
 * 호출 시점마다 새로 만든다 (키가 바뀔 수 있음).
 */
function getModel(provider: AiProvider, apiKey: string) {
  const config = PROVIDERS[provider];
  switch (provider) {
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey })(config.modelId);
    case 'groq':
      return createGroq({ apiKey })(config.modelId);
    case 'openrouter':
      // HTTP-Referer / X-Title 은 OpenRouter 가 어떤 앱에서 호출됐는지
      // 식별/통계용으로 권장하는 헤더. 누락해도 동작은 하지만 적어두는 게 매너.
      return createOpenRouter({
        apiKey,
        headers: {
          'HTTP-Referer': 'https://council.app',
          'X-Title': 'COUNCIL',
        },
      })(config.modelId);
    case 'cerebras':
      return createCerebras({ apiKey })(config.modelId);
    case 'claude':
      // 브라우저에서는 호출 불가. 호출 시도 자체가 잘못된 경로.
      throw new AiCallError(
        'unknown',
        provider,
        'Claude는 브라우저에서 직접 호출할 수 없습니다. 서버 라우트를 사용하세요.',
        'browser-direct-not-supported',
      );
  }
}

/**
 * 키 ping 결과 캐시.
 * - 키 단위로 5초 윈도우 유지 → 짧은 시간 내 반복 테스트가 RPM을 잠식하지 않도록.
 * - 성공만 캐시. 실패는 매번 재시도 (사용자가 키를 바꿔서 재시도하는 경우 보호).
 * - 모듈 메모리에만 존재 → 새로고침 시 초기화.
 */
const PING_TTL_MS = 5_000;
const pingCache = new Map<string, { latencyMs: number; expiresAt: number }>();

function pingCacheKey(provider: AiProvider, apiKey: string) {
  return `${provider}::${apiKey}`;
}

/**
 * 키 유효성 ping.
 * 가장 가벼운 generateObject 호출로 빠르게 검증.
 * 성공: { ok: true, latencyMs } / 실패: AiCallError throw
 */
export async function testApiKey(
  provider: AiProvider,
  apiKey: string,
): Promise<{ ok: true; latencyMs: number; cached: boolean }> {
  const cacheKey = pingCacheKey(provider, apiKey);
  const cached = pingCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, latencyMs: cached.latencyMs, cached: true };
  }

  const start = performance.now();
  try {
    const model = getModel(provider, apiKey);
    await generateObject({
      model,
      schema: z.object({ ok: z.boolean() }),
      prompt:
        '시스템 연결 테스트입니다. {"ok": true} JSON 객체 하나만 반환하세요.',
      maxRetries: 0,
    });
    const latencyMs = Math.round(performance.now() - start);
    pingCache.set(cacheKey, {
      latencyMs,
      expiresAt: Date.now() + PING_TTL_MS,
    });
    return { ok: true, latencyMs, cached: false };
  } catch (err) {
    throw classifyAiError(provider, err);
  }
}

/**
 * 작업별 temperature.
 * 토론 발언은 높게 — 엣지·통찰은 덜 안전한 샘플링에서 나온다.
 * 추천·결론은 낮게 — 구조화 출력 안정성 우선.
 */
const TEMPERATURE = {
  speech: 0.9,
  recommend: 0.45,
  conclusion: 0.55,
} as const;

/**
 * 토론용 단일 발언 생성 schema.
 * generateObject 1회 호출에 발언자 + 내용 통합 (RPM 절약).
 *
 * max는 300 — 프롬프트는 "200자 이내"를 요구하지만, 약간 초과한 응답이
 * 스키마 검증에서 곧장 실패하지 않도록 헤드룸을 둔다.
 */
export const speechSchema = z.object({
  speakerName: z.string().describe('당신의 페르소나 이름. 정확히 그대로'),
  replyToId: z
    .string()
    .nullable()
    .describe('직전 다른 페르소나에게 반박할 때만 그 메시지 id. 없으면 null'),
  message: z
    .string()
    .max(300)
    .describe('발언 본문 — 한국어 200자 이내. 원론·양비론 금지, 구체적인 한 방.'),
  isQuestion: z.boolean().describe('사용자에게 직접 질문을 던졌으면 true'),
});

export type SpeechObject = z.infer<typeof speechSchema>;

/**
 * 페르소나 한 명의 다음 발언 생성.
 */
export async function generateSpeech(args: {
  provider: AiProvider;
  apiKey: string;
  system: string;
  prompt: string;
}): Promise<SpeechObject> {
  try {
    const model = getModel(args.provider, args.apiKey);
    const { object } = await generateObject({
      model,
      schema: speechSchema,
      system: args.system,
      prompt: args.prompt,
      temperature: TEMPERATURE.speech,
      maxRetries: 1,
    });
    return object;
  } catch (err) {
    throw classifyAiError(args.provider, err);
  }
}

/**
 * 페르소나 추천 호출.
 * 사용자 고민 텍스트 → 3명 추천 + 도메인 추출.
 */
export async function recommendPersonas(args: {
  provider: AiProvider;
  apiKey: string;
  concern: string;
}): Promise<Recommendation> {
  try {
    const model = getModel(args.provider, args.apiKey);
    const { object } = await generateObject({
      model,
      schema: recommendationSchema,
      prompt: buildRecommenderPrompt(args.concern),
      temperature: TEMPERATURE.recommend,
      maxRetries: 1,
    });
    return object;
  } catch (err) {
    throw classifyAiError(args.provider, err);
  }
}

/**
 * 토론 종료 시 결론 생성.
 */
export async function generateConclusion(args: {
  provider: AiProvider;
  apiKey: string;
  concern: string;
  messages: readonly Message[];
  personaMap: Record<string, Persona>;
}): Promise<Conclusion> {
  try {
    const model = getModel(args.provider, args.apiKey);
    const { object } = await generateObject({
      model,
      schema: conclusionSchema,
      prompt: buildConclusionPrompt(args.concern, args.messages, args.personaMap),
      temperature: TEMPERATURE.conclusion,
      maxRetries: 1,
    });
    return object;
  } catch (err) {
    throw classifyAiError(args.provider, err);
  }
}
