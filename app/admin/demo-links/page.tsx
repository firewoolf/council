import { redirect } from 'next/navigation';

import { isAdminEnabled, isAuthenticated } from '@/lib/admin/auth';
import { gateEnabled } from '@/lib/ai/gate';
import { DemoLinkForm } from './DemoLinkForm';

export const dynamic = 'force-dynamic';

export default function AdminDemoLinksPage() {
  if (!isAdminEnabled()) redirect('/admin');
  if (!isAuthenticated()) redirect('/admin/login');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">데모 링크 발급</h1>
        <p className="mt-1 text-sm text-text-muted">
          서명 링크(<code className="font-mono text-xs">?t=&lt;ticket&gt;</code>)로
          접속하면 계정·키 입력 없이 서버 등록 키로 토론이 돕니다. TTL 이 지나면
          링크는 자동 만료됩니다.
        </p>
      </div>
      {gateEnabled() ? (
        <DemoLinkForm />
      ) : (
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-6 text-sm text-text-muted">
          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text">
            COUNCIL_GATE_SECRET
          </code>{' '}
          환경변수가 설정되지 않아 티켓을 발급할 수 없습니다.
        </div>
      )}
    </div>
  );
}
