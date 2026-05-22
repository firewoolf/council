'use client';

import { useEffect, useMemo, useRef } from 'react';

import { MessageCard } from './MessageCard';
import { TypingIndicator } from './TypingIndicator';
import { PERSONA_MAP } from '@/lib/prompts/personas';
import type { Message } from '@/types/debate';
import type { Persona } from '@/types/persona';

interface DebateFeedProps {
  messages: readonly Message[];
  /** 현재 발언 생성 중인 페르소나 — 보이는 동안 TypingIndicator 표시 */
  thinkingPersona: Persona | null;
  /** 회의 시작 전 안내 — 발언이 아직 없을 때 표시 */
  emptyHint?: string;
}

/**
 * 토론 피드.
 * 메시지 + (있으면) 생각중 인디케이터.
 * 새 메시지가 추가될 때 가장 아래로 자동 스크롤.
 */
export function DebateFeed({ messages, thinkingPersona, emptyHint }: DebateFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤 — 메시지 수 또는 생각 중 페르소나 변경 시
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, thinkingPersona?.id]);

  /** id 마지막 6자 → 메시지 매핑 (반박 대상 lookup 용) */
  const messageById = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  if (messages.length === 0 && !thinkingPersona && emptyHint) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center">
        <p className="text-sm leading-relaxed text-text-muted">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => {
        const speaker =
          m.speakerId !== null ? (PERSONA_MAP[m.speakerId] ?? null) : null;

        let replyTarget: { speakerName: string; preview: string } | null = null;
        if (m.replyTo) {
          const target = messageById.get(m.replyTo);
          if (target && target.speakerId) {
            const tp = PERSONA_MAP[target.speakerId];
            if (tp) {
              replyTarget = {
                speakerName: tp.name,
                preview:
                  target.content.length > 24
                    ? `${target.content.slice(0, 22)}…`
                    : target.content,
              };
            }
          }
        }

        return (
          <MessageCard
            key={m.id}
            message={m}
            speaker={speaker}
            replyTarget={replyTarget}
          />
        );
      })}

      {thinkingPersona && <TypingIndicator persona={thinkingPersona} />}

      <div ref={bottomRef} />
    </div>
  );
}
