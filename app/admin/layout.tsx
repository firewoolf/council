import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

/**
 * 어드민 전용 레이아웃. (main) 레이아웃과 분리.
 * 헤더에 어드민 표식, 좌측 네비게이션은 각 페이지가 직접 그린다.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface/60 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold text-text"
          >
            <ShieldCheck className="size-4 text-primary" />
            COUNCIL <span className="text-text-muted">/ admin</span>
          </Link>
          <Link
            href="/"
            className="text-xs text-text-muted transition-colors hover:text-text"
          >
            메인으로 →
          </Link>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
