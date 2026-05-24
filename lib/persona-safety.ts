/**
 * 페르소나 무결성 가드.
 *
 * Phase B-1: sanitizeRecommendedIds / sanitizeSelectedIds — 아키타입 id 환각 방지.
 * Phase B-2: TEMPERAMENT_COLORS / sanitizePanel — panelDesignSchema 결과를 CastMember[] 로 정규화.
 *
 * 핵심 규칙: 절대 unknown id 로 회의에 들어가지 않는다.
 */

import { PERSONAS, PERSONA_MAP } from '@/lib/prompts/personas';
import { synthesizeCharacterPrompt } from '@/lib/prompts/synthesize';
import type { Archetype as Persona, CastMember, Temperament } from '@/types/persona';
import type { PanelDesign } from '@/lib/prompts/recommender';

const FACILITATOR_ID = 'facilitator';
const DOMAIN_EXPERT_ID = 'domain-expert';

// ─── Phase B-2 ───────────────────────────────────────────────────────────────

/** temperament 별 기본 orb 팔레트. generated/custom CastMember 에 사용. */
export const TEMPERAMENT_COLORS: Record<Temperament, { from: string; to: string }> = {
  advocate:    { from: '#047857', to: '#10B981' }, // emerald — 추진
  critic:      { from: '#9F1239', to: '#F43F5E' }, // rose    — 경고
  analyst:     { from: '#1E40AF', to: '#3B82F6' }, // blue    — 냉정
  provocateur: { from: '#B45309', to: '#F59E0B' }, // amber   — 도발
  empath:      { from: '#6D28D9', to: '#A78BFA' }, // violet  — 공감
};

const VALID_SOURCES = new Set(['archetype', 'generated']);
const VALID_TEMPERAMENTS = new Set<Temperament>([
  'advocate', 'critic', 'analyst', 'provocateur', 'empath',
]);

/**
 * panelDesignSchema 결과를 CastMember[] 로 정규화한다 (스펙 §5.5).
 *
 * 처리 순서:
 *   1. source/temperament/stance 느슨한 스키마 정규화
 *   2. archetype: PERSONA_MAP 조회 — 없으면 generated 로 강등
 *   3. generated: characterPrompt 합성 + TEMPERAMENT_COLORS 적용
 *   4. 패널 크기 < 3 → 무작위 보충 (facilitator/domain-expert 제외)
 *   5. 전원 동일 temperament 경고
 */
export function sanitizePanel(
  panel: PanelDesign['panel'],
): { cast: CastMember[]; notes: string[] } {
  const notes: string[] = [];
  const cast: CastMember[] = [];

  for (const raw of panel) {
    const source = VALID_SOURCES.has(raw.source)
      ? (raw.source as 'archetype' | 'generated')
      : 'generated';

    const temperament: Temperament = VALID_TEMPERAMENTS.has(
      raw.temperament as Temperament,
    )
      ? (raw.temperament as Temperament)
      : 'analyst';

    const stance = raw.stance?.trim() ?? '';

    if (source === 'archetype') {
      const archetypeId = raw.archetypeId ?? '';
      const arch = PERSONA_MAP[archetypeId];

      if (!arch) {
        notes.push(`archetypeId '${archetypeId}' 없음 → generated 강등`);
        const colors = TEMPERAMENT_COLORS[temperament];
        cast.push({
          id: crypto.randomUUID(),
          source: 'generated',
          name: raw.name,
          role: raw.role,
          temperament,
          stance,
          colorFrom: colors.from,
          colorTo: colors.to,
          characterPrompt: synthesizeCharacterPrompt({ role: raw.role, temperament, stance }),
        });
      } else {
        cast.push({
          id: archetypeId,
          source: 'archetype',
          archetypeId,
          name: arch.name,
          role: arch.role,
          temperament: arch.temperament,
          stance,
          colorFrom: arch.colorFrom,
          colorTo: arch.colorTo,
          isFacilitator: archetypeId === FACILITATOR_ID,
        });
      }
    } else {
      const colors = TEMPERAMENT_COLORS[temperament];
      cast.push({
        id: crypto.randomUUID(),
        source: 'generated',
        name: raw.name,
        role: raw.role,
        temperament,
        stance,
        colorFrom: colors.from,
        colorTo: colors.to,
        characterPrompt: synthesizeCharacterPrompt({ role: raw.role, temperament, stance }),
      });
    }
  }

  // 패널 크기 보충
  if (cast.length < 3) {
    const usedIds = new Set(cast.map((m) => m.archetypeId ?? m.id));
    const fillExcluded = new Set([FACILITATOR_ID, DOMAIN_EXPERT_ID]);
    const candidates = PERSONAS.filter(
      (p) => !usedIds.has(p.id) && !fillExcluded.has(p.id),
    );
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    for (const p of shuffled.slice(0, 3 - cast.length)) {
      cast.push({
        id: p.id,
        source: 'archetype',
        archetypeId: p.id,
        name: p.name,
        role: p.role,
        temperament: p.temperament,
        stance: '',
        colorFrom: p.colorFrom,
        colorTo: p.colorTo,
      });
      notes.push(`패널 부족 → ${p.name} 자동 보충`);
    }
  }

  const temps = cast.map((m) => m.temperament);
  if (new Set(temps).size === 1) {
    console.warn('[sanitizePanel] 전원 동일 temperament:', temps[0]);
  }

  return { cast, notes };
}

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
