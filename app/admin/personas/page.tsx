import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Lock, Plus } from 'lucide-react';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { isAdminEnabled, isAuthenticated } from '@/lib/admin/auth';
import { isEditEnabled } from '@/lib/admin/github';
import { PERSONAS } from '@/lib/prompts/personas';

export const dynamic = 'force-dynamic';

/**
 * 페르소나 목록 — 읽기 전용 (Phase 2).
 * Phase 3에서 편집 기능 추가 예정.
 */
export default function AdminPersonasPage() {
  if (!isAdminEnabled()) redirect('/admin');
  if (!isAuthenticated()) redirect('/admin/login');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin"
          className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text"
        >
          <ArrowLeft className="size-3.5" />
          대시보드
        </Link>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-text">페르소나 ({PERSONAS.length})</h1>
          {isEditEnabled() ? (
            <Link
              href="/admin/personas/new"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <Plus className="size-3.5" />
              새 페르소나
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-text-muted">
              <Lock className="size-3" /> 읽기 전용
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted">
          {isEditEnabled()
            ? '항목을 눌러 상세 보기 → 편집 버튼으로 진입하세요. 저장 시 GitHub commit + Vercel 자동 재배포.'
            : 'GITHUB_TOKEN, GITHUB_REPO 환경변수가 설정되면 편집이 활성화됩니다.'}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {PERSONAS.map((p) => (
          <li key={p.id}>
            <Link
              href={`/admin/personas/${p.id}`}
              className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-surface-2"
            >
              <PersonaOrb persona={p} size={40} glow="none" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">{p.name}</p>
                <p className="truncate text-xs text-text-muted">{p.role}</p>
                <p className="mt-1 font-mono text-[10px] text-text-dim">
                  {p.id} · {p.debateStyle}
                  {p.dynamic && ' · dynamic'}
                </p>
              </div>
              <ArrowRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
