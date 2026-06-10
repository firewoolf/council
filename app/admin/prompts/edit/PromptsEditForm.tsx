'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { promptsSchema, type PromptsInput } from '@/lib/admin/schemas';

interface Props {
  initial: PromptsInput;
}

export function PromptsEditForm({ initial }: Props) {
  const router = useRouter();
  const [commitInfo, setCommitInfo] = useState<{ url: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PromptsInput>({
    resolver: zodResolver(promptsSchema),
    defaultValues: initial,
  });

  async function onSubmit(values: PromptsInput) {
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '저장 실패');
      setCommitInfo({ url: data.commitUrl });
      toast.success('GitHub commit 완료. 1-2분 후 반영.');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="space-y-1.5">
        <Label>BASE_PROMPT</Label>
        <p className="text-xs text-text-muted">
          모든 페르소나 시스템 프롬프트 앞에 prepend 됩니다.
        </p>
        <Textarea
          {...register('basePrompt')}
          rows={16}
          className="font-mono text-xs leading-relaxed"
        />
        {errors.basePrompt && (
          <p className="text-xs text-destructive">{errors.basePrompt.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>OUTPUT_HINT</Label>
        <p className="text-xs text-text-muted">
          generateObject 호출 시 모델에게 출력 톤·필드 의미를 안내합니다.
        </p>
        <Textarea
          {...register('outputHint')}
          rows={10}
          className="font-mono text-xs leading-relaxed"
        />
        {errors.outputHint && (
          <p className="text-xs text-destructive">{errors.outputHint.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>CHUNK_SYSTEM_PROMPT</Label>
        <p className="text-xs text-text-muted">
          청크 작가의 충돌 원칙, 보이스 카드 헌장, 장면 비트를 정의합니다.
        </p>
        <Textarea
          {...register('chunkSystemPrompt')}
          rows={28}
          className="font-mono text-xs leading-relaxed"
        />
        {errors.chunkSystemPrompt && (
          <p className="text-xs text-destructive">
            {errors.chunkSystemPrompt.message}
          </p>
        )}
      </div>

      {/* Phase E — 3축 directive */}
      <div className="space-y-3">
        <div>
          <Label>입장 지시 조각 (stanceDirectives)</Label>
          <p className="text-xs text-text-muted">
            페르소나의 *입장 축* (advocate/critic/agnostic) 에 따라 합성 프롬프트에 삽입되는 한 단락.
          </p>
        </div>
        {(
          [
            ['advocate', '옹호자 (추진/찬성)'],
            ['critic',   '비판자 (반대/제동)'],
            ['agnostic', '회의자 (전제 의심)'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <Label className="text-xs">
              {label} <code className="font-mono text-[10px] text-text-muted">{key}</code>
            </Label>
            <Textarea
              {...register(`stanceDirectives.${key}` as const)}
              rows={4}
              className="font-mono text-xs leading-relaxed"
            />
            {errors.stanceDirectives?.[key] && (
              <p className="text-xs text-destructive">
                {errors.stanceDirectives[key]?.message}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <Label>관점 지시 조각 (lensDirectives)</Label>
          <p className="text-xs text-text-muted">
            페르소나의 *관점 축* (analyst/empath/pragmatist) 에 따라 삽입되는 한 단락.
          </p>
        </div>
        {(
          [
            ['analyst',    '분석가 (데이터/구조)'],
            ['empath',     '공감가 (사람/감정)'],
            ['pragmatist', '실용가 (업계 현실)'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <Label className="text-xs">
              {label} <code className="font-mono text-[10px] text-text-muted">{key}</code>
            </Label>
            <Textarea
              {...register(`lensDirectives.${key}` as const)}
              rows={4}
              className="font-mono text-xs leading-relaxed"
            />
            {errors.lensDirectives?.[key] && (
              <p className="text-xs text-destructive">
                {errors.lensDirectives[key]?.message}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <Label>표현 지시 조각 (expressionDirectives)</Label>
          <p className="text-xs text-text-muted">
            페르소나의 *표현 축* (provocateur/measured) 에 따라 삽입되는 한 단락.
          </p>
        </div>
        {(
          [
            ['provocateur', '도발가 (직설/도발)'],
            ['measured',    '측정자 (정중/구조)'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <Label className="text-xs">
              {label} <code className="font-mono text-[10px] text-text-muted">{key}</code>
            </Label>
            <Textarea
              {...register(`expressionDirectives.${key}` as const)}
              rows={4}
              className="font-mono text-xs leading-relaxed"
            />
            {errors.expressionDirectives?.[key] && (
              <p className="text-xs text-destructive">
                {errors.expressionDirectives[key]?.message}
              </p>
            )}
          </div>
        ))}
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
          href="/admin/prompts"
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
