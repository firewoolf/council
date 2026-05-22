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
  onSubmit: (concern: string) => void;
}

const MIN_LENGTH = 20;
const MAX_LENGTH = 1000;

/**
 * 고민 입력 단계.
 * 자유 텍스트 → "AI 분석 시작" 클릭 → 부모가 recommender 호출.
 *
 * UX:
 * - 짧은 문장은 추천 품질 저하 → 최소 20자 가드
 * - 1000자 초과는 토큰 낭비 → 잘라내기 안내
 */
export function ConcernInput({ busy, defaultValue = '', onSubmit }: ConcernInputProps) {
  const [value, setValue] = useState(defaultValue);
  const trimmed = value.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_LENGTH;
  const tooLong = trimmed.length > MAX_LENGTH;
  const canSubmit = !busy && !tooShort && !tooLong && trimmed.length >= MIN_LENGTH;

  function handleSubmit() {
    if (!canSubmit) {
      if (tooShort) toast.error(`최소 ${MIN_LENGTH}자 이상 입력해주세요.`);
      else if (tooLong) toast.error(`${MAX_LENGTH}자를 넘지 않게 줄여주세요.`);
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="space-y-2">
        <h1 className="font-sans text-3xl font-black leading-tight tracking-tight text-text sm:text-4xl">
          어떤 고민을 들고 오셨나요?
        </h1>
        <p className="text-sm leading-relaxed text-text-muted sm:text-base">
          맥락을 충분히 적을수록 더 날카로운 토론이 됩니다. 결정해야 할 것,
          망설이는 이유, 시도해본 것까지 적어주세요.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="concern">고민 내용</Label>
        <Textarea
          id="concern"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          placeholder="예) 1인 SaaS를 만들고 있는데 BYOK로 가야 할지, 처음부터 신용카드 결제를 받아야 할지 모르겠습니다. 사용자 인터뷰 10명까지는 BYOK이 충분하다는 반응이지만, 빠르게 매출을 만드는 게 더 중요하다는 조언도 받았어요. 한 달 안에 결정해야 합니다."
          disabled={busy}
          maxLength={MAX_LENGTH + 50}
          className="min-h-[200px]"
        />
        <div className="flex items-center justify-between text-xs">
          <span
            className={
              tooShort
                ? 'text-destructive'
                : tooLong
                  ? 'text-destructive'
                  : 'text-text-muted'
            }
          >
            {tooShort && `최소 ${MIN_LENGTH}자 이상 — 지금 ${trimmed.length}자`}
            {tooLong && `${MAX_LENGTH}자 초과 — 지금 ${trimmed.length}자`}
            {!tooShort && !tooLong && `${trimmed.length} / ${MAX_LENGTH}`}
          </span>
        </div>
      </div>

      <Button
        size="lg"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="self-stretch sm:self-start"
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            AI가 페르소나를 고르는 중…
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            AI 분석 시작
          </>
        )}
      </Button>
    </section>
  );
}
