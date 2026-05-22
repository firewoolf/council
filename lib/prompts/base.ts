/**
 * 공통 베이스 프롬프트 로더.
 *
 * 데이터 출처: `data/prompts.json` (어드민 페이지에서 편집 가능)
 *
 * - BASE_PROMPT 는 모든 페르소나 프롬프트의 가장 앞에 prepend.
 * - 굴복 방지 규칙은 여기서 한 번만 명시 — 페르소나별 프롬프트는 캐릭터에만 집중.
 */

import promptsJson from '@/data/prompts.json';

export const BASE_PROMPT: string = promptsJson.basePrompt;
export const OUTPUT_HINT: string = promptsJson.outputHint;
