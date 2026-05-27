'use client';

import { useEffect, useMemo, useRef } from 'react';

import { MessageCard } from './MessageCard';
import { TypingIndicator } from './TypingIndicator';
import type { Message } from '@/types/debate';
import type { CastMember } from '@/types/persona';

interface DebateFeedProps {
  messages: readonly Message[];
  /**
   * 세션의 전체 캐스트. 발언자 조회의 단일 진실 공급원.
   * Phase B-2 §5.7 — generated/custom 멤버가 등장하므로 PERSONA_MAP 라이브 조회는 안 한다.
   */
  cast: readonly CastMember[];
  /** 현재 발언 생성 중인 멤버 — 보이는 동안 TypingIndicator 표시 */
  thinkingMember: CastMember | null;
  /** 회의 시작 전 안내 — 발언이 아직 없을 때 표시 */
  emptyHint?: string;
}

/**
 * 토론 피드.
 * 메시지 + (있으면) 생각중 인디케이터.
 * 새 메시지가 추가될 때 가장 아래로 자동 스크롤.
 */
export function DebateFeed({
  messages,
  cast,
  thinkingMember,
  emptyHint,
}: DebateFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤 — 메시지 수 또는 생각 중 페르소나 변경 시
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, thinkingMember?.id]);

  /** id → 메시지 매핑 (반박 대상 lookup 용) */
  const messageById = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  /** id → CastMember 매핑 (발언자 조회용) */
  const castMap = useMemo(() => {
    const map = new Map<string, CastMember>();
    for (const c of cast) map.set(c.id, c);
    return map;
  }, [cast]);

  if (messages.length === 0 && !thinkingMember && emptyHint) {
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
          m.speakerId !== null ? (castMap.get(m.speakerId) ?? null) : null;

        let replyTarget: { speakerName: string; preview: string } | null = null;
        if (m.replyTo) {
          const target = messageById.get(m.replyTo);
          if (target && target.speakerId) {
            const tp = castMap.get(target.speakerId);
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

      {thinkingMember && <TypingIndicator persona={thinkingMember} />}

      <div ref={bottomRef} />
    </div>
  );
}
