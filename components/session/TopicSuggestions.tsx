'use client';

import { useEffect, useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

import { proposeTopics } from '@/lib/ai/client';
import { runWithFallback } from '@/lib/ai/runWithFallback';
import { resolveKeys } from '@/lib/ai/access';
import { listAvailableProviders } from '@/lib/ai/providers';
import { fallbackTopics, loadMiBundle } from '@/lib/mi/client';
import { isMiBundleEmpty } from '@/lib/mi/types';
import {
  categoryLabel,
  type TopicProposal,
} from '@/lib/prompts/topic-proposer';
import { useHasMounted } from '@/hooks/useHasMounted';

/**
 * MI 능동 주제 제안 브리핑 (레벨 1+2).
 *
 * 진입 시 insight-out MI 를 읽어 "지금 토론할 결정거리"를 카드로 제안한다.
 * LLM 사용 가능하면 날카로운 제안, 아니면 규칙 기반 폴백. 카드 클릭 → 그 주제로 토론 시작.
 * MI 미설정/빈 데이터면 아무것도 렌더하지 않는다(방해 없음).
 */
export function TopicSuggestions({
  onPick,
}: {
  onPick: (concern: string) => void;
}) {
  const mounted = useHasMounted();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<TopicProposal[]>([]);
  const [sources, setSources] = useState<{ title: string; url?: string }[]>([]);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    (async () => {
      const { configured, bundle } = await loadMiBundle();
      if (cancelled) return;
      if (!configured || isMiBundleEmpty(bundle)) {
        setLoading(false);
        return;
      }
      setSources(
        bundle.contents
          .slice(0, 4)
          .map((c) => ({ title: c.title, url: c.url ?? undefined })),
      );

      // LLM 제안 시도 → 실패/무키 시 규칙 폴백
      const keys = resolveKeys();
      if (listAvailableProviders(keys).length > 0) {
        try {
          const { result } = await runWithFallback(
            'recommend',
            keys,
            (provider, apiKey) => proposeTopics({ provider, apiKey, mi: bundle }),
          );
          if (!cancelled && result.length > 0) {
            setProposals(result);
            setLoading(false);
            return;
          }
        } catch {
          /* 폴백으로 */
        }
      }
      if (!cancelled) {
        setProposals(fallbackTopics(bundle));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  if (!mounted || (!loading && proposals.length === 0)) return null;

  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-semibold text-text">
          insight-out가 뽑은 지금 토론할 거리
        </h2>
      </div>
      <p className="mt-1 text-xs text-text-muted">
        마켓 인텔리전스에서 자동 제안 — 클릭하면 그 주제로 바로 토론이 시작됩니다.
      </p>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
          <span className="inline-flex gap-0.5">
            <Dot d={0} />
            <Dot d={150} />
            <Dot d={300} />
          </span>
          MI에서 토론거리 뽑는 중…
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {proposals.map((p, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onPick(p.title)}
                className="group flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary/50 hover:bg-surface-2"
              >
                <span className="mt-0.5 shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {categoryLabel(p.category)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-text">
                    {p.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">
                    {p.hook}
                  </span>
                </span>
                <ArrowRight className="mt-1 size-4 shrink-0 text-text-muted/40 transition-colors group-hover:text-primary" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {sources.length > 0 && !loading && (
        <div className="mt-3 border-t border-border/60 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted/70">
            근거 자료
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {sources.map((s, i) => (
              <li key={i} className="truncate text-[11px] text-text-muted">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-primary/30 underline-offset-2 hover:text-primary"
                  >
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Dot({ d }: { d: number }) {
  return (
    <span
      className="inline-block size-1 animate-pulse rounded-full bg-primary"
      style={{ animationDelay: `${d}ms` }}
    />
  );
}
