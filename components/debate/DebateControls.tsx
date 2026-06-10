'use client';

import { ChevronRight, Flag, Loader2, Pause, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DebatePhase, PlaybackSpeed } from '@/hooks/useDebate';

export type { DebatePhase } from '@/hooks/useDebate';

interface DebateControlsProps {
  phase: DebatePhase;
  isPaused: boolean;
  speed: PlaybackSpeed;
  /** 현재 청크 안에서 드러난 턴 수 / 전체 턴 수 — 진행 표시용 */
  progress: { revealed: number; total: number };
  isStreaming?: boolean;
  onStart: () => void;
  onPlay: () => void;
  onPause: () => void;
  onSetSpeed: (s: PlaybackSpeed) => void;
  onSkipTurn: () => void;
  embedded?: boolean;
  className?: string;
}

/**
 * 트랙 ⑤-1 — 재생 트랜스포트.
 *
 * phase 별 노출:
 *   - idle       : "토론 시작"
 *   - generating : 로딩 ("토론 준비중")
 *   - playing    : 재생/일시정지 + 속도(1x/2x) + 탭(다음 턴)
 *   - steering   : 갈림길 선택 UI 가 본 컨트롤을 대체 — 여긴 안내 한 줄.
 *   - concluding : 로딩
 *   - concluded  : "결론 정리됨" 안내
 *   - error      : 안내 (재시도는 페이지 상단 에러 배너에서)
 */
export function DebateControls({
  phase,
  isPaused,
  speed,
  progress,
  onStart,
  onPlay,
  onPause,
  onSetSpeed,
  onSkipTurn,
  isStreaming = false,
  embedded = false,
  className,
}: DebateControlsProps) {
  const barProps = { embedded, className };

  if (phase === 'concluded') {
    return (
      <Bar {...barProps}>
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-text-muted">
          <Flag className="size-4 text-primary" />
          결론이 정리되었습니다.
        </div>
      </Bar>
    );
  }

  if (phase === 'idle') {
    return (
      <Bar {...barProps}>
        <span className="flex-1 font-mono text-xs text-text-muted">
          준비 완료
        </span>
        <Button size="default" onClick={onStart}>
          <Play className="size-4" />
          토론 시작
        </Button>
      </Bar>
    );
  }

  if (phase === 'generating') {
    return (
      <Bar {...barProps}>
        <span className="flex flex-1 items-center gap-2 font-mono text-xs text-text-muted">
          <Loader2 className="size-3.5 animate-spin text-primary" />
          토론 준비중
        </span>
      </Bar>
    );
  }

  if (phase === 'concluding') {
    return (
      <Bar {...barProps}>
        <span className="flex flex-1 items-center gap-2 font-mono text-xs text-text-muted">
          <Loader2 className="size-3.5 animate-spin text-primary" />
          결론 정리 중
        </span>
      </Bar>
    );
  }

  if (phase === 'steering') {
    return (
      <Bar {...barProps}>
        <span className="flex-1 font-mono text-xs text-text-muted">
          다음 갈림길을 골라주세요 →
        </span>
      </Bar>
    );
  }

  if (phase === 'error') {
    return (
      <Bar {...barProps}>
        <span className="flex-1 font-mono text-xs text-destructive">
          오류로 일시 정지됨
        </span>
      </Bar>
    );
  }

  // playing
  return (
    <Bar {...barProps}>
      <span className="flex-1 font-mono text-xs text-text-muted">
        {progress.revealed}/{progress.total}{isStreaming ? '+' : ''} 턴
      </span>

      <div className="flex items-center gap-1.5">
        <SpeedToggle current={speed} onChange={onSetSpeed} />

        <Button
          size="default"
          variant="outline"
          onClick={isPaused ? onPlay : onPause}
          aria-label={isPaused ? '재생' : '일시정지'}
        >
          {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
          {isPaused ? '재생' : '일시정지'}
        </Button>

        <Button
          size="default"
          variant="secondary"
          onClick={onSkipTurn}
          aria-label="다음 턴"
        >
          <ChevronRight className="size-4" />
          다음 턴
        </Button>
      </div>
    </Bar>
  );
}

function Bar({
  children,
  embedded,
  className,
}: {
  children: React.ReactNode;
  embedded: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        embedded
          ? 'w-full'
          : 'fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto flex items-center gap-2',
          embedded ? 'w-full py-1' : 'max-w-2xl px-4 py-3 sm:px-6',
        )}
      >
        {children}
      </div>
    </div>
  );
}

function SpeedToggle({
  current,
  onChange,
}: {
  current: PlaybackSpeed;
  onChange: (s: PlaybackSpeed) => void;
}) {
  const next: PlaybackSpeed = current === 1 ? 2 : 1;
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      className={cn(
        'rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs font-semibold transition-colors',
        'hover:border-primary/40 hover:text-primary',
      )}
      aria-label={`재생 속도 ${current}x — 클릭하면 ${next}x`}
    >
      {current}x
    </button>
  );
}
