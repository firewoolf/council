/**
 * 공통 베이스 프롬프트 로더.
 *
 * 데이터 출처: `data/prompts.json` (어드민 페이지에서 편집 가능)
 *
 * - BASE_PROMPT 는 모든 페르소나 프롬프트의 가장 앞에 prepend.
 * - 굴복 방지 규칙은 여기서 한 번만 명시 — 페르소나별 프롬프트는 캐릭터에만 집중.
 * - TEMPERAMENT_DIRECTIVES — 5종(advocate/critic/analyst/provocateur/empath) 토론 자세 지시 조각.
 *   composePersonaPrompt 가 cast.temperament 로 조회한다.
 */

import promptsJson from '@/data/prompts.json';
import type { Temperament } from '@/types/persona';

export const BASE_PROMPT: string = promptsJson.basePrompt;
export const OUTPUT_HINT: string = promptsJson.outputHint;

const FALLBACK: Record<Temperament, string> = {
  advocate: '',
  critic: '',
  analyst: '',
  provocateur: '',
  empath: '',
};

export const TEMPERAMENT_DIRECTIVES: Record<Temperament, string> = {
  ...FALLBACK,
  ...((promptsJson as { temperamentDirectives?: Record<Temperament, string> })
    .temperamentDirectives ?? {}),
};
