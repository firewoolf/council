'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { DebateFeed } from './DebateFeed';
import { cn } from '@/lib/utils';
import type { DebatePhase } from '@/hooks/useDebate';
import type { ChunkMeta, DirectionAction, Message } from '@/types/debate';
import type { CastMember } from '@/types/persona';

interface TranscriptPanelProps {
  phase: DebatePhase;
  messages: readonly Message[];
  cast: readonly CastMember[];
  chunks: readonly ChunkMeta[];
  onDirect?: (action: DirectionAction) => void;
}

export function TranscriptPanel({
  phase,
  messages,
  cast,
  chunks,
  onDirect,
}: TranscriptPanelProps) {
  const shouldStartExpanded = phase === 'concluded' || phase === 'error';
  const [expanded, setExpanded] = useState(shouldStartExpanded);
  const previousPhaseRef = useRef(phase);
  const userToggledRef = useRef(false);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = phase;

    if (
      !userToggledRef.current &&
      previousPhase !== phase &&
      (phase === 'concluded' || phase === 'error')
    ) {
      setExpanded(true);
    }
  }, [phase]);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => {
          userToggledRef.current = true;
          setExpanded((value) => !value);
        }}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-2"
      >
        <span className="text-sm font-semibold text-text">
          회의록 · {messages.length}개 발언
        </span>
        <ChevronDown
          className={cn(
            'size-4 text-text-muted transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border bg-background/40 p-4">
          <DebateFeed
            messages={messages}
            cast={cast}
            chunks={chunks}
            onDirect={onDirect}
            emptyHint={
              phase === 'idle'
                ? '토론 시작을 누르면 회의록이 쌓입니다.'
                : undefined
            }
          />
        </div>
      )}
    </section>
  );
}
