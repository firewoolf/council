import Link from 'next/link';
import { Settings, ShieldCheck } from 'lucide-react';

import { isAdminEnabled } from '@/lib/admin/auth';

/**
 * 메인 그룹 레이아웃.
 * 상단 미니 헤더 (로고 + 설정 버튼) + 본문 + 작은 푸터.
 *
 * 모바일 퍼스트 — 좌우 패딩 16px, 최대 너비 640px.
 *
 * 푸터에는 운영자(어드민) 진입점이 ADMIN_PASSWORD 설정된 환경에서만 노출된다.
 * 일반 사용자에게는 보이지 않으면서, 운영자 본인은 URL 외울 필요 없게.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminEnabled = isAdminEnabled();

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Link
          href="/"
          className="font-display text-2xl font-extrabold tracking-tighter text-text"
        >
          COUNCIL
        </Link>
        <Link
          href="/settings"
          aria-label="설정"
          className="rounded-md p-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Settings className="size-5" />
        </Link>
      </header>
      <main className="flex-1 pb-16">{children}</main>
      <footer className="flex items-center justify-between gap-3 border-t border-border/60 py-4 text-[11px] text-text-dim">
        <span className="font-mono">COUNCIL · BYOK 모드</span>
        {adminEnabled && (
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 rounded text-text-muted/70 transition-colors hover:text-primary"
          >
            <ShieldCheck className="size-3" />
            운영자
          </Link>
        )}
      </footer>
    </div>
  );
}
