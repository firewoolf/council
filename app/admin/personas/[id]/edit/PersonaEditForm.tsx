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

interface Props {
  initial: PersonaInput;
}

export function PersonaEditForm({ initial }: Props) {
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
    // useFieldArray 는 string[] 직접 지원 X — register 로 우회
    name: 'userQuestions' as never,
  });

  async function onSubmit(values: PersonaInput) {
    try {
      const res = await fetch(`/api/admin/personas/${initial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? '저장 실패');
      }
      setCommitInfo({ url: data.commitUrl });
      toast.success('GitHub에 commit 완료. 약 1-2분 후 배포 반영.');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* ID (읽기 전용) */}
      <Field label="ID (변경 불가)" error={errors.id?.message}>
        <Input {...register('id')} readOnly disabled className="font-mono" />
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

      <Field label="반박 스타일" error={errors.debateStyle?.message}>
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

      {/* userQuestions 배열 */}
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

      {/* 동적 여부 */}
      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          {...register('dynamic')}
          className="size-4 accent-primary"
        />
        <span>도메인 동적 주입형 페르소나 (예: 도메인 전문가)</span>
      </label>

      {/* 액션 */}
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
          href={`/admin/personas/${initial.id}`}
          className="rounded-md px-3 py-2 text-center text-sm text-text-muted hover:text-text"
        >
          취소
        </Link>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? '저장 중...' : '저장 + 배포'}
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
