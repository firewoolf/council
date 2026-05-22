import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

import { isAdminEnabled, isAuthenticated } from '@/lib/admin/auth';
import { BASE_PROMPT, OUTPUT_HINT } from '@/lib/prompts/base';

export const dynamic = 'force-dynamic';

/**
 * 공통 프롬프트 (BASE_PROMPT + OUTPUT_HINT) — 읽기 전용 (Phase 2).
 * Phase 3에서 편집 활성화.
 */
export default function AdminPromptsPage() {
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text">공통 프롬프트</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-text-muted">
            <Lock className="size-3" /> 읽기 전용
          </span>
        </div>
        <p className="text-xs leading-relaxed text-text-muted">
          모든 페르소나에 공통 적용됩니다.{' '}
          <code className="rounded bg-surface-2 px-1 font-mono text-[11px]">
            data/prompts.json
          </code>{' '}
          을 직접 수정하여 push 하면 자동 배포됩니다.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">BASE_PROMPT</h2>
        <p className="text-xs text-text-muted">
          모든 페르소나 시스템 프롬프트 앞에 prepend. 굴복 금지 등 절대 원칙이
          여기에 들어갑니다.
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-border bg-surface-2 p-4 text-xs leading-relaxed text-text/90">
          {BASE_PROMPT}
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">OUTPUT_HINT</h2>
        <p className="text-xs text-text-muted">
          generateObject 호출 시 모델에게 출력 톤·필드 의미를 알려주는 가이드.
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-border bg-surface-2 p-4 text-xs leading-relaxed text-text/90">
          {OUTPUT_HINT}
        </pre>
      </section>
    </div>
  );
}
