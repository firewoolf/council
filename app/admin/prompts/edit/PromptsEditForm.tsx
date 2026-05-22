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
