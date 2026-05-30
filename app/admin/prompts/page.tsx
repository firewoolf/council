import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Pencil } from 'lucide-react';

import { isAdminEnabled, isAuthenticated } from '@/lib/admin/auth';
import { isEditEnabled } from '@/lib/admin/github';
import {
  BASE_PROMPT,
  OUTPUT_HINT,
  STANCE_DIRECTIVES,
  LENS_DIRECTIVES,
  EXPRESSION_DIRECTIVES,
} from '@/lib/prompts/base';

export const dynamic = 'force-dynamic';

/**
 * 공통 프롬프트 (BASE_PROMPT + OUTPUT_HINT + 3축 directive) — 읽기 전용.
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
          {isEditEnabled() ? (
            <Link
              href="/admin/prompts/edit"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <Pencil className="size-3.5" />
              편집
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-text-muted">
              <Lock className="size-3" /> 읽기 전용
            </span>
          )}
        </div>
        <p className="text-xs leading-relaxed text-text-muted">
          모든 페르소나에 공통 적용됩니다.{' '}
          {isEditEnabled()
            ? '편집 시 GitHub commit이 발생하고 Vercel이 자동 재배포합니다.'
            : 'GITHUB_TOKEN, GITHUB_REPO 환경변수 설정 후 편집 가능합니다.'}
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

      {/* Phase E — 3축 directive */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">입장 지시 조각 (stanceDirectives)</h2>
        <p className="text-xs text-text-muted">
          페르소나의 입장 축(advocate/critic/agnostic)에 따라 합성 프롬프트에 삽입됩니다.
        </p>
        {(
          [
            ['advocate', '옹호자'],
            ['critic',   '비판자'],
            ['agnostic', '회의자'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <p className="text-xs font-medium text-text-muted">
              {label} <code className="font-mono text-[10px]">{key}</code>
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text/90">
              {STANCE_DIRECTIVES[key] || '(비어있음)'}
            </pre>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">관점 지시 조각 (lensDirectives)</h2>
        <p className="text-xs text-text-muted">
          페르소나의 관점 축(analyst/empath/pragmatist)에 따라 합성 프롬프트에 삽입됩니다.
        </p>
        {(
          [
            ['analyst',    '분석가'],
            ['empath',     '공감가'],
            ['pragmatist', '실용가'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <p className="text-xs font-medium text-text-muted">
              {label} <code className="font-mono text-[10px]">{key}</code>
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text/90">
              {LENS_DIRECTIVES[key] || '(비어있음)'}
            </pre>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">표현 지시 조각 (expressionDirectives)</h2>
        <p className="text-xs text-text-muted">
          페르소나의 표현 축(provocateur/measured)에 따라 합성 프롬프트에 삽입됩니다.
        </p>
        {(
          [
            ['provocateur', '도발가'],
            ['measured',    '측정자'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <p className="text-xs font-medium text-text-muted">
              {label} <code className="font-mono text-[10px]">{key}</code>
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text/90">
              {EXPRESSION_DIRECTIVES[key] || '(비어있음)'}
            </pre>
          </div>
        ))}
      </section>
    </div>
  );
}
