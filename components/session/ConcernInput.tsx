'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ConcernInputProps {
  busy: boolean;
  defaultValue?: string;
  /** clarifying 단계로 넘기기 (AI 다듬기 경로). 없으면 버튼 숨김. */
  onClarify?: (concern: string) => void;
  /** 바로 시작 경로 (recommender 직행). */
  onSubmit: (concern: string) => void;
}

const MIN_LENGTH = 8;
const MAX_LENGTH = 1000;

/**
 * 고민 입력 단계.
 * "AI와 다듬기" → clarifying 단계 / "바로 시작" → analyzing 직행.
 */
export function ConcernInput({
  busy,
  defaultValue = '',
  onClarify,
  onSubmit,
}: ConcernInputProps) {
  const [value, setValue] = useState(defaultValue);
  const trimmed = value.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_LENGTH;
  const tooLong = trimmed.length > MAX_LENGTH;
  const canSubmit = !busy && !tooShort && !tooLong && trimmed.length >= MIN_LENGTH;

  function guard(): boolean {
    if (tooShort) { toast.error(`최소 ${MIN_LENGTH}자 이상 입력해주세요.`); return false; }
    if (tooLong) { toast.error(`${MAX_LENGTH}자를 넘지 않게 줄여주세요.`); return false; }
    if (!canSubmit) return false;
    return true;
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="space-y-2">
        <h1 className="font-sans text-3xl font-black leading-tight tracking-tight text-text sm:text-4xl">
          어떤 고민을 들고 오셨나요?
        </h1>
        <p className="text-sm leading-relaxed text-text-muted sm:text-base">
          한 줄로 시작해도 됩니다 — AI가 되물어 함께 다듬습니다.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="concern">고민 내용</Label>
        <Textarea
          id="concern"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          placeholder="예) 사이드 프로젝트를 유료로 전환할지 고민입니다."
          disabled={busy}
          maxLength={MAX_LENGTH + 50}
          className="min-h-[200px]"
        />
        <div className="flex items-center justify-between text-xs">
          <span
            className={
              tooShort ? 'text-destructive'
              : tooLong ? 'text-destructive'
              : 'text-text-muted'
            }
          >
            {tooShort && `최소 ${MIN_LENGTH}자 이상 — 지금 ${trimmed.length}자`}
            {tooLong && `${MAX_LENGTH}자 초과 — 지금 ${trimmed.length}자`}
            {!tooShort && !tooLong && `${trimmed.length} / ${MAX_LENGTH}`}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {onClarify && (
          <Button
            size="lg"
            onClick={() => { if (guard()) onClarify(trimmed); }}
            disabled={!canSubmit}
            className="flex-1 sm:flex-none"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                준비 중…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                AI와 다듬기
              </>
            )}
          </Button>
        )}
        <Button
          size="lg"
          variant={onClarify ? 'outline' : 'default'}
          onClick={() => { if (guard()) onSubmit(trimmed); }}
          disabled={!canSubmit}
          className="flex-1 sm:flex-none"
        >
          {busy && !onClarify ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              AI가 페르소나를 고르는 중…
            </>
          ) : (
            '바로 시작'
          )}
        </Button>
      </div>
    </section>
  );
}
