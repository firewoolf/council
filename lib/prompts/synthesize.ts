/**
 * generated/custom CastMember 의 characterPrompt 를 템플릿으로 합성한다.
 *
 * custom 추가와 generated 가 같은 함수를 쓴다 (스펙 §5.3).
 * 자유 프롬프트 입력은 받지 않는다 — role + trait + stance 만으로 합성.
 * BASE_PROMPT 는 composePersonaPrompt 가 앞에 붙이므로 여기서는 생략.
 *
 * Phase E: temperament → trait (3축).
 */

import type { Trait } from '@/types/persona';
import { STANCE_DIRECTIVES, LENS_DIRECTIVES, EXPRESSION_DIRECTIVES } from './base';

export function synthesizeCharacterPrompt(input: {
  role: string;
  trait: Trait;
  stance: string;
}): string {
  const { role, trait, stance } = input;

  const stanceDir = STANCE_DIRECTIVES[trait.stanceAxis]?.trim() ?? '';
  const lensDir   = LENS_DIRECTIVES[trait.lens]?.trim() ?? '';
  const exprDir   = EXPRESSION_DIRECTIVES[trait.expression]?.trim() ?? '';

  const absoluteLine = stance.trim()
    ? `[절대 양보 안 하는 것] "${stance}"에 반하는 결론을 쉽게 수용하지 않습니다.`
    : `[절대 양보 안 하는 것] 이 분야의 검증되지 않은 가정을 무비판적으로 수용하는 것.`;

  return [
    `당신은 "${role}" 입니다.`,
    stanceDir,
    lensDir,
    exprDir,
    `당신은 이 분야의 현실·관행·실패 패턴을 압니다.`,
    absoluteLine,
  ]
    .filter(Boolean)
    .join('\n');
}
