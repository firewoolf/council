/**
 * 페르소나 추천 프롬프트.
 *
 * Phase B-1: recommendationSchema / buildRecommenderPrompt — 아키타입 id 열거형 기반.
 * Phase B-2: panelDesignSchema / buildPanelDesignPrompt — 느슨한 스키마, generated 지원.
 *   모든 업무 규칙 검증은 sanitizePanel(lib/persona-safety.ts) 이 전담한다.
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
        stance: z
          .string()
          .min(5)
          .describe(
            '이 페르소나가 이 고민에 대해 취하는 입장 — 한 줄, 분명하게. ' +
              '"비판적이다" 같은 성향 말고 "X를 하지 말라고 주장한다" 식 구체적 입장.',
          ),
        reason: z.string().describe('왜 이 페르소나가 지금 필요한지 한 줄 (50자 이내)'),
      }),
    )
    .length(3)
    .describe(
      '정확히 3명 추천. 입장은 반드시 갈려야 한다 — ' +
        '추진/찬성 1명, 반대/제동 1명, 전제를 의심하는 제3의 각도 1명.',
    ),
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

// ─── Phase B-2: panelDesignSchema ────────────────────────────────────────────

/**
 * 느슨한 패널 설계 스키마.
 * enum·min 제약을 제거해 자유 모델의 generateObject 검증 실패를 최소화한다.
 * 모든 업무 규칙(source/temperament 정규화, 패널 크기, archetypeId 검증)은
 * sanitizePanel 이 전담한다.
 */
const panelMemberSchema = z.object({
  source: z
    .string()
    .describe("'archetype' 또는 'generated'"),
  archetypeId: z
    .string()
    .nullable()
    .optional()
    .describe('source=archetype 이면 PERSONAS 의 id, 아니면 null'),
  name: z.string().optional(),
  role: z.string().optional().describe('한 줄 역할/도메인'),
  trait: z
    .object({
      stanceAxis: z.string().describe("'advocate' / 'critic' / 'agnostic'"),
      lens: z.string().describe("'analyst' / 'empath' / 'pragmatist'"),
      expression: z.string().describe("'provocateur' / 'measured'"),
    })
    .describe('3축 trait — stanceAxis × lens × expression'),
  stance: z
    .string()
    .describe(
      '이 고민에 대한 입장 — 한 줄, 분명하게. ' +
        '"비판적이다" 같은 성향 말고 "X를 하지 말라고 주장한다" 식 구체적 주장.',
    ),
  reason: z.string().optional().describe('왜 이 사람이 이 패널에 필요한가 (50자 이내)'),
});

export const panelDesignSchema = z.object({
  detectedDomain: z.string().nullable().optional(),
  panel: z
    .array(panelMemberSchema)
    .max(8)
    .describe('3~4명 권장 — 개수·내용 검증은 sanitizePanel 이 전담.'),
});

export type PanelDesign = z.infer<typeof panelDesignSchema>;

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

[입장(stance) 배정 원칙 — 이 추천의 핵심]
6. 각 페르소나에게 이 고민에 대한 구체적 입장을 배정한다.
7. 3명의 입장은 반드시 갈려야 한다:
   - 한 명은 추진/찬성 ("___ 를 지금 해야 한다")
   - 한 명은 반대/제동 ("___ 는 지금 하면 안 된다, ___ 가 먼저다")
   - 한 명은 전제를 의심하는 제3의 각도 ("애초에 ___ 라는 질문 자체가 틀렸다 / ___ 가 진짜 문제다")
8. 입장은 "성향"이 아니라 "이 고민에서의 주장"이다.
   ✗ "비판적 관점에서 보는 사람"
   ✓ "이 시점에 기능 추가하지 말고 핵심 가설부터 검증하라고 주장한다"
9. 추천 사유(reason)는 "왜 이 사람이 필요한가" (50자), stance 는 "이 사람이 무엇을 주장하는가" (구체적 한 줄).

[고민에서 도메인 추출]
- 명확한 업계가 있으면 detectedDomain 에 한 단어로 (예: "여행앱", "핀테크", "SaaS")
- 없으면 null

[출력]
스키마에 정의된 JSON 구조로만 응답.`;
}

// ─── Phase B-2: buildPanelDesignPrompt ───────────────────────────────────────

const ARCHETYPE_CATALOG = PERSONAS.map(
  (p) =>
    `- id:"${p.id}" 이름:"${p.name}" 역할:${p.role} 핵심가치:${p.coreValue} 입장:${p.trait.stanceAxis} 관점:${p.trait.lens} 표현:${p.trait.expression}`,
).join('\n');

export function buildPanelDesignPrompt(concern: string): string {
  return `당신은 전문가 패널을 설계하는 큐레이터입니다.

[사용 가능한 아키타입 목록]
${ARCHETYPE_CATALOG}

[사용자의 고민]
${concern}

[패널 설계 원칙]
1. 3~4명으로 패널을 구성한다 (사회자 제외 — 자동으로 추가됨).
2. 의견이 반드시 갈려야 한다:
   - 추진/찬성 1명: "___ 를 지금 해야 한다" 형태의 입장
   - 반대/제동 1명: "___ 는 하면 안 된다, ___ 가 먼저다" 형태의 입장
   - 전제를 의심하는 제3의 각도 1명: "애초에 질문 자체가 틀렸다" 형태의 입장
3. 아키타입이 잘 맞으면 source:"archetype" 으로, archetypeId 에 해당 id 를 넣는다.
4. 고민의 분야(교육·군·의료·수의·법·농업 등)가 아키타입 목록으로 안 잡히면
   source:"generated" 으로 그 분야 전문가를 즉석 설계한다.
   - name: 한국어 이름 (예: "베테랑 수의사", "군 창업 전문가")
   - role: 한 줄 역할/도메인
5. 각 멤버에게 trait 3축을 배정한다:
   - stanceAxis: 이 고민에서의 입장 축 — advocate(추진) / critic(제동) / agnostic(전제의심)
   - lens: 사고 방식 축 — analyst(데이터/논리) / empath(사람/감정) / pragmatist(현실/관행)
   - expression: 발언 방식 — provocateur(직설적) / measured(구조적)
6. 입장(stance)은 "성향"이 아니라 "이 고민에서의 구체적 주장"이다.
   ✗ "비판적 관점에서 보는 사람"
   ✓ "동물병원 SaaS는 원장 1인 체제 특성상 6개월 안에 시스템을 바꾸지 않는다. 지금 당장 파일럿 계약 없이 개발부터 하지 말라"
7. reason 은 "왜 이 사람이 이 패널에 필요한가" (50자 이내).

[출력]
스키마에 정의된 JSON 구조로만 응답.`;
}
