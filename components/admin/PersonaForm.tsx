'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { personaSchema, type PersonaInput } from '@/lib/admin/schemas';

const DEBATE_STYLES: Array<{ value: PersonaInput['debateStyle']; label: string }> = [
  { value: 'data', label: '데이터형' },
  { value: 'cynical', label: '냉소형' },
  { value: 'emotion', label: '감정형' },
  { value: 'experience', label: '경험형' },
  { value: 'structural', label: '구조형' },
  { value: 'sensory', label: '감성형' },
  { value: 'question', label: '질문형' },
  { value: 'data-tactical', label: '데이터+실전' },
  { value: 'industry', label: '업계 현실형' },
  { value: 'facilitator', label: '중재+질문' },
];

const TEMPERAMENTS: Array<{ value: PersonaInput['temperament']; label: string; hint: string }> = [
  { value: 'advocate', label: '옹호가 (advocate)', hint: '추진/실행' },
  { value: 'critic', label: '비판가 (critic)', hint: '리스크/허점' },
  { value: 'analyst', label: '분석가 (analyst)', hint: '데이터/구조' },
  { value: 'provocateur', label: '독설가 (provocateur)', hint: '도발/직설' },
  { value: 'empath', label: '공감가 (empath)', hint: '사람/감정' },
];

interface Props {
  initial: PersonaInput;
  /**
   * - 'edit'  : 기존 페르소나 수정. id는 잠금. PUT /api/admin/personas/[id]
   * - 'create': 새 페르소나 생성. id는 입력 필요. POST /api/admin/personas
   */
  mode: 'create' | 'edit';
}

export function PersonaForm({ initial, mode }: Props) {
  const router = useRouter();
  const [commitInfo, setCommitInfo] = useState<{ url: string } | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PersonaInput>({
    resolver: zodResolver(personaSchema),
    defaultValues: initial,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    // useFieldArray는 string[] 직접 지원 X — register로 우회
    name: 'userQuestions' as never,
  });

  async function onSubmit(values: PersonaInput) {
    const url =
      mode === 'create'
        ? '/api/admin/personas'
        : `/api/admin/personas/${initial.id}`;
    const method = mode === 'create' ? 'POST' : 'PUT';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '저장 실패');
      setCommitInfo({ url: data.commitUrl });
      toast.success(
        mode === 'create'
          ? '페르소나가 생성되었습니다. 1-2분 후 반영.'
          : 'GitHub commit 완료. 1-2분 후 반영.',
      );
      if (mode === 'create') {
        router.push(`/admin/personas/${values.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    }
  }

  const isCreate = mode === 'create';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Field
        label={isCreate ? 'ID (kebab-case, 생성 후 변경 불가)' : 'ID (변경 불가)'}
        error={errors.id?.message}
      >
        <Input
          {...register('id')}
          readOnly={!isCreate}
          disabled={!isCreate}
          className="font-mono"
          placeholder={isCreate ? '예: brand-strategist' : undefined}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="이름" error={errors.name?.message}>
          <Input {...register('name')} />
        </Field>
        <Field label="역할 (한 줄)" error={errors.role?.message}>
          <Input {...register('role')} />
        </Field>
      </div>

      <Field label="핵심 가치관" error={errors.coreValue?.message}>
        <Input {...register('coreValue')} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="절대 양보 안 하는 것" error={errors.nonNegotiable?.message}>
          <Input {...register('nonNegotiable')} />
        </Field>
        <Field label="약점" error={errors.weakness?.message}>
          <Input {...register('weakness')} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="반박 스타일 (debateStyle, 내부 표현)" error={errors.debateStyle?.message}>
          <select
            {...register('debateStyle')}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
          >
            {DEBATE_STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({s.value})
              </option>
            ))}
          </select>
        </Field>
        <Field label="기질 (temperament, 사용자 노출 분류)" error={errors.temperament?.message}>
          <select
            {...register('temperament')}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
          >
            {TEMPERAMENTS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} · {t.hint}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="색상 시작 (#RRGGBB)" error={errors.colorFrom?.message}>
          <Input {...register('colorFrom')} className="font-mono" />
        </Field>
        <Field label="색상 끝 (#RRGGBB)" error={errors.colorTo?.message}>
          <Input {...register('colorTo')} className="font-mono" />
        </Field>
      </div>

      <Field label="시스템 프롬프트" error={errors.systemPrompt?.message}>
        <Textarea
          {...register('systemPrompt')}
          rows={14}
          className="font-mono text-xs leading-relaxed"
        />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>샘플 사용자 질문</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => append('' as never)}
          >
            <Plus className="size-3.5" /> 추가
          </Button>
        </div>
        <ul className="flex flex-col gap-2">
          {fields.map((f, i) => (
            <li key={f.id} className="flex gap-2">
              <Input
                {...register(`userQuestions.${i}` as const)}
                placeholder={`질문 #${i + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(i)}
                disabled={fields.length <= 1}
              >
                <Minus className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
        {errors.userQuestions && (
          <p className="text-xs text-destructive">
            {errors.userQuestions.message ??
              '각 항목을 채우거나 비어있는 항목을 삭제하세요.'}
          </p>
        )}
      </div>


      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-border bg-background/90 px-4 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
        {commitInfo && (
          <a
            href={commitInfo.url}
            target="_blank"
            rel="noreferrer"
            className="mr-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            마지막 commit 보기 <ExternalLink className="size-3" />
          </a>
        )}
        <Link
          href={isCreate ? '/admin/personas' : `/admin/personas/${initial.id}`}
          className="rounded-md px-3 py-2 text-center text-sm text-text-muted hover:text-text"
        >
          취소
        </Link>
        <Button type="submit" disabled={isSubmitting || (!isCreate && !isDirty)}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting
            ? '저장 중...'
            : isCreate
              ? '생성 + 배포'
              : '저장 + 배포'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
