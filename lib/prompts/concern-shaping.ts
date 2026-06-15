/**
 * I-1 — AI 가이드 고민 다듬기.
 *
 * 역질문 생성 프롬프트 + concern 합성 유틸리티.
 * buildClarifyPrompt 는 Fable 박제 원문 — 수정 금지.
 */

import { z } from 'zod';

export const clarifyQuestionSchema = z.object({
  key: z.string().describe('슬롯 식별자 (decision/tried/constraint 등 자유)'),
  question: z.string().describe('이 고민에만 들어맞는 역질문'),
  why: z.string().describe('왜 이걸 묻는지 한 줄 — 사용자에게 보여 신뢰 형성'),
  placeholder: z.string().describe('답변 입력 힌트 — 형식을 보여주는 짧은 예시'),
});

export const clarifyQuestionsSchema = z.object({
  questions: z
    .array(clarifyQuestionSchema)
    .min(2)
    .max(3)
    .describe('2~3개. 사용자 한 줄이 충분히 구체적이면 2개, 맥락이 거의 없으면 3개'),
});

export type ClarifyQuestion = z.infer<typeof clarifyQuestionSchema>;
export type ClarifyQuestions = z.infer<typeof clarifyQuestionsSchema>;

/** 부록 A-1 박제 원문. */
export function buildClarifyPrompt(
  rawConcern: string,
  mirror?: string,
): string {
  const mirrorBlock = mirror
    ? `

[거울 — 이 사람의 누적 패턴]
${mirror}
위 패턴을 의식하되 *위로하지 마라*. 역질문 2~3개 중 최소 하나는 이 맹점을 정면으로 건드려라.`
    : '';

  return `당신은 COUNCIL의 사회자입니다. 사용자가 전문가 패널 토론에 들고 온 고민이
아직 한두 줄로 짧습니다. 패널이 *날카롭게* 토론하려면 맥락이 더 필요합니다.

당신의 일은 답을 주는 것이 아니라, *되묻는* 것입니다. 사용자가 아직 말하지
않았지만 결정에 결정적인 것들을 끌어내는 질문 2~3개를 만드세요.

[사용자가 들고 온 한 줄]
${rawConcern}${mirrorBlock}

[질문 설계 규칙]
1. 이 고민에만 들어맞는 질문. "목표가 무엇인가요?" 같은 아무 고민에나 붙는
   질문은 금지. 위 문장에서 *빠진 구체적 정보*를 집어 묻는다.
2. 다음 중 빠진 것을 우선해 묻는다:
   - 진짜 결정 지점 — 사용자가 "A냐 B냐"로 적었지만 실은 C가 진짜 분기일 때.
   - 제약·기한 — 언제까지, 돈·사람·시간의 한계.
   - 이미 시도/관찰한 것 — 어떤 반응, 어떤 데이터를 이미 봤는가.
   - 망설임의 진짜 이유 — 표면 이유 뒤의 두려움·매몰비용.
3. 굴복 금지 톤. "좋은 고민이네요" 같은 추임새 금지. 질문은 정중하되 *찌른다*.
   사용자가 피하고 있던 곳을 정확히 묻는다.
4. 각 질문에 why 한 줄 — "왜 이걸 묻는지". 사용자가 질문의 의도를 알면 더
   정직하게 답한다. why 도 일반론 금지.
5. placeholder — 답변 입력칸에 띄울 힌트. 답변의 *형식*을 보여주는 짧은 예시.

[좋은 예 — raw: "사이드 프로젝트를 유료로 전환할지 고민"]
- question: "지금 무료로 쓰는 사람이 몇 명이고, 그중 돈 낼 것 같은 사람은 몇 명인가요?"
  why: "전환 결정은 '얼마나 많은가'가 아니라 '얼마나 절실한가'에서 갈립니다."
  placeholder: "예) 무료 300명, 그중 '유료여도 쓴다'고 한 사람 5명"
- question: "유료로 바꾼 뒤 무료 사용자가 떠나면, 그게 당신에게 어떤 손해인가요?"
  why: "이탈을 감당할 수 있는지가 전환 시점을 정합니다."
  placeholder: "예) 입소문이 끊긴다 / 별 영향 없다 / 잘 모르겠다"

[나쁜 예 — 일반론이라 금지]
- "비즈니스 목표가 무엇인가요?"   ← 아무 고민에나 붙음
- "리스크는 무엇인가요?"          ← 사용자가 답을 모름, 그게 토론거리
- "예산은 얼마인가요?"            ← 위 문장과 무관할 수 있음

[출력]
스키마의 JSON. 질문 2~3개. 사용자의 한 줄이 이미 충분히 구체적이면 2개,
맥락이 거의 없으면 3개.`;
}

/**
 * raw concern + 역질문 답변 → 합성 concern.
 * LLM 없이 템플릿 결합 — 사용자 원문 보존.
 */
export function composeConcern(
  raw: string,
  answers: { question: string; answer: string }[],
): string {
  const filled = answers.filter((a) => a.answer.trim());
  if (filled.length === 0) return raw.trim();
  const block = filled
    .map((a) => `· ${a.question}\n  → ${a.answer.trim()}`)
    .join('\n');
  return `${raw.trim()}\n\n[다듬기 — 사회자 질문에 대한 답]\n${block}`;
}
