'use client';

import Link from 'next/link';
import { ArrowLeft, Clock, MessageSquare } from 'lucide-react';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { Button } from '@/components/ui/button';
import { PERSONA_MAP } from '@/lib/prompts/personas';
import { useSessionsStore } from '@/store/sessions';
import { useHasMounted } from '@/hooks/useHasMounted';
import type { Persona } from '@/types/persona';

/**
 * 전체 회의 기록.
 * LocalStorage 기반. Supabase 도입 후에는 페이지네이션 + 검색 추가 예정.
 */
export default function HistoryPage() {
  const mounted = useHasMounted();
  const sessions = useSessionsStore((s) => s.sessions);
  const sessionPersonas = useSessionsStore((s) => s.sessionPersonas);

  const all = mounted
    ? Object.values(sessions).sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : -1,
      )
    : [];

  if (!mounted) {
    return <div className="min-h-[60vh]" aria-hidden />;
  }

  if (all.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <Clock className="size-12 text-text-muted" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-text">아직 기록이 없습니다</h1>
          <p className="text-sm text-text-muted">
            첫 회의를 시작하면 여기에 자동으로 쌓입니다.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="size-4" />
            홈으로
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-extrabold tracking-tighter text-text sm:text-4xl">
          회의 기록
        </h1>
        <p className="text-sm text-text-muted">
          총 {all.length}개의 회의가 저장되어 있습니다.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {all.map((session) => {
          const ids = sessionPersonas[session.id] ?? [];
          const personas = ids
            .map((id) => PERSONA_MAP[id])
            .filter((p): p is Persona => Boolean(p))
            .slice(0, 5);
          return (
            <li key={session.id}>
              <Link
                href={`/session/${session.id}`}
                className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-surface-2"
              >
                <div className="flex shrink-0 -space-x-2">
                  {personas.map((p) => (
                    <PersonaOrb
                      key={p.id}
                      persona={p}
                      size={32}
                      glow="none"
                      className="ring-2 ring-surface"
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-text">
                    {session.title}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-text-muted">
                    {session.concern}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
                    <MessageSquare className="size-3" />
                    {new Date(session.createdAt).toLocaleString('ko-KR')}
                    {session.status === 'concluded' && ' · 결론 완료'}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
