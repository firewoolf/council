'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Settings, ShieldCheck } from 'lucide-react';

import { useHasMounted } from '@/hooks/useHasMounted';
import { isEmbedded } from '@/lib/embed/protocol';
import { cn } from '@/lib/utils';

/**
 * 메인 그룹 크롬(헤더·푸터).
 *
 * 임베드(insight-out iframe)일 때는 council 자체 로고 헤더·푸터를 숨겨
 * "앱 속의 앱" 이질감을 없앤다 — 호스트가 이미 자기 헤더를 갖고 있으므로.
 *
 * SSR 은 항상 비임베드(헤더 표시)로 렌더하고, 마운트 후 isEmbedded 로 전환한다
 * (하이드레이션 불일치 회피). 임베드 시 헤더가 잠깐 보였다 사라질 수 있으나 무해.
 */
export function MainChrome({
  adminEnabled,
  children,
}: {
  adminEnabled: boolean;
  children: React.ReactNode;
}) {
  const mounted = useHasMounted();
  const embedded = mounted && isEmbedded();
  const pathname = usePathname();
  const router = useRouter();
  // 임베드에선 council 헤더(로고→홈)를 숨기므로 뒤로가기 경로가 없다.
  // 세션 화면(/session/*)은 자체 "홈으로"가 있으니 제외하고, 그 외(설정·기록 등)에만 노출.
  const showBack = embedded && !pathname.startsWith('/session');

  return (
    <div
      className={cn(
        'mx-auto flex min-h-screen max-w-2xl flex-col px-4 sm:px-6',
        embedded && 'pt-2',
      )}
    >
      {showBack && (
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-1 inline-flex w-fit items-center gap-1 py-1 text-xs text-text-muted transition-colors hover:text-text"
          aria-label="뒤로 가기"
        >
          <ArrowLeft className="size-3.5" />
          뒤로
        </button>
      )}
      {!embedded && (
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
      )}

      <main className={cn('flex-1', embedded ? 'pb-8' : 'pb-16')}>{children}</main>

      {!embedded && (
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
      )}
    </div>
  );
}
