/**
 * generated/custom CastMember 의 characterPrompt 를 템플릿으로 합성한다.
 *
 * custom 추가와 generated 가 같은 함수를 쓴다 (스펙 §5.3).
 * 자유 프롬프트 입력은 받지 않는다 — role + trait + stance 만으로 합성.
 * BASE_PROMPT 는 composePersonaPrompt 가 앞에 붙이므로 여기서는 생략.
 *
 * Phase E: temperament → trait (3축).
 */

import type { Expression, Lens, Trait } from '@/types/persona';
import { STANCE_DIRECTIVES, LENS_DIRECTIVES, EXPRESSION_DIRECTIVES } from './base';

const EXPR_LINE: Record<Expression, string> = {
  provocateur: '직설적. 에두르지 않고 상대 주장의 가장 약한 못을 정면으로 친다.',
  measured: '구조적. 주장→근거→함의 순서로 말하되 발언마다 단언을 하나 박는다.',
};

const LENS_LINE: Record<Lens, string> = {
  analyst: '모든 사안을 수치·근거로 환산해 본다.',
  empath: '결정이 사람과 동기에 남기는 흔적부터 본다.',
  pragmatist: '실제 현장에서 어떻게 굴러가는지부터 본다.',
};

export function synthesizeVoiceCard(input: {
  role: string;
  trait: Trait;
}): string {
  return [
    `화법: ${EXPR_LINE[input.trait.expression]}`,
    `프레임: ${input.role}의 눈 — ${LENS_LINE[input.trait.lens]}`,
    `금지: 벙벙한 중립, 교과서 일반론, 다른 패널 화법 모방.`,
  ].join('\n');
}

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
