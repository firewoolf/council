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
import { generateObject, streamObject } from 'ai';
import { z } from 'zod';

import {
  buildRecommenderPrompt,
  recommendationSchema,
  type Recommendation,
  buildPanelDesignPrompt,
  panelDesignSchema,
  type PanelDesign,
} from '@/lib/prompts/recommender';
import {
  buildConclusionPrompt,
  buildChunkPrompt,
  CHUNK_SYSTEM_PROMPT,
  conclusionSchema,
  type Conclusion,
} from '@/lib/prompts/orchestrator';
import type { Message } from '@/types/debate';
import type { CastMember } from '@/types/persona';
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
 * 트랙 ⑤-1 — 청크 스키마 (부록 A 박제).
 *
 * 한 호출 = 3~5턴 미니 장면 + 2~4개 nextTopics.
 * isBlindSpot 의 "정확히 1개" 제약은 zod 로 강제할 수 없어
 * sanitizeChunk 가 런타임에 보정한다.
 */
const chunkTurnSchema = z.object({
  speakerName: z.string().describe('패널 명단의 이름과 정확히 일치'),
  message: z
    .string()
    .max(300)
    .describe('발언 본문 — 한국어 200자 이내. 원론·양비론 금지, 구체적인 한 방.'),
  replyToIndex: z
    .number()
    .int()
    .nullable()
    .describe('이 청크 안에서 앞선 turn 인덱스(0부터)에 반박할 때만. 새 논점이면 null'),
  isKeyPoint: z
    .boolean()
    .describe('이 청크에서 가장 날카로운 1~2개 라인이면 true, 아니면 false'),
});

const nextTopicSchema = z.object({
  label: z
    .string()
    .describe(
      '다음에 파고들 소주제 — 짧은 제목(15자 내외). ' +
        '*못 본 각도* 후보는 label 맨 앞에 "✦ " 마커를 박제.',
    ),
  hook: z
    .string()
    .describe('왜 지금 이걸 파야 하는지 한 줄 — 방금 장면의 충돌을 가리키며'),
  isBlindSpot: z
    .boolean()
    .describe(
      '*못 본 각도* 후보면 true. nextTopics 배열에 정확히 1개만 true 여야 한다 — ' +
        '패널 발언에서 함의되었지만 명시되지 않은 결론, 또는 사용자 고민이 깔고 있던 ' +
        '전제 자체에 의문을 던지는 각도. 부록 D 끝 섹션 참조.',
    ),
});

export const chunkSchema = z.object({
  turns: z.array(chunkTurnSchema).min(3).max(5),
  nextTopics: z.array(nextTopicSchema).min(2).max(4),
});

export type Chunk = z.infer<typeof chunkSchema>;
/** 트랙 ⑤-6 — 청크 1턴. streamChunk.onTurn 의 계약 타입. */
export type ChunkTurn = z.infer<typeof chunkTurnSchema>;

/**
 * 트랙 ⑤-1 — LLM 응답 정규화.
 *
 * "nextTopics 에 isBlindSpot:true 정확히 1개" 제약은 zod 로 못 박는다 —
 * 모델이 자연어로 따라줘야 하는 규칙. 어긋나면 여기서 보정한다.
 *
 * 보정 정책 (sanitizePanel 패턴 — 깨지 말고 살린다):
 *   1) true 가 0개 → "✦ " 마커가 있는 후보 1개를 true 로 (없으면 마지막을 true).
 *   2) true 가 2개 이상 → 첫 번째만 남기고 나머지를 false.
 *   3) label 의 "✦ " 마커는 isBlindSpot 의 시각적 박제다. true 인데 마커 없으면
 *      마커를 앞에 붙여준다. false 인데 마커 있으면 그대로 둔다 (모델 의도 존중).
 */
export function sanitizeChunk(raw: Chunk): { chunk: Chunk; notes: string[] } {
  const notes: string[] = [];

  // nextTopics 보정 — 깊은 복사 후 작업
  const nextTopics = raw.nextTopics.map((t) => ({ ...t }));

  const blindSpotIdx: number[] = [];
  for (let i = 0; i < nextTopics.length; i++) {
    const t = nextTopics[i];
    if (t && t.isBlindSpot === true) blindSpotIdx.push(i);
  }

  if (blindSpotIdx.length === 0 && nextTopics.length > 0) {
    const markerIdx = nextTopics.findIndex((t) => t.label.trimStart().startsWith('✦'));
    const chosen = markerIdx >= 0 ? markerIdx : nextTopics.length - 1;
    const target = nextTopics[chosen];
    if (target) {
      target.isBlindSpot = true;
      notes.push(
        `isBlindSpot 0개 → 인덱스 ${chosen} (${target.label}) 를 true 로 보정`,
      );
    }
  } else if (blindSpotIdx.length > 1) {
    const keep = blindSpotIdx[0]!;
    for (const i of blindSpotIdx.slice(1)) {
      const t = nextTopics[i];
      if (t) t.isBlindSpot = false;
    }
    notes.push(
      `isBlindSpot ${blindSpotIdx.length}개 → 인덱스 ${keep} 만 남기고 나머지 false 로 보정`,
    );
  }

  // 마커 박제: true 인데 label 에 "✦ " 가 없으면 붙인다.
  for (const t of nextTopics) {
    if (t.isBlindSpot && !t.label.trimStart().startsWith('✦')) {
      t.label = `✦ ${t.label.trimStart()}`;
      notes.push(`isBlindSpot true 인 label 에 "✦ " 마커 박제`);
    }
  }

  // turns 의 replyToIndex 무결성 — 자기 자신 이후를 가리키면 null 로.
  const turns = raw.turns.map((t, i) => {
    const r = t.replyToIndex;
    if (r !== null && (r < 0 || r >= i)) {
      notes.push(`turn ${i}.replyToIndex=${r} 무효 → null 로 보정`);
      return { ...t, replyToIndex: null };
    }
    return { ...t };
  });

  return { chunk: { turns, nextTopics }, notes };
}

/**
 * 트랙 ⑤-1 — 청크 생성 호출.
 *
 * generateObject 1회로 미니 장면 1개 (3~5턴) + 갈림길 (2~4개) 동시 생성.
 * 발언 순서·반박 연결은 청크 프롬프트 안에서 모델이 연출한다.
 */
export async function generateChunk(args: {
  provider: AiProvider;
  apiKey: string;
  concern: string;
  panel: { name: string; role: string; stance: string; voiceCard: string }[];
  topic: string;
  transcript: string;
  isFirst: boolean;
}): Promise<Chunk> {
  try {
    const model = getModel(args.provider, args.apiKey);
    const { object } = await generateObject({
      model,
      schema: chunkSchema,
      system: CHUNK_SYSTEM_PROMPT,
      prompt: buildChunkPrompt({
        concern: args.concern,
        panel: args.panel,
        topic: args.topic,
        transcript: args.transcript,
        isFirst: args.isFirst,
      }),
      temperature: TEMPERATURE.speech,
      maxRetries: 1,
      // ⑤-1f-A 속도 개선: 청크 한 단위는 ~3턴×200자 + nextTopics 4×100자 ≈ 1000 토큰.
      // 모델이 *불필요하게 길게* 생성하는 시간을 차단. 안전 마진 포함 1500.
      maxTokens: 1500,
    });
    const { chunk } = sanitizeChunk(object);
    return chunk;
  } catch (err) {
    throw classifyAiError(args.provider, err);
  }
}

/**
 * 트랙 ⑤-6 (R-2) — 스트림 청크 부분 turn 정규화.
 *
 * partialObjectStream 의 turn 은 모든 필드가 optional(DeepPartial)이다.
 * 확정 콜백에 넘기기 전 ChunkTurn 형태로 채운다.
 * replyToIndex 는 자기 인덱스 이전만 유효 — 그 외는 null (부록 A 가드).
 */
function normalizeStreamTurn(
  t: {
    speakerName?: string;
    message?: string;
    replyToIndex?: number | null;
    isKeyPoint?: boolean;
  },
  index: number,
): ChunkTurn {
  const r = t.replyToIndex;
  const replyToIndex =
    typeof r === 'number' && r >= 0 && r < index ? r : null;
  return {
    speakerName: t.speakerName ?? '',
    message: t.message ?? '',
    replyToIndex,
    isKeyPoint: t.isKeyPoint ?? false,
  };
}

/**
 * 트랙 ⑤-6 (R-2) — 스트리밍 청크 생성.
 *
 * streamObject 의 partialObjectStream 으로 턴이 *확정되는 즉시* onTurn 콜백한다.
 * turns[i+1] 의 존재 = turns[i] 확정 (더 이상 자라지 않음). 마지막 턴은 스트림
 * 종료 시 최종 객체(zod 검증 통과본)에서 확정된다.
 *
 * 계약:
 *   - onTurn(turn, index) 는 index 오름차순, 중복 없음.
 *   - 반환값은 sanitizeChunk 통과본 (generateChunk 와 동일 형태).
 *   - maxRetries: 0 — 재시도는 runWithFallback 의 공급사 전환이 담당(이중 금지).
 *   - 전체 60초 타임아웃 + 외부 signal 합성.
 */
export async function streamChunk(args: {
  provider: AiProvider;
  apiKey: string;
  concern: string;
  panel: { name: string; role: string; stance: string; voiceCard: string }[];
  topic: string;
  transcript: string;
  isFirst: boolean;
  signal?: AbortSignal;
  /** 턴이 확정될 때마다 — sanitize 전 raw turn (index 순서 보장) */
  onTurn: (turn: ChunkTurn, index: number) => void;
}): Promise<Chunk> {
  try {
    const model = getModel(args.provider, args.apiKey);
    const timeout = AbortSignal.timeout(60_000);
    const abortSignal = args.signal
      ? AbortSignal.any([args.signal, timeout])
      : timeout;

    const result = streamObject({
      model,
      schema: chunkSchema,
      system: CHUNK_SYSTEM_PROMPT,
      prompt: buildChunkPrompt({
        concern: args.concern,
        panel: args.panel,
        topic: args.topic,
        transcript: args.transcript,
        isFirst: args.isFirst,
      }),
      temperature: TEMPERATURE.speech,
      maxRetries: 0,
      abortSignal,
    });

    let confirmed = 0;
    for await (const partial of result.partialObjectStream) {
      const turns = partial.turns;
      if (!Array.isArray(turns)) continue;
      // turns[i+1] 의 존재 = turns[i] 확정. 순차 커서 — 인덱스 점프 금지(부록 A).
      while (confirmed < turns.length - 1) {
        const t = turns[confirmed];
        if (
          !t ||
          typeof t.speakerName !== 'string' ||
          typeof t.message !== 'string' ||
          t.message.length === 0
        ) {
          // 불완전 턴 — 커서를 전진시키지 않고 다음 partial 을 기다린다.
          // (전진시키면 이 인덱스가 표시·저장 양쪽에서 영구 유실 — 검수 픽스 2026-06-10)
          // 영구 불완전(빈 message 등)이면 스트림 종료 후 아래 복구 루프가
          // confirmed 부터 순서대로 일괄 확정한다 — 유실·역순 없음.
          break;
        }
        args.onTurn(normalizeStreamTurn(t, confirmed), confirmed);
        confirmed++;
      }
    }

    const final = await result.object; // zod 최종 검증 — 실패 시 throw → 폴백
    const { chunk } = sanitizeChunk(final);
    // 마지막 턴 + (스트림 중 미확정으로 남은 턴) 확정 콜백.
    for (let i = confirmed; i < chunk.turns.length; i++) {
      args.onTurn(chunk.turns[i]!, i);
    }
    return chunk;
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
 * 패널 설계 호출 (Phase B-2).
 * recommendPersonas 대체 — generated 멤버 지원, 느슨한 스키마.
 * 결과는 sanitizePanel 에 통과시켜야 CastMember[] 가 된다.
 */
export async function designPanel(args: {
  provider: AiProvider;
  apiKey: string;
  concern: string;
}): Promise<PanelDesign> {
  try {
    const model = getModel(args.provider, args.apiKey);
    const { object } = await generateObject({
      model,
      schema: panelDesignSchema,
      prompt: buildPanelDesignPrompt(args.concern),
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
  cast: readonly CastMember[];
}): Promise<Conclusion> {
  try {
    const model = getModel(args.provider, args.apiKey);
    const { object } = await generateObject({
      model,
      schema: conclusionSchema,
      prompt: buildConclusionPrompt(args.concern, args.messages, args.cast),
      temperature: TEMPERATURE.conclusion,
      maxRetries: 1,
    });
    return object;
  } catch (err) {
    throw classifyAiError(args.provider, err);
  }
}
