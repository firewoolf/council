/**
 * 페르소나 마스터 데이터 로더.
 *
 * 데이터 출처: `data/personas.json` (어드민 페이지에서 편집 가능)
 *
 * - 색상/프롬프트는 JSON 단일 진실 공급원.
 * - systemPrompt 는 BASE_PROMPT 와 합쳐서 사용 (composePersonaPrompt 헬퍼).
 * - JSON 스키마 어긋나면 빌드 시점에 TS가 잡아주진 않으므로, 어드민 저장 시점에 Zod 검증 필요.
 */

import personasJson from '@/data/personas.json';
import type { Persona } from '@/types/persona';
import { BASE_PROMPT, OUTPUT_HINT } from '../base';

/** 10개 페르소나 전체 — JSON 순서 그대로. */
export const PERSONAS: readonly Persona[] = personasJson as readonly Persona[];

/** ID 기준 빠른 조회용 맵. */
export const PERSONA_MAP: Record<string, Persona> = Object.fromEntries(
  PERSONAS.map((p) => [p.id, p]),
);

/**
 * 페르소나 1명의 최종 시스템 프롬프트 합성.
 * BASE_PROMPT + 캐릭터 프롬프트 + 출력 가이드.
 *
 * 도메인 전문가(dynamic)는 domain 인자를 넘겨 분야를 주입한다.
 */
export function composePersonaPrompt(
  persona: Persona,
  context?: { domain?: string; concern?: string },
): string {
  const characterPrompt = persona.dynamic && context?.domain
    ? persona.systemPrompt.replace(
        '(구체적 분야는 회의 시작 시 동적으로 주입됩니다 — 예: 여행앱 → 여행업계 전문가, 핀테크 → 금융 규제 전문가)',
        `당신의 구체적 분야는 [${context.domain}] 입니다.`,
      )
    : persona.systemPrompt;

  const concernBlock = context?.concern
    ? `\n\n[사용자의 고민]\n${context.concern}`
    : '';

  return [
    BASE_PROMPT,
    `\n[당신의 캐릭터]\n당신의 이름은 "${persona.name}" 입니다.\n`,
    characterPrompt,
    concernBlock,
    `\n\n${OUTPUT_HINT}`,
  ].join('\n');
}
