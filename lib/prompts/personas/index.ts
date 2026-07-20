/**
 * 페르소나 마스터 데이터 로더 + 시스템 프롬프트 합성기.
 *
 * Phase B 구분:
 *   - PERSONAS / PERSONA_MAP : 아키타입(Archetype) 카탈로그. 데이터 출처는
 *     `data/personas.json` (어드민 편집 가능).
 *   - composePersonaPrompt : CastMember 단위 호출. archetype 출신이면
 *     PERSONA_MAP[archetypeId] 로 라이브 조회, generated/custom 이면
 *     cast.characterPrompt 스냅샷 사용.
 *
 * Phase E — 합성 순서 (스펙 §4.2):
 *   BASE_PROMPT
 *   + [당신의 캐릭터] 이름/역할
 *   + STANCE_DIRECTIVES[cast.trait.stanceAxis]
 *   + LENS_DIRECTIVES[cast.trait.lens]
 *   + EXPRESSION_DIRECTIVES[cast.trait.expression]
 *   + 캐릭터 프롬프트
 *   + [이 회의에서 당신의 입장] cast.stance (비어있으면 생략)
 *   + [사용자의 고민] concern
 *   + OUTPUT_HINT
 */

import personasJson from '@/data/personas.json';
import type { Archetype, CastMember, Expression, Lens, StanceAxis } from '@/types/persona';
import {
  BASE_PROMPT,
  OUTPUT_HINT,
  STANCE_DIRECTIVES,
  LENS_DIRECTIVES,
  EXPRESSION_DIRECTIVES,
} from '../base';

/**
 * stance 축 한국어 라벨.
 * picker 뱃지·커스텀 폼 칩에서 사용.
 */
export const STANCE_LABEL_KR: Record<StanceAxis, string> = {
  advocate: '옹호자',
  critic:   '비판자',
  agnostic: '회의자',
};

/**
 * lens 축 한국어 라벨.
 */
export const LENS_LABEL_KR: Record<Lens, string> = {
  analyst:    '분석가',
  empath:     '공감가',
  pragmatist: '실용가',
};

/**
 * expression 축 한국어 라벨.
 */
export const EXPRESSION_LABEL_KR: Record<Expression, string> = {
  provocateur: '도발가',
  measured:    '측정자',
};

/**
 * ⑤-5a — archetype 별 시그니처 멘트.
 * 그 페르소나가 회의에서 *처음 발언* 할 때 카드 상단에 italic 한 줄로 표시.
 * archetypeId 가 SIGNATURE_LINES 에 없으면(generated/custom) 표시 안 함.
 * 게임 영감: 동급생 / 프린세스 메이커 등 클래식 시뮬의 *캐릭터 시그니처 인사*.
 */
export const SIGNATURE_LINES: Record<string, string> = {
  'cold-investor':       '결정은 숫자에서 갈린다.',
  'cynical-dev':         '우리는 이미 한 번 망해본 적이 있어.',
  'jobs-designer':       '이게 *왜* 존재해야 합니까?',
  'realist':             '이론은 매끈하지만 현장은 그렇지 않습니다.',
  'startup-expert':      '구조를 보면 결정이 보입니다.',
  'branding-strategist': '사람들이 기억하는 것은 결정의 잔향뿐입니다.',
  'psychologist':        '결정 뒤에는 사람이 남습니다.',
  'growth-marketer':     '지금 안 움직이면 6개월 뒤엔 늦습니다.',
  'domain-expert':       '그 분야의 *진짜 문제* 는 다른 데 있어요.',
  'facilitator':         '우리가 *진짜로* 풀어야 할 질문이 뭡니까?',
  // insight-out MI 도메인 확장 (AICC·AIDC·소버린·telco·재계 관점)
  'ai-infra-visionary':    '사는 걸 논하지 말고, 무엇을 지을지를 논합시다.',
  'conglomerate-chairman': '이걸 쥐고 있습니까, 빌리고 있습니까?',
  'telco-group-chairman':  '지금 캐시카우가 5년 뒤에도 캐시카우입니까?',
  'telco-strategist':      'ARPU로 설명 안 되면 그건 취미입니다.',
  'sovereign-ai-policy':   '그 데이터는 누구의 법을 받습니까?',
  'aidc-infra-lead':       '전력이 없으면 그건 일정이 아니라 희망입니다.',
  'aicc-practice-lead':    '상담사가 안 쓰면 그 AI는 없는 겁니다.',
};

/** ⑤-5a-2 — trait 값 → 능력치 라벨 매핑. */
export const STANCE_STAT_LABEL: Record<StanceAxis, string> = {
  advocate: '추진력',
  critic:   '비판력',
  agnostic: '통찰력',
};
export const LENS_STAT_LABEL: Record<Lens, string> = {
  analyst:    '분석력',
  empath:     '공감력',
  pragmatist: '실전력',
};
export const EXPRESSION_STAT_LABEL: Record<Expression, string> = {
  provocateur: '도발력',
  measured:    '조정력',
};

/** 능력치 점수 1~5. 표시 전용 — 프롬프트 합성에 쓰지 않는다. */
export type StatScore = 1 | 2 | 3 | 4 | 5;
export interface StatTriple {
  stanceAxis: StatScore;
  lens: StatScore;
  expression: StatScore;
}

/**
 * ⑤-5a-2 — archetype별 능력치 점수표 (Opus 박제, 부록 A).
 * 키는 trait *축*. 라벨은 그 멤버의 trait *값* 으로 런타임 해석.
 * generated/custom(여기 없는 멤버)은 DEFAULT_STAT 폴백.
 */
export const STAT_SCORES: Record<string, StatTriple> = {
  'cold-investor':       { stanceAxis: 5, lens: 5, expression: 3 },
  'cynical-dev':         { stanceAxis: 5, lens: 4, expression: 5 },
  'jobs-designer':       { stanceAxis: 5, lens: 3, expression: 5 },
  'realist':             { stanceAxis: 4, lens: 5, expression: 3 },
  'startup-expert':      { stanceAxis: 4, lens: 5, expression: 4 },
  'branding-strategist': { stanceAxis: 4, lens: 5, expression: 3 },
  'psychologist':        { stanceAxis: 4, lens: 5, expression: 4 },
  'growth-marketer':     { stanceAxis: 5, lens: 4, expression: 3 },
  'domain-expert':       { stanceAxis: 3, lens: 5, expression: 4 },
  'facilitator':         { stanceAxis: 4, lens: 3, expression: 5 },
  // insight-out MI 도메인 확장
  'ai-infra-visionary':    { stanceAxis: 5, lens: 4, expression: 5 },
  'conglomerate-chairman': { stanceAxis: 4, lens: 4, expression: 2 },
  'telco-group-chairman':  { stanceAxis: 4, lens: 5, expression: 3 },
  'telco-strategist':      { stanceAxis: 5, lens: 5, expression: 3 },
  'sovereign-ai-policy':   { stanceAxis: 5, lens: 5, expression: 3 },
  'aidc-infra-lead':       { stanceAxis: 5, lens: 4, expression: 3 },
  'aicc-practice-lead':    { stanceAxis: 4, lens: 5, expression: 3 },
};

/** generated/custom 폴백 — 정의 trait(stance)만 약간 높게. */
const DEFAULT_STAT: StatTriple = { stanceAxis: 4, lens: 3, expression: 3 };

/** 한 멤버의 *표시용* 능력치 3개 — {라벨, 점수}. 카드·드로어 공용. */
export function statsForMember(
  member: Pick<CastMember, 'archetypeId' | 'trait'>,
): { label: string; score: StatScore }[] {
  const s =
    (member.archetypeId && STAT_SCORES[member.archetypeId]) || DEFAULT_STAT;
  return [
    { label: STANCE_STAT_LABEL[member.trait.stanceAxis],   score: s.stanceAxis },
    { label: LENS_STAT_LABEL[member.trait.lens],           score: s.lens },
    { label: EXPRESSION_STAT_LABEL[member.trait.expression], score: s.expression },
  ];
}

/** 10개 아키타입 전체 — JSON 순서 그대로. */
export const PERSONAS: readonly Archetype[] =
  personasJson as readonly Archetype[];

/** ID 기준 빠른 조회용 맵. */
export const PERSONA_MAP: Record<string, Archetype> = Object.fromEntries(
  PERSONAS.map((p) => [p.id, p]),
);

/**
 * 한 명의 CastMember 시스템 프롬프트 합성.
 *
 * - source==='archetype' 인데 PERSONA_MAP 조회 실패(어드민 삭제) →
 *   캐릭터 프롬프트 없이라도 합성 진행. BASE + 이름/역할 + 3 directive
 *   + stance 만으로도 일관 동작 보장.
 * - stance 가 빈 문자열이면 stance 블록 생략 (풀 수동 추가/중립 케이스).
 */
export function composePersonaPrompt(
  cast: CastMember,
  context?: { concern?: string },
): string {
  // 캐릭터 프롬프트: archetype 은 라이브 조회, 그 외는 스냅샷.
  let characterPrompt = '';
  if (cast.source === 'archetype' && cast.archetypeId) {
    const arch = PERSONA_MAP[cast.archetypeId];
    if (arch) characterPrompt = arch.systemPrompt;
    // arch 없음 = 어드민이 삭제. characterPrompt 빈 채로 진행.
  } else if (cast.characterPrompt) {
    characterPrompt = cast.characterPrompt;
  }

  // 3축 directive 블록
  const stanceBlock = STANCE_DIRECTIVES[cast.trait.stanceAxis]?.trim()
    ? `\n${STANCE_DIRECTIVES[cast.trait.stanceAxis]}`
    : '';
  const lensBlock = LENS_DIRECTIVES[cast.trait.lens]?.trim()
    ? `\n${LENS_DIRECTIVES[cast.trait.lens]}`
    : '';
  const expressionBlock = EXPRESSION_DIRECTIVES[cast.trait.expression]?.trim()
    ? `\n${EXPRESSION_DIRECTIVES[cast.trait.expression]}`
    : '';

  const stanceTextBlock =
    cast.stance && cast.stance.trim().length > 0
      ? `\n\n[이 회의에서 당신의 입장]\n${cast.stance}\n\n이 입장을 토론 내내 일관되게 견지하십시오. 다른 페르소나의 반박에 논리적으로 밀리면 부분 인정은 가능하나, 핵심 입장은 끝까지 지킵니다.`
      : '';

  const concernBlock = context?.concern
    ? `\n\n[사용자의 고민]\n${context.concern}`
    : '';

  return [
    BASE_PROMPT,
    `\n[당신의 캐릭터]\n당신의 이름은 "${cast.name}" 입니다. 역할: ${cast.role}.\n`,
    stanceBlock,
    lensBlock,
    expressionBlock,
    characterPrompt,
    stanceTextBlock,
    concernBlock,
    `\n\n${OUTPUT_HINT}`,
  ]
    .filter(Boolean)
    .join('\n');
}
