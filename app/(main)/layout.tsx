import { EmbedBridge } from '@/components/embed/EmbedBridge';
import { MainChrome } from '@/components/embed/MainChrome';
import { isAdminEnabled } from '@/lib/admin/auth';

/**
 * 메인 그룹 레이아웃.
 * 상단 미니 헤더 (로고 + 설정 버튼) + 본문 + 작은 푸터.
 *
 * 모바일 퍼스트 — 좌우 패딩 16px, 최대 너비 640px.
 *
 * 크롬(헤더·푸터) 렌더는 MainChrome(클라이언트)이 담당 — 임베드(iframe)일 때는
 * council 자체 로고/푸터를 숨겨 호스트(insight-out)에 자연스럽게 녹아들게 한다.
 * 운영자 진입점은 ADMIN_PASSWORD 설정 환경에서만 노출.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminEnabled = isAdminEnabled();

  return (
    <>
      <EmbedBridge />
      <MainChrome adminEnabled={adminEnabled}>{children}</MainChrome>
    </>
  );
}
