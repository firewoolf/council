/**
 * 페르소나 추천 프롬프트.
 *
 * 사용자의 고민 텍스트를 분석하여 최적의 페르소나 3명을 추천한다.
 * generateObject 로 호출 → 정해진 schema 로 반환.
 */

import { z } from 'zod';

import { PERSONAS } from './personas';

/**
 * 유효 personaId 만 허용하는 enum.
 * LLM 환각 ID 방지용 — JSON schema 단에서 차단.
 * PERSONAS에서 동적 생성하므로 페르소나 추가 시 자동 반영.
 */
const personaIdValues = PERSONAS.map((p) => p.id) as [string, ...string[]];
const personaIdSchema = z.enum(personaIdValues);

/** AI SDK schema — generateObject 의 schema 인자로 사용. */
export const recommendationSchema = z.object({
  recommended: z
    .array(
      z.object({
        personaId: personaIdSchema.describe('PERSONAS에 정의된 id 정확히 일치'),
        reason: z.string().describe('왜 이 페르소나가 지금 필요한지 한 줄 (50자 이내)'),
      }),
    )
    .length(3)
    .describe('정확히 3명 추천. 반드시 비판적 관점 1명 + 도메인 전문가 1명 + 균형 1명'),
  optional: z
    .array(personaIdSchema)
    .max(3)
    .describe('추가로 고려할 페르소나 id 목록 (최대 3개)'),
  detectedDomain: z
    .string()
    .nullable()
    .describe('고민에서 추출한 도메인 (예: "여행앱", "핀테크"). 없으면 null'),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

const PERSONA_CATALOG = PERSONAS.map(
  (p) => `- ${p.id}: ${p.name} — ${p.role} / ${p.coreValue}`,
).join('\n');

export function buildRecommenderPrompt(concern: string): string {
  return `당신은 회의에 참여시킬 전문가 패널을 짜는 큐레이터입니다.

[사용 가능한 페르소나 목록]
${PERSONA_CATALOG}

[사용자의 고민]
${concern}

[추천 원칙]
1. 정확히 3명을 추천한다.
2. 반드시 비판적 관점 1명 포함 (냉정한 투자자, 독설가 개발자, 현실주의자 중)
3. 반드시 도메인 전문가(domain-expert) 1명 포함 — 동적 분야 주입 가능
4. 사용자 고민의 유형(기술/비즈니스/디자인/심리/시장)에 맞는 균형 1명
5. 사회자(facilitator)는 자동으로 추가되므로 추천에서 제외 가능

[고민에서 도메인 추출]
- 명확한 업계가 있으면 detectedDomain 에 한 단어로 (예: "여행앱", "핀테크", "SaaS")
- 없으면 null

[출력]
스키마에 정의된 JSON 구조로만 응답.`;
}
