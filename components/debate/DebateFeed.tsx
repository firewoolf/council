'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { MessageCard } from './MessageCard';
import { TypingIndicator } from './TypingIndicator';
import { cn } from '@/lib/utils';
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

/** 바닥 근처로 판정할 스크롤 임계값(px). */
const NEAR_BOTTOM_PX = 240;

/**
 * 토론 피드.
 *
 * 스크롤 정책 (2026-05-26 — 자동 스크롤 자율화):
 *   - 사용자가 *바닥 근처* 에 있을 때만 새 메시지 도착 시 자동으로 따라간다.
 *   - 사용자가 위로 올려 읽고 있으면 강제 점프 금지. 대신 "↓ N개 새 발언" 배지로 알림.
 *   - 배지 클릭 → 바닥으로 부드럽게 점프. 사용자가 직접 바닥에 가까이 가도 자동 해제.
 *
 * 윈도우 스크롤 기준. DebateFeed 가 자체 스크롤 컨테이너가 아니라
 * 페이지 흐름의 일부이기 때문에 document.scrollingElement / window.scrollY 로 측정.
 */
export function DebateFeed({
  messages,
  cast,
  thinkingMember,
  emptyHint,
}: DebateFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const measureNearBottom = useCallback(() => {
    if (typeof window === 'undefined') return true;
    const doc = document.scrollingElement ?? document.documentElement;
    const distanceFromBottom =
      doc.scrollHeight - (window.scrollY + window.innerHeight);
    return distanceFromBottom < NEAR_BOTTOM_PX;
  }, []);

  // 스크롤 위치 추적 — passive 리스너로 비용 거의 0
  useEffect(() => {
    function onScroll() {
      const atBottom = measureNearBottom();
      setIsNearBottom(atBottom);
      if (atBottom) setUnreadCount(0);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    // 초기값 보정
    setIsNearBottom(measureNearBottom());
    return () => window.removeEventListener('scroll', onScroll);
  }, [measureNearBottom]);

  // 새 메시지 / 생각 중 멤버 변화에 반응
  // 사용자가 바닥 근처면 자동 따라가고, 아니면 unread 누적.
  const prevMessageCount = useRef(messages.length);
  useEffect(() => {
    const delta = messages.length - prevMessageCount.current;
    prevMessageCount.current = messages.length;
    if (delta <= 0) return;

    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
      setUnreadCount((c) => c + delta);
    }
  }, [messages.length, isNearBottom]);

  // 생각 중 멤버는 토론 흐름의 신호 — 바닥 근처면 같이 따라감, 아니면 무시.
  // 의존성에 thinkingMember 객체 전체가 아닌 id 만 — 다른 필드 변경엔 반응 안 함.
  const thinkingId = thinkingMember?.id ?? null;
  useEffect(() => {
    if (!thinkingId) return;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [thinkingId, isNearBottom]);

  const jumpToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setUnreadCount(0);
  }, []);

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

  const showUnreadBadge = !isNearBottom && unreadCount > 0;

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

      {/*
        새 발언 알림 배지 — 사용자가 위로 올려놓고 읽는 동안 새 발언이 쌓이면 표시.
        DebateControls(하단 sticky)와 겹치지 않도록 bottom 여백 유지.
        클릭 시 부드럽게 바닥으로 점프.
      */}
      {showUnreadBadge && (
        <button
          type="button"
          onClick={jumpToBottom}
          className={cn(
            'fixed bottom-28 right-4 z-20 flex items-center gap-1.5 rounded-full',
            'bg-primary px-3 py-2 text-xs font-semibold text-white shadow-lg',
            'transition-transform hover:scale-105 animate-fade-in sm:right-6',
          )}
          aria-label={`아래 ${unreadCount}개 새 발언으로 이동`}
        >
          <ChevronDown className="size-3.5" />
          {unreadCount}개 새 발언
        </button>
      )}
    </div>
  );
}
