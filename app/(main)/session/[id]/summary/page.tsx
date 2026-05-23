'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ListChecks,
  MessageSquare,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { Button } from '@/components/ui/button';
import { PERSONA_MAP } from '@/lib/prompts/personas';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useSessionsStore } from '@/store/sessions';
import type { Archetype as Persona } from '@/types/persona';

/**
 * 결론 화면.
 *
 * 4섹션:
 *   1. 핵심 결론
 *   2. 주요 리스크
 *   3. 페르소나별 최종 입장
 *   4. 추천 액션
 *
 * 결론이 없으면 회의실로 redirect.
 */
export default function SessionSummaryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const mounted = useHasMounted();

  const session = useSessionsStore((s) => s.sessions[id]);
  const conclusion = useSessionsStore((s) => s.conclusions[id]);
  const domain = useSessionsStore((s) => s.domains[id] ?? null);

  const positionEntries = useMemo(() => {
    if (!conclusion) return [] as { persona: Persona; position: string }[];
    return conclusion.personaPositions
      .map((entry) => {
        const persona = PERSONA_MAP[entry.personaId];
        return persona ? { persona, position: entry.position } : null;
      })
      .filter(
        (e): e is { persona: Persona; position: string } => e !== null,
      );
  }, [conclusion]);

  useEffect(() => {
    if (!mounted) return;
    if (!session) {
      toast.error('세션을 찾을 수 없습니다.');
      router.replace('/');
      return;
    }
    if (!conclusion) {
      toast.info('아직 결론이 정리되지 않았습니다.');
      router.replace(`/session/${id}`);
    }
  }, [mounted, session, conclusion, id, router]);

  if (!mounted || !session || !conclusion) {
    return <div className="min-h-[60vh]" aria-hidden />;
  }

  return (
    <div className="flex flex-col gap-8 pt-2">
      <div className="space-y-3">
        <Link
          href={`/session/${id}`}
          className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text"
        >
          <ArrowLeft className="size-3.5" />
          회의실로
        </Link>
        <p className="font-mono text-[11px] uppercase tracking-wider text-primary">
          최종 결론
        </p>
        <h1 className="font-sans text-3xl font-black leading-tight tracking-tight text-text sm:text-4xl">
          {session.title}
        </h1>
      </div>

      {/* 1. 핵심 결론 */}
      <section className="rounded-xl border border-primary/40 bg-primary/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="size-5 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
            핵심 결론
          </h2>
        </div>
        <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-text">
          {conclusion.keyConclusion}
        </p>
      </section>

      {/* 2. 주요 리스크 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            주요 리스크
          </h2>
        </div>
        <ol className="flex flex-col gap-2">
          {conclusion.risks.map((risk, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/20 font-mono text-xs font-bold text-accent">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-text">{risk}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. 페르소나별 최종 입장 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-text" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            페르소나별 입장
          </h2>
        </div>
        <ul className="flex flex-col gap-2">
          {positionEntries.map(({ persona, position }) => (
            <li
              key={persona.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4"
              style={{
                borderLeftWidth: 4,
                borderLeftColor: persona.colorTo,
              }}
            >
              <PersonaOrb persona={persona} size={36} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">
                  {persona.name}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-text/90">
                  {position}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. 추천 액션 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="size-5 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            추천 액션
          </h2>
        </div>
        <ol className="flex flex-col gap-2">
          {conclusion.recommendedActions.map((action, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-primary/30 bg-surface p-4"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-xs font-bold text-primary">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-text">{action}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 액션 */}
      <div className="flex items-center justify-between pt-4">
        <Button asChild variant="outline">
          <Link href={`/session/${id}`}>
            <MessageSquare className="size-4" />
            토론 다시 보기
          </Link>
        </Button>
        <Button asChild>
          <Link href="/session/new">새 회의 시작</Link>
        </Button>
      </div>
    </div>
  );
}
