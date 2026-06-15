'use client';

import { useState } from 'react';
import { Pin, X } from 'lucide-react';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { cn } from '@/lib/utils';
import type { Message } from '@/types/debate';
import type { Pin as PinType } from '@/types/debate';
import type { CastMember } from '@/types/persona';

interface PinBoardProps {
  pins: PinType[];
  messages: readonly Message[];
  cast: readonly CastMember[];
  onTogglePin: (messageId: string) => void;
  onSetNote: (messageId: string, note: string) => void;
  className?: string;
}

/**
 * I-2 — 핀 보드.
 * 사용자가 마킹한 발언 목록 + 메모 편집 + 핀 해제.
 * 웹: DirectorConsole 안 섹션 / 모바일: bottom sheet 내용으로 재사용.
 */
export function PinBoard({
  pins,
  messages,
  cast,
  onTogglePin,
  onSetNote,
  className,
}: PinBoardProps) {
  const messageById = new Map(messages.map((m) => [m.id, m]));
  const castMap = new Map(cast.map((c) => [c.id, c]));

  if (pins.length === 0) {
    return (
      <p className={cn('text-xs leading-relaxed text-text-muted/80', className)}>
        중요한 발언에 핀을 꽂아보세요. 결론을 만들 때 우선 반영됩니다.
      </p>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {pins.map((pin) => {
        const message = messageById.get(pin.messageId);
        if (!message) return null;
        const speaker = message.speakerId
          ? (castMap.get(message.speakerId) ?? null)
          : null;
        if (!speaker) return null;

        return (
          <PinCard
            key={pin.messageId}
            pin={pin}
            message={message}
            speaker={speaker}
            onUnpin={() => onTogglePin(pin.messageId)}
            onSaveNote={(note) => onSetNote(pin.messageId, note)}
          />
        );
      })}
    </div>
  );
}

function PinCard({
  pin,
  message,
  speaker,
  onUnpin,
  onSaveNote,
}: {
  pin: PinType;
  message: Message;
  speaker: CastMember;
  onUnpin: () => void;
  onSaveNote: (note: string) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [draft, setDraft] = useState(pin.note ?? '');

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-2.5"
      style={{ borderLeftWidth: 3, borderLeftColor: speaker.colorTo }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <PersonaOrb persona={speaker} size={20} glow="none" />
          <span className="text-xs font-semibold text-text truncate">{speaker.name}</span>
        </div>
        <button
          type="button"
          aria-label="핀 해제"
          onClick={onUnpin}
          className="shrink-0 flex size-5 items-center justify-center rounded text-text-muted/50 hover:bg-surface-2 hover:text-destructive transition-colors"
        >
          <X className="size-3" />
        </button>
      </div>
      <p className="line-clamp-3 text-xs leading-relaxed text-text/90">
        {message.content}
      </p>
      {editingNote ? (
        <div className="flex flex-col gap-1">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSaveNote(draft);
                setEditingNote(false);
              }
              if (e.key === 'Escape') {
                setDraft(pin.note ?? '');
                setEditingNote(false);
              }
            }}
            placeholder="메모 (Enter로 저장)"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-text outline-none focus:border-primary"
            autoFocus
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditingNote(true)}
          className={cn(
            'self-start text-[10px] leading-none transition-colors',
            pin.note
              ? 'text-accent hover:text-accent/80'
              : 'text-text-muted/60 hover:text-text-muted',
          )}
        >
          <Pin className="inline size-2.5 mr-0.5" />
          {pin.note ? pin.note : '메모 추가'}
        </button>
      )}
    </div>
  );
}
