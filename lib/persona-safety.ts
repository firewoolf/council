/**
 * 페르소나 무결성 가드.
 *
 * Phase B-1: sanitizeRecommendedIds / sanitizeSelectedIds — 아키타입 id 환각 방지.
 * Phase B-2: LENS_COLORS / sanitizePanel — panelDesignSchema 결과를 CastMember[] 로 정규화.
 * Phase E: TEMPERAMENT_COLORS → LENS_COLORS. sanitizePanel 은 trait 3축 정규화.
 *
 * 핵심 규칙: 절대 unknown id 로 회의에 들어가지 않는다.
 */

import { PERSONAS, PERSONA_MAP } from '@/lib/prompts/personas';
import {
  synthesizeCharacterPrompt,
  synthesizeVoiceCard,
} from '@/lib/prompts/synthesize';
import type {
  Archetype as Persona,
  CastMember,
  Expression,
  Lens,
  StanceAxis,
  Trait,
} from '@/types/persona';
import type { PanelDesign } from '@/lib/prompts/recommender';

const FACILITATOR_ID = 'facilitator';
const DOMAIN_EXPERT_ID = 'domain-expert';

// ─── Phase E: LENS_COLORS ─────────────────────────────────────────────────────

/**
 * lens 별 기본 orb 팔레트.
 * generated/custom CastMember 에 사용.
 * lens 가 색의 *주체* — 인지 양식이 페르소나 정체성에 가장 가깝다.
 */
export const LENS_COLORS: Record<Lens, { from: string; to: string }> = {
  analyst:    { from: '#1E40AF', to: '#3B82F6' }, // blue    — 냉정
  empath:     { from: '#6D28D9', to: '#A78BFA' }, // violet  — 공감
  pragmatist: { from: '#047857', to: '#10B981' }, // emerald — 실전
};

// ─── 축별 유효 값 집합 ────────────────────────────────────────────────────────

const VALID_STANCE_AXES = new Set<StanceAxis>(['advocate', 'critic', 'agnostic']);
const VALID_LENSES = new Set<Lens>(['analyst', 'empath', 'pragmatist']);
const VALID_EXPRESSIONS = new Set<Expression>(['provocateur', 'measured']);

const VALID_SOURCES = new Set(['archetype', 'generated']);

/** raw 에서 trait 를 안전하게 꺼낸다. 알 수 없는 축 값 → 안전 기본값. */
function normalizeTrait(raw: unknown): Trait {
  const t = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const stanceAxis: StanceAxis = VALID_STANCE_AXES.has(t.stanceAxis as StanceAxis)
    ? (t.stanceAxis as StanceAxis)
    : 'agnostic';
  const lens: Lens = VALID_LENSES.has(t.lens as Lens)
    ? (t.lens as Lens)
    : 'pragmatist';
  const expression: Expression = VALID_EXPRESSIONS.has(t.expression as Expression)
    ? (t.expression as Expression)
    : 'measured';
  return { stanceAxis, lens, expression };
}

/**
 * Phase E: E-1 과도기 — recommender 가 아직 `temperament: string` 을 반환하는 경우,
 * 이를 Trait 으로 변환한다. E-2 에서 recommender 가 `trait` 객체를 반환하면
 * normalizeTrait 이 직접 소비하므로 이 함수는 자연히 dead code 가 된다.
 */
const TEMPERAMENT_TO_TRAIT: Record<string, Trait> = {
  advocate:    { stanceAxis: 'advocate', lens: 'pragmatist', expression: 'measured' },
  critic:      { stanceAxis: 'critic',   lens: 'analyst',    expression: 'measured' },
  analyst:     { stanceAxis: 'agnostic', lens: 'analyst',    expression: 'measured' },
  provocateur: { stanceAxis: 'agnostic', lens: 'pragmatist', expression: 'provocateur' },
  empath:      { stanceAxis: 'agnostic', lens: 'empath',     expression: 'measured' },
};
const DEFAULT_TRAIT: Trait = { stanceAxis: 'agnostic', lens: 'pragmatist', expression: 'measured' };

/**
 * panelDesignSchema 결과를 CastMember[] 로 정규화한다 (스펙 §5.5).
 *
 * 처리 순서:
 *   1. source/trait/stance 느슨한 스키마 정규화
 *   2. archetype: archetypeId dedupe → PERSONA_MAP 조회 → 없으면 generated 강등
 *   3. generated: name/role 폴백 적용 → characterPrompt 합성 + LENS_COLORS
 *   4. 패널 크기 < 3 → 무작위 보충 (facilitator/domain-expert 제외)
 *   5. 전원 동일 stanceAxis 경고
 */
export function sanitizePanel(
  panel: PanelDesign['panel'],
): { cast: CastMember[]; notes: string[] } {
  const notes: string[] = [];
  const cast: CastMember[] = [];
  const seenArchetypeIds = new Set<string>();

  for (const raw of panel) {
    const source = VALID_SOURCES.has(raw.source)
      ? (raw.source as 'archetype' | 'generated')
      : 'generated';

    // Phase E: recommender 가 trait 객체를 반환하면 normalizeTrait 사용.
    //          아직 temperament 문자열을 반환하면 TEMPERAMENT_TO_TRAIT 폴백.
    let trait: Trait;
    const rawAny = raw as Record<string, unknown>;
    if (rawAny.trait && typeof rawAny.trait === 'object') {
      trait = normalizeTrait(rawAny.trait);
    } else if (typeof rawAny.temperament === 'string' && rawAny.temperament) {
      trait = TEMPERAMENT_TO_TRAIT[rawAny.temperament] ?? DEFAULT_TRAIT;
    } else {
      trait = DEFAULT_TRAIT;
    }

    const stance = raw.stance?.trim() ?? '';
    const rawVoiceCard = raw.voiceCard?.trim() ?? '';

    if (source === 'archetype') {
      const archetypeId = raw.archetypeId ?? '';

      // dedupe: 같은 archetypeId 가 이미 cast 에 있으면 스킵
      if (seenArchetypeIds.has(archetypeId)) {
        notes.push(`archetypeId '${archetypeId}' 중복 → 스킵`);
        continue;
      }

      const arch = PERSONA_MAP[archetypeId];
      if (!arch) {
        notes.push(`archetypeId '${archetypeId}' 없음 → generated 강등`);
        const name = raw.name ?? '전문가';
        const role = raw.role ?? '이 분야 전문가';
        const colors = LENS_COLORS[trait.lens];
        cast.push({
          id: crypto.randomUUID(),
          source: 'generated',
          name,
          role,
          trait,
          stance,
          colorFrom: colors.from,
          colorTo: colors.to,
          characterPrompt: synthesizeCharacterPrompt({ role, trait, stance }),
          voiceCard:
            rawVoiceCard || synthesizeVoiceCard({ role, trait }),
        });
      } else {
        seenArchetypeIds.add(archetypeId);
        cast.push({
          id: archetypeId,
          source: 'archetype',
          archetypeId,
          name: arch.name,
          role: arch.role,
          trait: arch.trait,
          stance,
          colorFrom: arch.colorFrom,
          colorTo: arch.colorTo,
          isFacilitator: archetypeId === FACILITATOR_ID,
        });
      }
    } else {
      const name = raw.name ?? '전문가';
      const role = raw.role ?? '이 분야 전문가';
      const colors = LENS_COLORS[trait.lens];
      cast.push({
        id: crypto.randomUUID(),
        source: 'generated',
        name,
        role,
        trait,
        stance,
        colorFrom: colors.from,
        colorTo: colors.to,
        characterPrompt: synthesizeCharacterPrompt({ role, trait, stance }),
        voiceCard:
          rawVoiceCard || synthesizeVoiceCard({ role, trait }),
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
        trait: p.trait,
        stance: '',
        colorFrom: p.colorFrom,
        colorTo: p.colorTo,
      });
      notes.push(`패널 부족 → ${p.name} 자동 보충`);
    }
  }

  const stances = cast.map((m) => m.trait.stanceAxis);
  if (new Set(stances).size === 1) {
    console.warn('[sanitizePanel] 전원 동일 stanceAxis:', stances[0]);
  }

  return { cast, notes };
}

/**
 * 사회자 archetype 을 cast 에 자동 포함시킨다.
 *
 * picking 화면 진입 시 / 운영자가 사회자를 제거하지 못하게 막는 안전망.
 * 이미 cast 에 facilitator 가 있으면 그대로 반환.
 */
export function ensureFacilitator(cast: CastMember[]): CastMember[] {
  if (cast.some((m) => m.isFacilitator)) return cast;
  const fArch = PERSONA_MAP[FACILITATOR_ID];
  if (!fArch) return cast;
  return [
    ...cast,
    {
      id: FACILITATOR_ID,
      source: 'archetype',
      archetypeId: FACILITATOR_ID,
      name: fArch.name,
      role: fArch.role,
      trait: fArch.trait,
      stance: '',
      colorFrom: fArch.colorFrom,
      colorTo: fArch.colorTo,
      isFacilitator: true,
    },
  ];
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
