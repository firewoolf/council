/**
 * MI 능동 주제 제안 — insight-out 마켓 인텔리전스에서 "지금 토론할 결정거리"를 뽑는다.
 *
 * 당김(사용자가 고민 입력) → 밀기(council 이 MI 를 읽고 먼저 제안) 전환의 핵심 프롬프트.
 * 결과는 /session/new 진입 화면에 브리핑 카드로 노출되고, 클릭하면 그 주제로 토론 시작.
 */

import { z } from 'zod';

import type { MiBundle } from '@/lib/mi/types';

export const TOPIC_CATEGORY = ['competitor', 'issue', 'market', 'risk'] as const;
export type TopicCategory = (typeof TOPIC_CATEGORY)[number];

export const topicProposalSchema = z.object({
  /** 결정형 한 문장 고민 (예: "경쟁사 X의 Y 대응 — 따라갈까") */
  title: z.string(),
  /** 왜 지금 이걸 다뤄야 하는지 한 줄 (구체 근거) */
  hook: z.string(),
  category: z.enum(TOPIC_CATEGORY).optional(),
});
export type TopicProposal = z.infer<typeof topicProposalSchema>;

export const topicProposalsSchema = z.object({
  proposals: z.array(topicProposalSchema).min(2).max(6),
});

const CATEGORY_LABEL: Record<TopicCategory, string> = {
  competitor: '경쟁사',
  issue: '이슈',
  market: '시장',
  risk: '리스크',
};

export function categoryLabel(c?: TopicCategory): string {
  return c ? CATEGORY_LABEL[c] : 'MI';
}

/** MI 번들 → 주제 제안 프롬프트 */
export function buildTopicProposalPrompt(mi: MiBundle): string {
  const competitors = mi.entities
    .filter((e) => e.isCompetitor)
    .map((e) => e.name);
  const issues = mi.issues.map((i) =>
    i.summary ? `${i.title} — ${i.summary}` : i.title,
  );
  const contents = mi.contents
    .slice(0, 8)
    .map((c) => `- ${c.title}${c.summary ? `: ${c.summary}` : ''}`);

  const block = [
    competitors.length ? `추적 경쟁사: ${competitors.join(', ')}` : null,
    issues.length ? `뜨는 이슈:\n${issues.map((s) => `- ${s}`).join('\n')}` : null,
    contents.length ? `최근 자료:\n${contents.join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  return `[insight-out 마켓 인텔리전스 — 실제 시장 데이터]
${block}

[작업]
위 데이터를 근거로, 이 회사가 지금 '결정'해야 할 토론 주제를 2~5개 제안하라.

규칙:
- title 은 결정형 한 문장 고민. 이 데이터에만 들어맞아야 한다.
  좋은 예: "경쟁사 A의 무료화 대응 — 우리도 낮출까 버틸까"
  나쁜 예: "마케팅 전략 점검"(막연·아무 데나 붙음 → 금지)
- hook 은 "왜 지금" 한 줄. 위 자료의 어떤 사실을 가리키는지 구체적으로.
- category 는 competitor / issue / market / risk 중 하나.
- 데이터에 없는 수치·사실을 지어내지 말 것.
- 모든 텍스트는 한국어.`;
}
