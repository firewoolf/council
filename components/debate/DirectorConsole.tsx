'use client';

import { useState } from 'react';
import { Loader2, MessageSquarePlus, Pin } from 'lucide-react';
import { toast } from 'sonner';

import { DebateControls } from './DebateControls';
import { NextDirections } from './NextDirections';
import { PinBoard } from './PinBoard';
import { SpeechComposer } from './SpeechComposer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { playSound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import type { DebatePhase, PlaybackSpeed } from '@/hooks/useDebate';
import type { ChunkMeta, Message } from '@/types/debate';
import type { Pin as PinType } from '@/types/debate';
import type { CastMember } from '@/types/persona';

interface DirectorConsoleProps {
  phase: DebatePhase;
  currentChunk: ChunkMeta | null;
  isPaused: boolean;
  speed: PlaybackSpeed;
  progress: { revealed: number; total: number };
  isStreaming: boolean;
  onChooseTopic: (label: string, hook?: string) => void;
  onCustomTopic: (text: string) => void;
  onConclude: () => void;
  onSubmitSpeech: (text: string, opts: { asUtterance: boolean }) => void;
  onStart: () => void;
  onPlay: () => void;
  onPause: () => void;
  onSetSpeed: (s: PlaybackSpeed) => void;
  onSkipTurn: () => void;
  /** I-2 — 핀 보드 데이터. */
  pins?: PinType[];
  messages?: readonly Message[];
  cast?: readonly CastMember[];
  onTogglePin?: (messageId: string) => void;
  onSetPinNote?: (messageId: string, note: string) => void;
}

/**
 * 트랙 R-1.5b — 디렉터 콘솔 (웹 우측 패널).
 *
 * ① 다음 방향  — steering 시 갈림길 칩(NextDirections)+직접 입력 / 그 외 "장면 진행 중" 상태.
 * ② 내 발언 작성 — SpeechComposer (토론 진행 중 상시).
 * ③ 재생 컨트롤 — DebateControls 콘솔 하단 고정 (모바일과 공유).
 *
 * "보면서 동시에 조향" — 피드가 재생되는 동안 여기서 발언·방향을 입력한다.
 */
export function DirectorConsole({
  phase,
  currentChunk,
  isPaused,
  speed,
  progress,
  isStreaming,
  onChooseTopic,
  onCustomTopic,
  onConclude,
  onSubmitSpeech,
  onStart,
  onPlay,
  onPause,
  onSetSpeed,
  onSkipTurn,
  pins = [],
  messages = [],
  cast = [],
  onTogglePin,
  onSetPinNote,
}: DirectorConsoleProps) {
  const isSteering = phase === 'steering' && currentChunk !== null;
  const speechActive =
    phase !== 'idle' && phase !== 'concluded' && phase !== 'error';
  const lastTopic =
    currentChunk && currentChunk.topic !== '_first' ? currentChunk.topic : null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-surface/60 p-4">
      {/* ① 다음 방향 */}
      <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          다음 방향
        </h2>
        {isSteering ? (
          <>
            <NextDirections
              topics={currentChunk.nextTopics}
              onChoose={onChooseTopic}
              onConclude={onConclude}
            />
            <CustomTopicInput onSubmit={onCustomTopic} />
          </>
        ) : (
          <DirectionStatus phase={phase} lastTopic={lastTopic} />
        )}
      </section>

      {/* ② 내 발언 작성 */}
      {speechActive && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            내 발언
          </h2>
          <SpeechComposer onSubmit={onSubmitSpeech} />
        </section>
      )}

      {/* ④ 핀 보드 — I-2 */}
      {onTogglePin && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <Pin className="size-3" />
            핀
            {pins.length > 0 && (
              <span className="ml-auto rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                {pins.length}
              </span>
            )}
          </h2>
          <div className="max-h-56 overflow-y-auto">
            <PinBoard
              pins={pins}
              messages={messages}
              cast={cast}
              onTogglePin={onTogglePin}
              onSetNote={onSetPinNote ?? (() => {})}
            />
          </div>
        </section>
      )}

      {/* ③ 재생 컨트롤 — 하단 고정 */}
      <div className="border-t border-border pt-3">
        <DebateControls
          embedded
          phase={phase}
          isPaused={isPaused}
          speed={speed}
          progress={progress}
          isStreaming={isStreaming}
          onStart={onStart}
          onPlay={onPlay}
          onPause={onPause}
          onSetSpeed={onSetSpeed}
          onSkipTurn={onSkipTurn}
        />
      </div>
    </div>
  );
}

/** steering 이 아닐 때 ① 영역에 표시하는 진행 상태 + 직전 선택. */
function DirectionStatus({
  phase,
  lastTopic,
}: {
  phase: DebatePhase;
  lastTopic: string | null;
}) {
  if (phase === 'concluded') {
    return (
      <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm text-text-muted">
        토론이 종결되었습니다.
      </div>
    );
  }

  const label =
    phase === 'concluding'
      ? '결론 정리 중'
      : phase === 'error'
        ? '오류로 멈춤'
        : phase === 'idle'
          ? '토론 시작을 기다리는 중'
          : '장면 진행 중';

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-text-muted">
        {phase !== 'idle' && phase !== 'error' && (
          <Loader2 className="size-3.5 animate-spin text-primary" />
        )}
        {label}
      </p>
      {lastTopic && (
        <p className="text-xs leading-relaxed text-text-muted/80">
          진행 중인 방향 ·{' '}
          <span className="text-text/90">{lastTopic}</span>
        </p>
      )}
      <p className="text-[11px] leading-relaxed text-text-muted/70">
        청크가 끝나면 다음 갈림길이 여기에 나타납니다.
      </p>
    </div>
  );
}

/** 갈림길에서 직접 소주제를 입력. 구 갈림길 패널의 직접 입력 패턴을 콘솔에 흡수. */
function CustomTopicInput({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  function submit() {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      toast.error('소주제가 너무 짧습니다.');
      return;
    }
    playSound('steering-decide');
    onSubmit(trimmed);
    setText('');
    setOpen(false);
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="self-start text-text-muted hover:text-text"
      >
        <MessageSquarePlus className="size-3.5" />
        직접 입력
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        rows={2}
        placeholder="파고 싶은 소주제를 직접 적어주세요."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={cn('min-h-[56px]')}
      />
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setText('');
          }}
        >
          취소
        </Button>
        <Button size="sm" onClick={submit} disabled={!text.trim()}>
          이 방향으로
        </Button>
      </div>
    </div>
  );
}
