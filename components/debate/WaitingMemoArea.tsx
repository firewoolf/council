'use client';

import { useState } from 'react';
import { MessageSquarePlus, NotebookPen, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface WaitingMemoAreaProps {
  /**
   * 메모 제출 콜백.
   *   asUtterance=false → 다음 청크의 transcript 끝에 *시그널* 로 1회 주입 (발언 아님)
   *   asUtterance=true  → 즉시 *사용자 발언* 으로 회의록에 추가
   */
  onSubmit: (text: string, opts: { asUtterance: boolean }) => void;
}

const MAX_LEN = 200;

/**
 * ⑤-1f-B — generating 단계 대기 시간 UX.
 *
 * 패널이 다음 청크를 준비하는 동안 사용자가 *시그널* 또는 *발언* 으로 개입.
 *
 *   [시그널] = 메모가 다음 청크 transcript 에 한 줄로 들어가 *방향만* 제공.
 *             패널이 따르지는 않고 참고. 한 번 주입되고 비워짐.
 *   [발언]   = 메모가 사용자 메시지로 회의록에 즉시 추가. 평소 발언과 동일.
 *
 * generating 외 phase 에선 마운트되지 않음 (부모가 가드).
 */
export function WaitingMemoArea({ onSubmit }: WaitingMemoAreaProps) {
  const [text, setText] = useState('');
  const [asUtterance, setAsUtterance] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      toast.error('메모가 너무 짧습니다.');
      return;
    }
    onSubmit(trimmed, { asUtterance });
    toast.success(
      asUtterance
        ? '발언으로 추가했습니다.'
        : '다음 청크에 시그널로 전달됩니다.',
    );
    setText('');
    setSubmitted(true);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-4">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-4 text-text-muted" />
        <p className="text-sm font-semibold text-text">
          대기 시간 활용 — 메모
        </p>
        <span className="ml-auto font-mono text-[10px] text-text-muted">
          패널 준비 중
        </span>
      </div>

      <p className="text-xs leading-relaxed text-text-muted">
        다음 청크에 영향을 줄 *방향 시그널* 을 적어주세요. 발언은 아니지만 패널이
        참고합니다. 직접 *발언으로 격상* 하면 메시지로 회의록에 들어갑니다.
      </p>

      <Textarea
        rows={3}
        placeholder="예: '동물병원 SaaS 부분은 일단 미뤄두고, 본업 약사 유지 시나리오를 더 파줘'"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (submitted) setSubmitted(false);
        }}
        maxLength={MAX_LEN + 20}
        className="min-h-[72px]"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label
          className={cn(
            'flex cursor-pointer items-center gap-2 text-xs',
            asUtterance ? 'text-primary' : 'text-text-muted',
          )}
        >
          <input
            type="checkbox"
            checked={asUtterance}
            onChange={(e) => setAsUtterance(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          <MessageSquarePlus className="size-3.5" />
          발언으로 격상
        </label>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-mono text-[10px]',
              text.length > MAX_LEN ? 'text-rose-300' : 'text-text-muted',
            )}
          >
            {text.length}/{MAX_LEN}
          </span>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={text.trim().length < 2 || text.length > MAX_LEN}
          >
            <Send className="size-3.5" />
            {asUtterance ? '발언 추가' : '시그널 보내기'}
          </Button>
        </div>
      </div>

      {submitted && (
        <p className="rounded-md bg-primary/5 px-2 py-1 text-[11px] leading-relaxed text-primary">
          ✓ 전달됨. 추가 메모를 적을 수 있습니다.
        </p>
      )}
    </div>
  );
}
