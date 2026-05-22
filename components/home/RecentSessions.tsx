'use client';

import Link from 'next/link';
import { ArrowUpRight, MessageSquare } from 'lucide-react';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { PERSONA_MAP } from '@/lib/prompts/personas';
import { useSessionsStore } from '@/store/sessions';
import { useHasMounted } from '@/hooks/useHasMounted';
import type { Persona } from '@/types/persona';

/**
 * 홈 — 최근 회의 5개 표시.
 * mount 전: skeleton, mount 후 sessions 없으면: 빈 상태, 있으면: 목록.
 */
export function RecentSessions() {
  const mounted = useHasMounted();
  const sessions = useSessionsStore((s) => s.sessions);
  const sessionPersonas = useSessionsStore((s) => s.sessionPersonas);

  const recent = mounted
    ? Object.values(sessions)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 5)
    : [];

  return (
    <section className="mt-12 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-text">최근 회의</h2>
        {mounted && recent.length > 0 && (
          <Link
            href="/history"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            전체 보기
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </div>

      {!mounted ? null : recent.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center">
          <MessageSquare className="mx-auto mb-3 size-6 text-text-muted" />
          <p className="text-sm text-text-muted">
            아직 회의 기록이 없습니다.
            <br />첫 회의를 시작해보세요.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {recent.map((session) => {
            const ids = sessionPersonas[session.id] ?? [];
            const personas = ids
              .map((id) => PERSONA_MAP[id])
              .filter((p): p is Persona => Boolean(p))
              .slice(0, 4);
            return (
              <li key={session.id}>
                <Link
                  href={`/session/${session.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-primary/40 hover:bg-surface-2"
                >
                  <div className="flex -space-x-2">
                    {personas.map((p) => (
                      <PersonaOrb
                        key={p.id}
                        persona={p}
                        size={28}
                        glow="none"
                        className="ring-2 ring-surface"
                      />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      {session.title}
                    </p>
                    <p className="truncate font-mono text-[11px] text-text-muted">
                      {new Date(session.createdAt).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {session.status === 'concluded' && ' · 결론 완료'}
                    </p>
                  </div>
                  <ArrowUpRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
