/**
 * 토론 오케스트레이터.
 *
 * 매 턴 호출 시:
 * 1. 현재까지 발언 히스토리를 받아서
 * 2. 다음에 발언할 페르소나 1명을 결정하고
 * 3. 그 페르소나의 프롬프트로 generateObject 호출 → 발언 생성
 *
 * 이 모듈은 "발언자 선정 + 토론 진행 규칙"만 책임진다.
 * 실제 LLM 호출은 lib/ai/* 에서.
 */

import { z } from 'zod';

import type { Message } from '@/types/debate';
import type { CastMember } from '@/types/persona';
import { PERSONAS } from './personas';

/**
 * 결론 schema — generateObject 출력 강제.
 * 4섹션: 핵심 결론 / 주요 리스크 / 페르소나별 입장 / 추천 액션.
 */
const personaIdValues = PERSONAS.map((p) => p.id) as [string, ...string[]];
export const conclusionSchema = z.object({
  keyConclusion: z
    .string()
    .describe('핵심 결론 — 3문장 이내, 사용자가 가져갈 단 하나의 메시지'),
  risks: z
    .array(z.string())
    .length(3)
    .describe('이 결정을 따를 때 가장 큰 리스크 3가지'),
  personaPositions: z
    .array(
      z.object({
        personaId: z.enum(personaIdValues),
        position: z.string().describe('이 페르소나의 최종 입장 — 한 줄'),
      }),
    )
    .describe('각 참여 페르소나의 최종 입장 (사회자 제외 가능)'),
  recommendedActions: z
    .array(z.string())
    .length(3)
    .describe('지금 당장 / 1주 안 / 1달 안 단위의 구체적 액션 3가지'),
});

export type Conclusion = z.infer<typeof conclusionSchema>;

export interface TurnDecision {
  /** 다음 발언자 — null이면 토론 종료 제안 */
  nextSpeaker: CastMember | null;
  /** 종료 트리거가 발동했는지 */
  shouldConclude: boolean;
  /** 디버그용 사유 */
  reason: string;
}

const MAX_CONSECUTIVE = 2; // 동일 페르소나 3회 연속 발언 금지
const SOFT_LIMIT = 20;     // 사회자가 정리 시작 제안
const HARD_LIMIT = 30;     // 자동 결론 트리거

/**
 * 다음 발언자 결정 로직.
 * 단순 규칙 기반 — LLM 호출 불필요해서 비용 0.
 *
 * 규칙 (CLAUDE.md ❻ 토론 오케스트레이터 규칙):
 * 1. 동일 페르소나 3회 연속 발언 금지 → 직전 2회와 다른 사람
 * 2. 사용자 발언 직후 → 가장 관련 높은 페르소나 (현재는 발언 적은 사람으로 근사)
 * 3. 균등 분배 → 발언 횟수 적은 페르소나 우선
 * 4. SOFT_LIMIT 초과 시 사회자(facilitator) 우선 등장
 * 5. HARD_LIMIT 초과 시 종료 제안
 */
export function decideNextSpeaker(
  activeCast: readonly CastMember[],
  messages: readonly Message[],
): TurnDecision {
  const activePersonas = activeCast; // 이름 호환용 — 아래 로직은 .id 만 사용
  // instruction(사용자 메타 지시)은 발언 회차에서 제외 — 토론 진행과는 별개 채널.
  const speeches = messages.filter((m) => m.kind !== 'instruction');
  const totalTurns = speeches.length;

  if (totalTurns >= HARD_LIMIT) {
    return {
      nextSpeaker: null,
      shouldConclude: true,
      reason: `${HARD_LIMIT}회 발언 초과 — 자동 결론 트리거`,
    };
  }

  // 직전 2발언의 화자 (instruction 제외)
  const recentSpeakers = speeches
    .slice(-MAX_CONSECUTIVE)
    .map((m) => m.speakerId)
    .filter((id): id is string => id !== null);

  // 직전 발언이 사용자인지 (speakerId가 null AND kind !== instruction)
  const lastSpeech = speeches[speeches.length - 1];
  const lastWasUser = !!lastSpeech && lastSpeech.speakerId === null;

  // 페르소나별 발언 횟수
  const speakCount = new Map<string, number>();
  for (const p of activePersonas) speakCount.set(p.id, 0);
  for (const m of speeches) {
    if (m.speakerId && speakCount.has(m.speakerId)) {
      speakCount.set(m.speakerId, (speakCount.get(m.speakerId) ?? 0) + 1);
    }
  }

  // 후보: 직전 2회와 다른 페르소나
  let candidates = activePersonas.filter((p) => !recentSpeakers.includes(p.id));
  if (candidates.length === 0) candidates = [...activePersonas]; // fallback

  // SOFT_LIMIT 초과 + 사회자 활성화 → 사회자 우선
  if (totalTurns >= SOFT_LIMIT) {
    const facilitator = candidates.find((p) => p.id === 'facilitator');
    if (facilitator) {
      return {
        nextSpeaker: facilitator,
        shouldConclude: false,
        reason: `${SOFT_LIMIT}회 발언 초과 — 사회자 정리 시작`,
      };
    }
  }

  // 사용자 발언 직후 → 발언 횟수 적은 페르소나 (= 관여도 낮은 페르소나 끌어들이기)
  // 그 외의 경우도 동일하게 균등 분배 우선.
  candidates.sort((a, b) => {
    const ca = speakCount.get(a.id) ?? 0;
    const cb = speakCount.get(b.id) ?? 0;
    return ca - cb;
  });

  const next = candidates[0]!;
  return {
    nextSpeaker: next,
    shouldConclude: false,
    reason: lastWasUser
      ? '사용자 발언 직후 — 관여도 낮은 페르소나 우선'
      : '균등 분배 — 발언 적은 페르소나 우선',
  };
}

/**
 * 페르소나에게 넘길 토론 컨텍스트 프롬프트.
 * 시스템 프롬프트와 별개로, 매 턴 user 메시지로 함께 주입한다.
 *
 * cast 는 이 세션의 전체 출연진 — id→이름 맵을 함수 안에서 만든다.
 */
export function buildDebateContext(
  concern: string,
  messages: readonly Message[],
  cast: readonly CastMember[],
): string {
  const personaMap = Object.fromEntries(cast.map((m) => [m.id, m]));
  // 사용자 지시(instruction)는 모든 페르소나가 매 턴 인지해야 한다.
  // → 전체 메시지에서 누적 추출.
  const activeInstructions = messages
    .filter((m) => m.kind === 'instruction')
    .map((m) => `- ${m.content}`)
    .join('\n');

  // 일반 발언 히스토리 (최근 12개) — instruction은 제외해서 따로 표시.
  const history = messages
    .filter((m) => m.kind !== 'instruction')
    .slice(-12)
    .map((m) => {
      if (m.speakerId === null) {
        return `[사용자 발언] ${m.content}`;
      }
      const persona = personaMap[m.speakerId];
      const name = persona ? persona.name : '???';
      const replyTag = m.replyTo ? ` (반박: ${m.replyTo.slice(0, 6)})` : '';
      return `[${name}]${replyTag} (id: ${m.id.slice(0, 6)}) ${m.content}`;
    })
    .join('\n');

  const instructionBlock = activeInstructions
    ? `\n[사용자가 내린 메타 지시 — 반드시 다음 발언에 반영]
${activeInstructions}\n`
    : '';

  return `[원본 고민]
${concern}
${instructionBlock}
[지금까지의 토론]
${history || '(아직 발언 없음 — 당신이 첫 발언입니다)'}

[당신의 차례]
위 맥락을 보고, 당신의 캐릭터로서 다음 발언을 하나 만드십시오.
- 위 '원본 고민'의 구체적 사실 하나를 집어서 반응할 것. 원론·뻔한 말 금지.
- 200자 이내, 두세 문장. 입장을 분명히 ("~해야 합니다 / ~하면 망합니다").
- 직전 발언에 반박하려면 그 페르소나를 호명하고 replyToId 에 메시지 id를 넣으세요.
- 사용자에게 정말 필요한 질문이 있을 때만 isQuestion: true (한 발언에 하나).
- 사용자 지시가 있다면 톤·길이·관점에 반드시 반영.
`;
}

/** 사회자 정리 모드용 별도 프롬프트 트리거. */
export function buildConclusionPrompt(
  concern: string,
  messages: readonly Message[],
  cast: readonly CastMember[],
): string {
  const personaMap = Object.fromEntries(cast.map((m) => [m.id, m]));
  const fullHistory = messages
    .map((m) => {
      if (m.speakerId === null) return `[사용자] ${m.content}`;
      const persona = personaMap[m.speakerId];
      return `[${persona?.name ?? '???'}] ${m.content}`;
    })
    .join('\n');

  return `[원본 고민]
${concern}

[전체 토론 내용]
${fullHistory}

[작업]
사회자로서 이 토론을 정리합니다. 다음 구조로 결론을 작성하세요:

1. 핵심 결론 (3문장 이내)
2. 주요 리스크 3가지
3. 페르소나별 최종 입장 한 줄 요약
4. 추천 액션 3가지 (지금 당장 / 1주 안 / 1달 안 단위로, 구체적으로)

원론·일반론 금지. "신중히 검토하세요" 같은 말은 결론이 아닙니다.
사용자가 이 고민에 대해서만 할 수 있는, 구체적이고 단호한 문장으로 쓰십시오.
페르소나들이 실제로 충돌한 지점을 숨기지 말고 결론에 드러내십시오.
`;
}
