/**
 * 어드민 입력 검증용 Zod 스키마.
 * - 모든 폼 입력은 여기를 거치고, 서버 라우트도 동일 스키마로 재검증한다.
 * - data/personas.json, data/prompts.json 의 런타임 구조 가드 역할도 함.
 */

import { z } from 'zod';

const DEBATE_STYLES = [
  'data',
  'cynical',
  'emotion',
  'experience',
  'structural',
  'sensory',
  'question',
  'data-tactical',
  'industry',
  'facilitator',
] as const;

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, '#RRGGBB 형식이어야 합니다');

export const personaSchema = z.object({
  id: z
    .string()
    .min(2, '최소 2자')
    .regex(/^[a-z0-9-]+$/, '소문자/숫자/하이픈만 허용 (kebab-case)'),
  name: z.string().min(1, '필수').max(40),
  role: z.string().min(1, '필수').max(80),
  coreValue: z.string().min(1, '필수').max(200),
  debateStyle: z.enum(DEBATE_STYLES),
  nonNegotiable: z.string().min(1, '필수').max(200),
  weakness: z.string().min(1, '필수').max(200),
  systemPrompt: z.string().min(20, '최소 20자').max(4000),
  colorFrom: hexColor,
  colorTo: hexColor,
  userQuestions: z
    .array(z.string().min(1).max(200))
    .min(1, '최소 1개')
    .max(10, '최대 10개'),
  dynamic: z.boolean().optional(),
});

export type PersonaInput = z.infer<typeof personaSchema>;

export const personasArraySchema = z.array(personaSchema);

export const promptsSchema = z.object({
  basePrompt: z.string().min(50, '최소 50자').max(4000),
  outputHint: z.string().min(20, '최소 20자').max(2000),
});

export type PromptsInput = z.infer<typeof promptsSchema>;
