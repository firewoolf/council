/**
 * 페르소나 무결성 가드.
 *
 * 어드민이 페르소나를 삭제한 직후 사용자가 옛 빌드의 클라이언트로
 * 회의에 진입하거나, 추천 모델이 환각 id를 반환한 경우의 안전망.
 *
 * 핵심 규칙: 절대 unknown id 로 회의에 들어가지 않는다.
 * 부족분은 안 쓰인 페르소나로 자동 보충 (도메인 전문가/사회자 제외).
 */

import { PERSONAS, PERSONA_MAP } from '@/lib/prompts/personas';
import type { Persona } from '@/types/persona';

const FACILITATOR_ID = 'facilitator';
const DOMAIN_EXPERT_ID = 'domain-expert';

/** 한 id 가 현재 등록된 페르소나에 존재하는지. */
export function isKnownPersonaId(id: string): boolean {
  return Boolean(PERSONA_MAP[id]);
}

/** 배열에서 unknown id 만 silently drop. 순서 유지. */
export function filterKnownIds(ids: readonly string[]): string[] {
  return ids.filter(isKnownPersonaId);
}

/**
 * 추천 응답 ids 정리: unknown drop + 부족분 무작위 보충.
 *
 * @param rawIds  모델 응답의 personaId 배열
 * @param target  목표 개수 (기본 3 — recommendationSchema.length 3)
 * @returns       { ids: 정리된 추천 id 배열, dropped: 제거된 id, filled: 보충된 id }
 */
export function sanitizeRecommendedIds(
  rawIds: readonly string[],
  target = 3,
): { ids: string[]; dropped: string[]; filled: string[] } {
  const known: string[] = [];
  const dropped: string[] = [];
  for (const id of rawIds) {
    if (isKnownPersonaId(id) && !known.includes(id)) {
      known.push(id);
    } else if (!isKnownPersonaId(id)) {
      dropped.push(id);
    }
  }

  if (known.length >= target) {
    return { ids: known.slice(0, target), dropped, filled: [] };
  }

  // 보충: 도메인 전문가/사회자 + 이미 쓰인 id 제외 → 셔플 → 부족분만큼 채움
  const excluded = new Set([...known, FACILITATOR_ID, DOMAIN_EXPERT_ID]);
  const candidates: Persona[] = PERSONAS.filter((p) => !excluded.has(p.id));
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const filled = shuffled.slice(0, target - known.length).map((p) => p.id);

  return { ids: [...known, ...filled], dropped, filled };
}

/**
 * 회의 시작 직전 selectedIds 검증.
 * 사용자가 picking 단계에 있던 사이에 운영자가 페르소나 삭제했을 가능성을 막는다.
 *
 * @returns ids 모두 known 이면 그대로, 일부가 stale 이면 known 만 남김.
 */
export function sanitizeSelectedIds(
  selectedIds: readonly string[],
): { ids: string[]; dropped: string[] } {
  const ids: string[] = [];
  const dropped: string[] = [];
  for (const id of selectedIds) {
    if (isKnownPersonaId(id)) ids.push(id);
    else dropped.push(id);
  }
  return { ids, dropped };
}
