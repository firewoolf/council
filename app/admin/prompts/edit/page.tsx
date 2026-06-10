import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { isAdminEnabled, isAuthenticated } from '@/lib/admin/auth';
import { isEditEnabled } from '@/lib/admin/github';
import {
  BASE_PROMPT,
  OUTPUT_HINT,
  STANCE_DIRECTIVES,
  LENS_DIRECTIVES,
  EXPRESSION_DIRECTIVES,
} from '@/lib/prompts/base';
import { CHUNK_SYSTEM_PROMPT } from '@/lib/prompts/orchestrator';

import { PromptsEditForm } from './PromptsEditForm';

export const dynamic = 'force-dynamic';

export default function AdminPromptsEditPage() {
  if (!isAdminEnabled()) redirect('/admin');
  if (!isAuthenticated()) redirect('/admin/login');

  if (!isEditEnabled()) {
    return (
      <div className="mx-auto max-w-prose rounded-xl border border-accent/40 bg-accent/5 p-6">
        <h1 className="text-lg font-semibold text-text">편집이 비활성화됨</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Vercel 환경변수에{' '}
          <code className="rounded bg-surface-2 px-1 font-mono">GITHUB_TOKEN</code>{' '}
          (Contents: Write PAT) 와{' '}
          <code className="rounded bg-surface-2 px-1 font-mono">GITHUB_REPO</code>{' '}
          (owner/repo) 를 설정한 뒤 재배포하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/prompts"
        className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        공통 프롬프트
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-text">공통 프롬프트 편집</h1>
        <p className="mt-1 text-xs text-text-muted">
          저장 시 GitHub <code className="font-mono">data/prompts.json</code> 에
          commit → Vercel 자동 재배포.
        </p>
      </div>
      <PromptsEditForm
        initial={{
          basePrompt: BASE_PROMPT,
          outputHint: OUTPUT_HINT,
          chunkSystemPrompt: CHUNK_SYSTEM_PROMPT,
          stanceDirectives: STANCE_DIRECTIVES,
          lensDirectives: LENS_DIRECTIVES,
          expressionDirectives: EXPRESSION_DIRECTIVES,
        }}
      />
    </div>
  );
}
