import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { isAdminEnabled, isAuthenticated } from '@/lib/admin/auth';
import { isEditEnabled } from '@/lib/admin/github';
import { PERSONA_MAP } from '@/lib/prompts/personas';
import type { PersonaInput } from '@/lib/admin/schemas';

import { PersonaForm } from '@/components/admin/PersonaForm';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default function AdminPersonaEditPage({ params }: Props) {
  if (!isAdminEnabled()) redirect('/admin');
  if (!isAuthenticated()) redirect('/admin/login');

  const persona = PERSONA_MAP[params.id];
  if (!persona) notFound();

  if (!isEditEnabled()) {
    return (
      <div className="mx-auto max-w-prose rounded-xl border border-accent/40 bg-accent/5 p-6">
        <h1 className="text-lg font-semibold text-text">편집이 비활성화됨</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Vercel 환경변수에{' '}
          <code className="rounded bg-surface-2 px-1 font-mono">GITHUB_TOKEN</code>{' '}
          (Contents: Write PAT) 와{' '}
          <code className="rounded bg-surface-2 px-1 font-mono">GITHUB_REPO</code>{' '}
          (owner/repo) 를 설정한 뒤 재배포하세요.
        </p>
      </div>
    );
  }

  // Archetype → PersonaInput (둘은 같은 shape이지만 타입 분리)
  const initial: PersonaInput = {
    id: persona.id,
    name: persona.name,
    role: persona.role,
    coreValue: persona.coreValue,
    debateStyle: persona.debateStyle,
    temperament: persona.temperament,
    nonNegotiable: persona.nonNegotiable,
    weakness: persona.weakness,
    systemPrompt: persona.systemPrompt,
    colorFrom: persona.colorFrom,
    colorTo: persona.colorTo,
    userQuestions: [...persona.userQuestions],
  };

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/admin/personas/${params.id}`}
        className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        페르소나 상세
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-text">{persona.name} 편집</h1>
        <p className="mt-1 text-xs text-text-muted">
          저장 시 GitHub <code className="font-mono">data/personas.json</code> 에
          commit → Vercel 자동 재배포 (약 1~2분).
        </p>
      </div>
      <PersonaForm initial={initial} mode="edit" />
    </div>
  );
}
