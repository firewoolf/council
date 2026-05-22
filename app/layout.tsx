import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Syne } from 'next/font/google';
import { Toaster } from 'sonner';

import './globals.css';

/**
 * Pretendard는 @font-face CDN 방식(globals.css) → 별도 woff2 다운로드 불필요.
 * Syne / JetBrains_Mono 는 Google Fonts 경유.
 */

/** Syne — 영문 디스플레이 타이틀. */
const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
  weight: ['600', '700', '800'],
});

/** JetBrains Mono — 타임스탬프, 기술 요소. */
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'COUNCIL — 전문가 패널과 함께 만드는 결론',
  description:
    '냉정한 투자자, 독설가 개발자, 잡스형 디자이너 — 그리고 레전드들까지. 서로 다른 시각이 충돌하며 가장 단단한 결론으로 수렴합니다. 아부 대신, 팩트와 직설로.',
};

export const viewport: Viewport = {
  themeColor: '#0A0A0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={`${syne.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-text antialiased">
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: 'bg-surface border-border text-text',
            },
          }}
        />
      </body>
    </html>
  );
}
