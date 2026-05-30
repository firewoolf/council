'use client';

import { useState } from 'react';
import { Megaphone, NotebookPen, Send, User } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * ⑤-1f-C — 대기 모드 두 가지.
 *
 *   'utterance' = *내 발언* 으로 즉시 회의록에 추가 + 다음 청크가 그것을 받게 함.
 *                 (기본값) 사용자 피드백(2026-05-31): 대기 시간이 비어있지 않게.
 *   'signal'    = 발언 아닌 *방향 시그널*. 다음 청크 transcript 끝에 한 줄로
 *                 들어가 패널이 *참고* 만 함. 회의록에는 안 남음.
 */
type SubmitMode = 'utterance' | 'signal';

interface WaitingMemoAreaProps {
  /**
   * 메모 제출 콜백.
   *   asUtterance=true  → 즉시 사용자 발언 메시지로 회의록 추가 (기본)
   *   asUtterance=false → 발언 아닌 시그널만 다음 청크 transcript 에 1회 주입
   */
  onSubmit: (text: string, opts: { asUtterance: boolean }) => void;
}

const MAX_LEN = 200;

/**
 * generating 단계 대기 시간 UX.
 *
 * 두 모드 토글 (기본 *발언*):
 *   - 내 발언으로 추가  : 화면에 즉시 카드, 다음 청크가 받음. 대기 시간이 *내가
 *     말한 시간* 이 됨. ★ ⑤-1f-C 기본값.
 *   - 시그널만 보내기   : 발언 아닌 방향 제시. 회의록에 안 남고 다음 청크에만 영향.
 *
 * generating 외 phase 에선 마운트되지 않음 (부모가 가드).
 */
export function WaitingMemoArea({ onSubmit }: WaitingMemoAreaProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<SubmitMode>('utterance');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      toast.error('너무 짧습니다.');
      return;
    }
    onSubmit(trimmed, { asUtterance: mode === 'utterance' });
    toast.success(
      mode === 'utterance'
        ? '발언으로 추가했습니다.'
        : '다음 청크에 시그널로 전달됩니다.',
    );
    setText('');
    setSubmitted(true);
  }

  const isUtterance = mode === 'utterance';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-4">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-4 text-text-muted" />
        <p className="text-sm font-semibold text-text">
          대기 시간 활용
        </p>
        <span className="ml-auto font-mono text-[10px] text-text-muted">
          패널 준비 중
        </span>
      </div>

      <p className="text-xs leading-relaxed text-text-muted">
        지금 적은 내용이 즉시 *내 발언* 으로 회의록에 들어가고, 다음 청크가 그것을
        받습니다. 발언 대신 *방향 시그널* 만 주고 싶다면 모드를 바꿔주세요.
      </p>

      {/* 모드 토글 — 발언 / 시그널 */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
        <ModeChip
          active={isUtterance}
          onClick={() => setMode('utterance')}
          icon={<User className="size-3.5" />}
          label="내 발언으로"
        />
        <ModeChip
          active={!isUtterance}
          onClick={() => setMode('signal')}
          icon={<Megaphone className="size-3.5" />}
          label="시그널만"
        />
      </div>

      <Textarea
        rows={3}
        placeholder={
          isUtterance
            ? "예: '동물병원 SaaS 는 일단 미루고, 약사 본업 시나리오를 더 파달라'"
            : "예: '비용 측면을 더 강조해줘' — 발언 아닌 패널 방향 가이드"
        }
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (submitted) setSubmitted(false);
        }}
        maxLength={MAX_LEN + 20}
        className="min-h-[72px]"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] leading-relaxed text-text-muted/70">
          {isUtterance
            ? '입력 즉시 회의록의 내 발언 카드로 표시됩니다.'
            : '회의록에는 남지 않고 다음 청크에만 한 번 영향을 줍니다.'}
        </p>
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
            {isUtterance ? '발언 추가' : '시그널 보내기'}
          </Button>
        </div>
      </div>

      {submitted && (
        <p className="rounded-md bg-primary/5 px-2 py-1 text-[11px] leading-relaxed text-primary">
          ✓ 전달됨. 추가로 적으면 다시 보낼 수 있습니다.
        </p>
      )}
    </div>
  );
}

// ─── ModeChip ────────────────────────────────────────────────────────────────

interface ModeChipProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function ModeChip({ active, onClick, icon, label }: ModeChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
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
