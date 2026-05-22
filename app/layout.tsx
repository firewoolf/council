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
  title: 'COUNCIL — 내 고민을 들고 들어가면, 전문가들이 싸워준다',
  description:
    '혼자 결정해야 하는 창업자/1인 개발자를 위한 AI 전문가 패널. 사용자가 감독, AI가 배우.',
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
