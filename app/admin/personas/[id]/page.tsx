import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';

import { DeletePersonaButton } from '@/components/admin/DeletePersonaButton';
import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { isAdminEnabled, isAuthenticated } from '@/lib/admin/auth';
import { isEditEnabled } from '@/lib/admin/github';
import { PERSONA_MAP, PERSONAS, composePersonaPrompt } from '@/lib/prompts/personas';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default function AdminPersonaDetailPage({ params }: Props) {
  if (!isAdminEnabled()) redirect('/admin');
  if (!isAuthenticated()) redirect('/admin/login');

  const persona = PERSONA_MAP[params.id];
  if (!persona) notFound();

  const composed = composePersonaPrompt(persona, {
    domain: persona.dynamic ? '[동적 주입 예: 핀테크]' : undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/personas"
        className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        페르소나 목록
      </Link>

      {/* 헤더 */}
      <header className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5">
        <PersonaOrb persona={persona} size={56} glow="none" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-text">{persona.name}</h1>
          <p className="text-sm text-text-muted">{persona.role}</p>
          <p className="mt-1 font-mono text-[11px] text-text-dim">
            {persona.id} · {persona.debateStyle}
            {persona.dynamic && ' · dynamic'}
          </p>
        </div>
        {isEditEnabled() && (
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
            <Link
              href={`/admin/personas/${persona.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <Pencil className="size-3.5" />
              편집
            </Link>
            {PERSONAS.length > 1 && (
              <DeletePersonaButton
                personaId={persona.id}
                personaName={persona.name}
              />
            )}
          </div>
        )}
      </header>

      {/* 메타 */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="핵심 가치관" value={persona.coreValue} />
        <Field label="절대 양보 안 하는 것" value={persona.nonNegotiable} />
        <Field label="약점" value={persona.weakness} />
        <Field
          label="색상"
          value={`${persona.colorFrom} → ${persona.colorTo}`}
          mono
        />
      </section>

      {/* 사용자 질문 샘플 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">샘플 사용자 질문</h2>
        <ul className="flex flex-col gap-2">
          {persona.userQuestions.map((q, i) => (
            <li
              key={i}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text/90"
            >
              {q}
            </li>
          ))}
        </ul>
      </section>

      {/* 시스템 프롬프트 (원본) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">시스템 프롬프트 (원본)</h2>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-border bg-surface-2 p-4 text-xs leading-relaxed text-text/90">
          {persona.systemPrompt}
        </pre>
      </section>

      {/* 합성된 최종 프롬프트 미리보기 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">
          최종 합성 프롬프트 (BASE_PROMPT + 캐릭터 + 출력 가이드)
        </h2>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-surface-2 p-4 text-xs leading-relaxed text-text-muted">
          {composed}
        </pre>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="mb-1 text-[11px] uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p
        className={
          mono
            ? 'font-mono text-xs text-text/90'
            : 'text-sm leading-relaxed text-text/90'
        }
      >
        {value}
      </p>
    </div>
  );
}
