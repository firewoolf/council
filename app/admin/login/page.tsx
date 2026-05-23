import { ShieldOff } from 'lucide-react';

import { isAdminEnabled } from '@/lib/admin/auth';

import { LoginFormBoundary } from './LoginForm';

export const dynamic = 'force-dynamic';

/**
 * 어드민 로그인 페이지 (server component).
 * - ADMIN_PASSWORD 미설정: 안내 카드만 표시 — 폼 자체를 숨김.
 * - 설정됨: 클라이언트 LoginForm 렌더 (useSearchParams 대비 Suspense 경계).
 *
 * 미들웨어가 /admin/* 요청을 쿠키 없으면 여기로 보내는데, 환경변수 빠진 채
 * 빈 폼을 표시하면 운영자가 503 만 받고 혼란 → 명시적 비활성 안내가 더 명확.
 */
export default function AdminLoginPage() {
  if (!isAdminEnabled()) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <ShieldOff className="size-10 text-accent" />
          <h1 className="text-2xl font-bold text-text">어드민이 비활성화돼 있습니다</h1>
        </div>
        <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-6 text-sm leading-relaxed text-text-muted">
          <p>
            Vercel 프로젝트 환경변수에{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text">
              ADMIN_PASSWORD
            </code>{' '}
            를 8자 이상으로 설정한 뒤 재배포하세요.
          </p>
          <p>
            편집 기능까지 활성화하려면{' '}
            <code className="rounded bg-surface-2 px-1 font-mono text-xs">
              GITHUB_TOKEN
            </code>
            ,{' '}
            <code className="rounded bg-surface-2 px-1 font-mono text-xs">
              GITHUB_REPO
            </code>{' '}
            도 함께 설정합니다.
          </p>
        </div>
      </section>
    );
  }

  return <LoginFormBoundary />;
}
