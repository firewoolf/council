/**
 * MI 클라이언트 헬퍼 — 브라우저에서 COUNCIL 자체 프록시(/api/mi)를 호출하고,
 * MI 번들을 (1) 페르소나 설계용 고민 증강, (2) 토론 근거 블록, (3) 배너 소스로 가공.
 */

import {
  EMPTY_MI_BUNDLE,
  isMiBundleEmpty,
  type MiBundle,
} from '@/lib/mi/types';
import type { TopicProposal } from '@/lib/prompts/topic-proposer';

export interface LoadMiResult {
  configured: boolean;
  bundle: MiBundle;
}

/** COUNCIL 프록시로 MI 번들 조회. 실패·미설정 시 빈 번들. */
export async function loadMiBundle(query?: string): Promise<LoadMiResult> {
  const fallback: LoadMiResult = {
    configured: false,
    bundle: { ...EMPTY_MI_BUNDLE, query: query ?? null },
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const url = new URL('/api/mi', window.location.origin);
    if (query) url.searchParams.set('q', query);
    const res = await fetch(url.toString());
    if (!res.ok) return fallback;
    return (await res.json()) as LoadMiResult;
  } catch {
    return fallback;
  }
}

function competitorNames(bundle: MiBundle): string[] {
  return bundle.entities
    .filter((e) => e.isCompetitor)
    .map((e) => e.name);
}

/**
 * 페르소나 패널 설계용 — 고민 텍스트에 MI 브리핑을 덧붙인다.
 * designPanel 이 이 맥락을 반영해 "시장·경쟁 구도를 아는" 패널을 구성하게 만든다.
 */
export function augmentConcernWithMi(concern: string, bundle: MiBundle): string {
  if (isMiBundleEmpty(bundle)) return concern;

  const parts: string[] = [];
  const competitors = competitorNames(bundle);
  if (competitors.length > 0) {
    parts.push(`· 추적 중인 경쟁사: ${competitors.join(', ')}`);
  }
  if (bundle.issues.length > 0) {
    parts.push(
      `· 시장에서 뜨는 이슈: ${bundle.issues.map((i) => i.title).join(' / ')}`,
    );
  }
  if (bundle.contents.length > 0) {
    const lines = bundle.contents
      .slice(0, 5)
      .map((c) => `  - ${c.title}${c.summary ? `: ${c.summary}` : ''}`)
      .join('\n');
    parts.push(`· 최근 관련 자료:\n${lines}`);
  }

  return `${concern}

[insight-out 마켓 인텔리전스 — 아래 실제 시장 맥락을 전제로 이 고민을 다뤄라]
${parts.join('\n')}

위 맥락을 반영해, 이 시장·경쟁 구도를 실제로 아는 전문가들로 패널을 구성하라.
가능하면 특정 경쟁사·이슈의 관점을 대변하는 페르소나를 포함하라.`;
}

/**
 * 토론 근거 주입용 — 세션에 저장해 매 발언 청크 프롬프트에 붙인다.
 * 페르소나가 실제 insight-out 자료를 근거로 인용하며 토론하게 만든다.
 */
export function buildMiContext(bundle: MiBundle): string {
  if (isMiBundleEmpty(bundle)) return '';

  const blocks: string[] = [];
  const competitors = competitorNames(bundle);
  if (competitors.length > 0) {
    blocks.push(`경쟁사: ${competitors.join(', ')}`);
  }
  if (bundle.issues.length > 0) {
    blocks.push(
      `주요 이슈:\n${bundle.issues
        .map((i) => `- ${i.title}${i.summary ? ` — ${i.summary}` : ''}`)
        .join('\n')}`,
    );
  }
  if (bundle.contents.length > 0) {
    blocks.push(
      `근거 콘텐츠:\n${bundle.contents
        .map((c) => {
          const meta = [c.author, c.publishedAt?.slice(0, 10)]
            .filter(Boolean)
            .join(', ');
          const link = c.url ? ` [${c.url}]` : '';
          return `- ${c.title}${meta ? ` (${meta})` : ''}${
            c.summary ? `: ${c.summary}` : ''
          }${link}`;
        })
        .join('\n')}`,
    );
  }

  return blocks.join('\n\n');
}

/**
 * 규칙 기반 주제 제안 폴백 — LLM 불가(키 없음·실패) 시 MI 번들에서 직접 템플릿.
 * 뜨는 이슈 + 경쟁사에서 결정형 주제를 만든다. (LLM 만큼 날카롭진 않지만 항상 동작.)
 */
export function fallbackTopics(bundle: MiBundle): TopicProposal[] {
  const out: TopicProposal[] = [];

  for (const issue of bundle.issues.slice(0, 3)) {
    out.push({
      title: `${issue.title} — 지금 대응할까, 지켜볼까`,
      hook: issue.summary ?? '시장에서 부상 중인 이슈. 대응 시점 판단이 필요하다.',
      category: 'issue',
    });
  }

  const competitors = bundle.entities.filter((e) => e.isCompetitor).slice(0, 2);
  for (const c of competitors) {
    out.push({
      title: `경쟁사 ${c.name} 동향 대응 — 따라갈까, 버틸까`,
      hook: `${c.name} 관련 움직임이 감지됨(언급 ${c.mentionCount}회). 우리 대응 방향 결정.`,
      category: 'competitor',
    });
  }

  return out.slice(0, 5);
}

/** 배너 표시용 소스 목록 (제목 + 링크) */
export function miSources(bundle: MiBundle): { title: string; url?: string }[] {
  return bundle.contents.map((c) => ({
    title: c.title,
    url: c.url ?? undefined,
  }));
}
