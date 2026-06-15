import { z } from 'zod';

export const mirrorProfileSchema = z.object({
  observedPatterns: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe('반복되는 사고 맹점 1~3줄. 한국어로만.'),
});

export type MirrorProfileResult = z.infer<typeof mirrorProfileSchema>;

export function buildMirrorProfilePrompt(args: {
  sessionSummary: string;
  observedPatterns: readonly string[];
}): string {
  const existing =
    args.observedPatterns.length > 0
      ? args.observedPatterns.map((pattern) => `- ${pattern}`).join('\n')
      : '- 없음';

  return `당신은 이 사용자의 의사결정 거울이다. 아래 [이번 세션]과 [기존 관찰]을 병합해,
이 사람의 *반복되는 사고 맹점*을 1~3줄로 갱신하라.
- 위로·합리화·칭찬 금지. 사실에 근거해 맹점만 짚어라.
- 1회성 특징은 버리고 *반복되는 것*만 남겨라. ("매번 검증을 건너뜀" 류)
- 데이터에 없는 추측 금지. 근거가 약하면 기존 관찰을 유지하라.
- 한국어로만.

[이번 세션]
${args.sessionSummary}

[기존 관찰]
${existing}`;
}
