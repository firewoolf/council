'use client';

import { useState } from 'react';
import { Megaphone, Send, User } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type SubmitMode = 'utterance' | 'signal';

interface SpeechComposerProps {
  onSubmit: (text: string, opts: { asUtterance: boolean }) => void;
  compact?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_LEN = 200;

export function SpeechComposer({
  onSubmit,
  compact = false,
  disabled = false,
  placeholder = '패널에게 한마디',
}: SpeechComposerProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<SubmitMode>('utterance');
  const isUtterance = mode === 'utterance';

  function handleSubmit() {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      toast.error('너무 짧습니다.');
      return;
    }
    onSubmit(trimmed, { asUtterance: isUtterance });
    toast.success(
      isUtterance
        ? '발언으로 추가했습니다.'
        : '다음 장면에 시그널로 전달됩니다.',
    );
    setText('');
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        !compact && 'rounded-xl border border-dashed border-border bg-surface/40 p-4',
      )}
    >
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
        <ModeChip
          active={isUtterance}
          onClick={() => setMode('utterance')}
          icon={<User className="size-3.5" />}
          label="발언"
          disabled={disabled}
        />
        <ModeChip
          active={!isUtterance}
          onClick={() => setMode('signal')}
          icon={<Megaphone className="size-3.5" />}
          label="시그널"
          disabled={disabled}
        />
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          rows={compact ? 1 : 3}
          placeholder={
            isUtterance ? placeholder : '다음 장면에 줄 방향 시그널'
          }
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              compact &&
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          maxLength={MAX_LEN + 20}
          disabled={disabled}
          className={cn(
            compact ? 'min-h-10 max-h-24 py-2.5 text-sm' : 'min-h-[72px]',
          )}
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={
            disabled || text.trim().length < 2 || text.length > MAX_LEN
          }
          aria-label={isUtterance ? '발언 보내기' : '시그널 보내기'}
          className="shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </div>

      {!compact && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] leading-relaxed text-text-muted/70">
            {isUtterance
              ? '입력 즉시 회의록의 내 발언으로 표시됩니다.'
              : '다음 장면에 방향으로만 반영됩니다.'}
          </p>
          <span
            className={cn(
              'font-mono text-[10px]',
              text.length > MAX_LEN ? 'text-rose-300' : 'text-text-muted',
            )}
          >
            {text.length}/{MAX_LEN}
          </span>
        </div>
      )}
    </div>
  );
}

function ModeChip({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-text-muted hover:bg-surface-2 hover:text-text',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
