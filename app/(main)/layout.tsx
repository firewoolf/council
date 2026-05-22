import Link from 'next/link';
import { Settings } from 'lucide-react';

/**
 * 메인 그룹 레이아웃.
 * 상단 미니 헤더 (로고 + 설정 버튼) + 본문.
 *
 * 모바일 퍼스트 — 좌우 패딩 16px, 최대 너비 640px.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    </div>
  );
}
