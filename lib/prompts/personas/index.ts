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
 * 합성 순서 (스펙 §5.1):
 *   BASE_PROMPT
 *   + [당신의 캐릭터] 이름/역할
 *   + TEMPERAMENT_DIRECTIVE[cast.temperament]
 *   + 캐릭터 프롬프트
 *   + [이 회의에서 당신의 입장] cast.stance (비어있으면 생략)
 *   + [사용자의 고민] concern
 *   + OUTPUT_HINT
 */

import personasJson from '@/data/personas.json';
import type { Archetype, CastMember, Temperament } from '@/types/persona';
import { BASE_PROMPT, OUTPUT_HINT, TEMPERAMENT_DIRECTIVES } from '../base';

/**
 * temperament 한국어 라벨.
 * picker 뱃지·커스텀 폼 칩에서 사용. 사용자 노출 표기 단일화.
 */
export const TEMPERAMENT_LABEL_KR: Record<Temperament, string> = {
  advocate:    '옹호가',
  critic:      '비판가',
  analyst:     '분석가',
  provocateur: '독설가',
  empath:      '공감가',
};

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
 *   캐릭터 프롬프트 없이라도 합성 진행. BASE + 이름/역할 + temperament 지시
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

  const temperamentBlock = TEMPERAMENT_DIRECTIVES[cast.temperament]?.trim()
    ? `\n${TEMPERAMENT_DIRECTIVES[cast.temperament]}`
    : '';

  const stanceBlock =
    cast.stance && cast.stance.trim().length > 0
      ? `\n\n[이 회의에서 당신의 입장]\n${cast.stance}\n\n이 입장을 토론 내내 일관되게 견지하십시오. 다른 페르소나의 반박에 논리적으로 밀리면 부분 인정은 가능하나, 핵심 입장은 끝까지 지킵니다.`
      : '';

  const concernBlock = context?.concern
    ? `\n\n[사용자의 고민]\n${context.concern}`
    : '';

  return [
    BASE_PROMPT,
    `\n[당신의 캐릭터]\n당신의 이름은 "${cast.name}" 입니다. 역할: ${cast.role}.\n`,
    temperamentBlock,
    characterPrompt,
    stanceBlock,
    concernBlock,
    `\n\n${OUTPUT_HINT}`,
  ]
    .filter(Boolean)
    .join('\n');
}
