import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, FileText, GitCommit, Users } from 'lucide-react';

import { isAdminEnabled, isAuthenticated } from '@/lib/admin/auth';
import { GitHubError, isEditEnabled, listCommits, type CommitSummary } from '@/lib/admin/github';

export const dynamic = 'force-dynamic';
// 페이지 자체는 dynamic 이지만, listCommits 내부에 next: { revalidate: 300 } 가 있어
// GitHub API 호출은 5분 캐시.

interface CommitWithKind extends CommitSummary {
  kind: 'personas' | 'prompts';
}

/**
 * 변경 이력 페이지 — data/personas.json + data/prompts.json 두 파일의
 * GitHub commit 이력을 합쳐서 시간 역순으로 표시.
 */
export default async function AdminHistoryPage() {
  if (!isAdminEnabled()) redirect('/admin');
  if (!isAuthenticated()) redirect('/admin/login');

  if (!isEditEnabled()) {
    return (
      <div className="mx-auto max-w-prose space-y-2 rounded-xl border border-accent/40 bg-accent/5 p-6">
        <h1 className="text-lg font-semibold text-text">이력 조회 비활성화</h1>
        <p className="text-sm leading-relaxed text-text-muted">
          GitHub 이력은{' '}
          <code className="rounded bg-surface-2 px-1 font-mono">GITHUB_TOKEN</code>{' '}
          +{' '}
          <code className="rounded bg-surface-2 px-1 font-mono">GITHUB_REPO</code>{' '}
          가 설정돼야 조회됩니다.
        </p>
      </div>
    );
  }

  let commits: CommitWithKind[] = [];
  let errorMsg: string | null = null;

  try {
    const [personas, prompts] = await Promise.all([
      listCommits('data/personas.json', 30),
      listCommits('data/prompts.json', 30),
    ]);
    commits = [
      ...personas.map((c) => ({ ...c, kind: 'personas' as const })),
      ...prompts.map((c) => ({ ...c, kind: 'prompts' as const })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50);
  } catch (err) {
    errorMsg =
      err instanceof GitHubError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'GitHub 이력 조회 실패';
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin"
        className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        대시보드
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-text">변경 이력</h1>
        <p className="mt-1 text-xs text-text-muted">
          <code className="font-mono">data/personas.json</code> ·{' '}
          <code className="font-mono">data/prompts.json</code> 의 GitHub commit
          이력 (최근 50개, 5분 캐시).
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      {!errorMsg && commits.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
          아직 변경 이력이 없습니다.
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {commits.map((c) => (
          <li key={`${c.kind}-${c.sha}`}>
            <CommitCard commit={c} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function CommitCard({ commit }: { commit: CommitWithKind }) {
  const title = commit.message.split('\n')[0] ?? '';
  const body = commit.message.split('\n').slice(1).join('\n').trim();
  const Icon = commit.kind === 'personas' ? Users : FileText;
  const kindLabel = commit.kind === 'personas' ? '페르소나' : '프롬프트';

  return (
    <a
      href={commit.url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-surface-2"
    >
      <GitCommit className="mt-0.5 size-4 shrink-0 text-text-muted group-hover:text-primary" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <Icon className="size-3" />
          <span>{kindLabel}</span>
          <span>·</span>
          <span className="font-mono">{commit.shortSha}</span>
          <span>·</span>
          <span>{new Date(commit.date).toLocaleString('ko-KR')}</span>
          <span className="ml-auto inline-flex items-center gap-0.5 text-text-muted/70 group-hover:text-primary">
            GitHub <ExternalLink className="size-2.5" />
          </span>
        </div>
        <p className="break-words text-sm font-medium text-text">{title}</p>
        {body && (
          <p className="line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-text-muted">
            {body}
          </p>
        )}
        <p className="font-mono text-[10px] text-text-dim">by {commit.author}</p>
      </div>
    </a>
  );
}
