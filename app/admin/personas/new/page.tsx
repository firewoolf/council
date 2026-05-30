import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { PersonaForm } from '@/components/admin/PersonaForm';
import { isAdminEnabled, isAuthenticated } from '@/lib/admin/auth';
import { isEditEnabled } from '@/lib/admin/github';
import type { PersonaInput } from '@/lib/admin/schemas';

export const dynamic = 'force-dynamic';

/**
 * 새 페르소나 생성 페이지.
 * - 빈 폼 + 합리적 디폴트 (색상 인디고, debateStyle data, 시스템 프롬프트 스켈레톤)
 * - 저장 시 POST /api/admin/personas → GitHub commit
 */
export default function AdminPersonaNewPage() {
  if (!isAdminEnabled()) redirect('/admin');
  if (!isAuthenticated()) redirect('/admin/login');

  if (!isEditEnabled()) {
    return (
      <div className="mx-auto max-w-prose rounded-xl border border-accent/40 bg-accent/5 p-6">
        <h1 className="text-lg font-semibold text-text">편집이 비활성화됨</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Vercel 환경변수에{' '}
          <code className="rounded bg-surface-2 px-1 font-mono">GITHUB_TOKEN</code>,{' '}
          <code className="rounded bg-surface-2 px-1 font-mono">GITHUB_REPO</code>{' '}
          를 설정한 뒤 재배포하세요.
        </p>
      </div>
    );
  }

  const initial: PersonaInput = {
    id: '',
    name: '',
    role: '',
    coreValue: '',
    debateStyle: 'data',
    trait: { stanceAxis: 'agnostic', lens: 'analyst', expression: 'measured' },
    nonNegotiable: '',
    weakness: '',
    systemPrompt:
      '[성격]\n당신은 ___ 전문가다. ___한 관점에서 토론에 참여한다.\n\n[발언 원칙]\n- 150자 이내\n- 구체적 근거와 사례를 들어 반박/제안\n- "맞습니다 대표님" 류 굴복 금지\n\n[당신만의 무기]\n- ___\n- ___',
    colorFrom: '#4C1D95',
    colorTo: '#8B5CF6',
    userQuestions: ['예: 이 분야에서 가장 흔한 실패 케이스는?'],
  };

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/personas"
        className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        페르소나 목록
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-text">새 페르소나</h1>
        <p className="mt-1 text-xs text-text-muted">
          저장 시 GitHub <code className="font-mono">data/personas.json</code> 에
          append → Vercel 자동 재배포 (약 1~2분).
        </p>
      </div>
      <PersonaForm initial={initial} mode="create" />
    </div>
  );
}
