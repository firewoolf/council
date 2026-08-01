import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Activity, ArrowRight, FileText, History, Users } from 'lucide-react';

import { isAdminEnabled, isAuthenticated } from '@/lib/admin/auth';
import { isEditEnabled } from '@/lib/admin/github';
import { PERSONAS } from '@/lib/prompts/personas';
import { LogoutButton } from './_components/LogoutButton';

export const dynamic = 'force-dynamic';

/**
 * 어드민 대시보드 — 현재 데이터 상태 요약 + 각 관리 페이지 진입.
 */
export default function AdminDashboardPage() {
  if (!isAdminEnabled()) {
    return <AdminDisabledNotice />;
  }
  if (!isAuthenticated()) {
    redirect('/admin/login');
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">대시보드</h1>
          <p className="mt-1 text-sm text-text-muted">
            페르소나와 프롬프트를 관리합니다.
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AdminCard
          href="/admin/personas"
          icon={<Users className="size-5 text-primary" />}
          title="페르소나 관리"
          meta={`${PERSONAS.length}명 등록됨`}
          description="이름·색상·시스템 프롬프트·약점 등 캐릭터 데이터를 관리합니다."
        />
        <AdminCard
          href="/admin/prompts"
          icon={<FileText className="size-5 text-primary" />}
          title="공통 프롬프트"
          meta="굴복 금지 규칙 / 출력 가이드"
          description="모든 페르소나에 공통 적용되는 베이스 프롬프트와 출력 가이드를 관리합니다."
        />
        <AdminCard
          href="/admin/usage"
          icon={<Activity className="size-5 text-primary" />}
          title="토큰 사용량"
          meta="추정 대 실측 / 세션별 원가"
          description="AI 호출의 입력·출력·캐시 토큰과 근사 원가를 확인합니다."
        />
        {isEditEnabled() && (
          <AdminCard
            href="/admin/history"
            icon={<History className="size-5 text-primary" />}
            title="변경 이력"
            meta="GitHub commit 로그"
            description="data/personas.json · data/prompts.json 의 최근 변경 이력을 한 화면에서 확인합니다."
          />
        )}
      </div>
    </div>
  );
}

function AdminCard({
  href,
  icon,
  title,
  meta,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  meta: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/40 hover:bg-surface-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-semibold text-text">{title}</h2>
        </div>
        <ArrowRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <p className="font-mono text-[11px] text-text-muted">{meta}</p>
      <p className="text-xs leading-relaxed text-text-muted">{description}</p>
    </Link>
  );
}

function AdminDisabledNotice() {
  return (
    <div className="mx-auto max-w-prose space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-6">
      <h1 className="text-lg font-semibold text-text">어드민이 비활성화되어 있습니다</h1>
      <p className="text-sm leading-relaxed text-text-muted">
        Vercel 프로젝트 환경변수에{' '}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text">
          ADMIN_PASSWORD
        </code>{' '}
        를 8자 이상으로 설정한 뒤 재배포하세요.
      </p>
    </div>
  );
}
