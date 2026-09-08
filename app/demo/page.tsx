import { KeyRound } from 'lucide-react';

import { isDemoEnabled } from '@/lib/demo/auth';
import { DemoLoginForm } from './DemoLoginForm';

export const dynamic = 'force-dynamic';

/**
 * 데모 게이트 진입 페이지 — 트랙 T-3b.
 * 고정 주소(`/demo`) + 비밀번호. 성공하면 demo 티켓을 받아 `/` 로 이동한다.
 *
 * - DEMO_PASSWORD 미설정: 안내 카드만 표시 — 폼 자체를 숨김 (app/admin/login 과 동일 패턴).
 */
export default function DemoGatePage() {
  if (!isDemoEnabled()) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <KeyRound className="size-10 text-accent" />
          <h1 className="text-2xl font-bold text-text">데모 게이트가 비활성화돼 있습니다</h1>
        </div>
        <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-6 text-sm leading-relaxed text-text-muted">
          <p>
            Vercel 프로젝트 환경변수에{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text">
              DEMO_PASSWORD
            </code>{' '}
            를 8자 이상으로,{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text">
              COUNCIL_GATE_SECRET
            </code>{' '}
            을 함께 설정한 뒤 재배포하세요.
          </p>
        </div>
      </section>
    );
  }

  return <DemoLoginForm />;
}
