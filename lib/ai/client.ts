/**
 * 브라우저 직접 호출 AI 클라이언트 — BYOK 핵심 경로.
 *
 * 이 파일은 클라이언트 사이드에서만 import되어야 한다.
 * AI SDK + 사용자 키로 직접 LLM에 호출 → 서버 비용 $0.
 *
 * Anthropic은 CORS 불가라 여기 포함하지 않음. (서버용은 lib/ai/server.ts)
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
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
    case 'claude':
      // 브라우저에서는 호출 불가. 호출 시도 자체가 잘못된 경로.
      throw new Error(
        'Claude는 브라우저에서 직접 호출할 수 없습니다. 서버 라우트를 사용하세요.',
      );
  }
}

/**
 * 키 유효성 ping.
 * 가장 가벼운 generateObject 호출로 빠르게 검증.
 * 성공: true / 실패: 에러 메시지 throw.
 */
export async function testApiKey(
  provider: AiProvider,
  apiKey: string,
): Promise<{ ok: true; latencyMs: number }> {
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
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    // 에러 메시지 정규화 — UX에 그대로 노출되므로 친절하게
    const message = err instanceof Error ? err.message : String(err);
    if (/api[_ ]?key|invalid|unauthor|401|403/i.test(message)) {
      throw new Error('API 키가 유효하지 않습니다. 다시 확인해주세요.');
    }
    if (/quota|rate|limit|429/i.test(message)) {
      throw new Error(
        '키는 유효하지만 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.',
      );
    }
    if (/network|fetch|cors/i.test(message)) {
      throw new Error('네트워크 오류입니다. 인터넷 연결을 확인하세요.');
    }
    throw new Error(`연결 실패: ${message}`);
  }
}

/**
 * 토론용 단일 발언 생성 schema.
 * generateObject 1회 호출에 발언자 + 내용 통합 (RPM 절약).
 */
export const speechSchema = z.object({
  speakerName: z.string().describe('당신의 페르소나 이름. 정확히 그대로'),
  replyToId: z
    .string()
    .nullable()
    .describe('직전 다른 페르소나에게 반박할 때만 그 메시지 id. 없으면 null'),
  message: z.string().max(200).describe('발언 본문 — 한국어 150자 이내'),
  isQuestion: z.boolean().describe('사용자에게 직접 질문을 던졌으면 true'),
});

export type SpeechObject = z.infer<typeof speechSchema>;

/**
 * 페르소나 한 명의 다음 발언 생성.
 * - system: 페르소나 시스템 프롬프트 (composePersonaPrompt 결과)
 * - prompt: 토론 컨텍스트 (buildDebateContext 결과)
 */
export async function generateSpeech(args: {
  provider: AiProvider;
  apiKey: string;
  system: string;
  prompt: string;
}): Promise<SpeechObject> {
  const model = getModel(args.provider, args.apiKey);
  const { object } = await generateObject({
    model,
    schema: speechSchema,
    system: args.system,
    prompt: args.prompt,
    maxRetries: 1,
  });
  return object;
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
  const model = getModel(args.provider, args.apiKey);
  const { object } = await generateObject({
    model,
    schema: recommendationSchema,
    prompt: buildRecommenderPrompt(args.concern),
    maxRetries: 1,
  });
  return object;
}

/**
 * 토론 종료 시 결론 생성.
 * 전체 발언 히스토리를 받아서 4섹션 결론 객체 반환.
 */
export async function generateConclusion(args: {
  provider: AiProvider;
  apiKey: string;
  concern: string;
  messages: readonly Message[];
  personaMap: Record<string, Persona>;
}): Promise<Conclusion> {
  const model = getModel(args.provider, args.apiKey);
  const { object } = await generateObject({
    model,
    schema: conclusionSchema,
    prompt: buildConclusionPrompt(args.concern, args.messages, args.personaMap),
    maxRetries: 1,
  });
  return object;
}
