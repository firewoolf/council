'use client';

import { Flag, Pause, Play, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

export type DebateStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'concluding'
  | 'concluded'
  | 'error';

interface DebateControlsProps {
  status: DebateStatus;
  messageCount: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onConclude: () => void;
}

/**
 * 하단 sticky 컨트롤 바.
 *
 * 상태별 노출:
 *  - idle      : "토론 시작"
 *  - running   : "일시정지" + "결론 내기"
 *  - paused    : "재개" + "결론 내기"
 *  - concluding: 로딩
 *  - concluded : 안내만 (페이지에서 summary 링크 표시)
 *  - error     : "재개" (재시도)
 */
export function DebateControls({
  status,
  messageCount,
  onStart,
  onPause,
  onResume,
  onConclude,
}: DebateControlsProps) {
  if (status === 'concluded') {
    return (
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 px-4 py-3 text-sm text-text-muted">
          <Flag className="size-4 text-primary" />
          결론이 정리되었습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3 sm:px-6">
        <span className="flex-1 font-mono text-xs text-text-muted">
          발언 {messageCount}회
        </span>

        {status === 'idle' && (
          <Button size="default" onClick={onStart}>
            <Play className="size-4" />
            토론 시작
          </Button>
        )}

        {status === 'running' && (
          <>
            <Button size="default" variant="outline" onClick={onPause}>
              <Pause className="size-4" />
              일시정지
            </Button>
            <Button
              size="default"
              variant="secondary"
              onClick={onConclude}
              disabled={messageCount < 3}
            >
              <Flag className="size-4" />
              결론 내기
            </Button>
          </>
        )}

        {status === 'paused' && (
          <>
            <Button size="default" onClick={onResume}>
              <Play className="size-4" />
              재개
            </Button>
            <Button
              size="default"
              variant="secondary"
              onClick={onConclude}
              disabled={messageCount < 3}
            >
              <Flag className="size-4" />
              결론 내기
            </Button>
          </>
        )}

        {status === 'concluding' && (
          <Button size="default" disabled>
            <Loader2 className="size-4 animate-spin" />
            결론 정리 중…
          </Button>
        )}

        {status === 'error' && (
          <Button size="default" onClick={onResume}>
            <Play className="size-4" />
            재시도
          </Button>
        )}
      </div>
    </div>
  );
}
