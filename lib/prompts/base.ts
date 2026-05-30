/**
 * 공통 베이스 프롬프트 로더.
 *
 * 데이터 출처: `data/prompts.json` (어드민 페이지에서 편집 가능)
 *
 * - BASE_PROMPT 는 모든 페르소나 프롬프트의 가장 앞에 prepend.
 * - 굴복 방지 규칙은 여기서 한 번만 명시 — 페르소나별 프롬프트는 캐릭터에만 집중.
 *
 * Phase E — 3축 directive:
 *   STANCE_DIRECTIVES    — 3종(advocate/critic/agnostic)  입장 지시 조각.
 *   LENS_DIRECTIVES      — 3종(analyst/empath/pragmatist) 관점 지시 조각.
 *   EXPRESSION_DIRECTIVES— 2종(provocateur/measured)       표현 지시 조각.
 *   composePersonaPrompt 가 cast.trait 로 3종 조회해 합성한다.
 */

import promptsJson from '@/data/prompts.json';
import type { StanceAxis, Lens, Expression } from '@/types/persona';

export const BASE_PROMPT: string = promptsJson.basePrompt;
export const OUTPUT_HINT: string = promptsJson.outputHint;

// ─── Stance Directives ────────────────────────────────────────────────────────

const STANCE_FALLBACK: Record<StanceAxis, string> = {
  advocate: '',
  critic: '',
  agnostic: '',
};

export const STANCE_DIRECTIVES: Record<StanceAxis, string> = {
  ...STANCE_FALLBACK,
  ...((promptsJson as { stanceDirectives?: Record<StanceAxis, string> })
    .stanceDirectives ?? {}),
};

// ─── Lens Directives ──────────────────────────────────────────────────────────

const LENS_FALLBACK: Record<Lens, string> = {
  analyst: '',
  empath: '',
  pragmatist: '',
};

export const LENS_DIRECTIVES: Record<Lens, string> = {
  ...LENS_FALLBACK,
  ...((promptsJson as { lensDirectives?: Record<Lens, string> })
    .lensDirectives ?? {}),
};

// ─── Expression Directives ────────────────────────────────────────────────────

const EXPRESSION_FALLBACK: Record<Expression, string> = {
  provocateur: '',
  measured: '',
};

export const EXPRESSION_DIRECTIVES: Record<Expression, string> = {
  ...EXPRESSION_FALLBACK,
  ...((promptsJson as { expressionDirectives?: Record<Expression, string> })
    .expressionDirectives ?? {}),
};
