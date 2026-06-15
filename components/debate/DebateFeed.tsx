'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { MessageCard } from './MessageCard';
import { TypingIndicator } from './TypingIndicator';
import { cn } from '@/lib/utils';
import type { DebatePhase, PlaybackSpeed } from '@/hooks/useDebate';
import type { ChunkMeta, DirectionAction, Message } from '@/types/debate';
import type { CastMember } from '@/types/persona';

interface DebateFeedProps {
  /**
   * 렌더 대상 메시지 — useDebate 의 revealedMessages.
   * 재생 진행 분만 포함된다. 새로고침 시엔 전부 들어있다(half-state 없음).
   */
  messages: readonly Message[];
  /** 세션의 전체 캐스트. 발언자 조회의 단일 진실 공급원. */
  cast: readonly CastMember[];
  /** 트랙 ⑤-1 — 세션의 청크 메타. 메시지를 청크 단위로 묶어 렌더하기 위함. */
  chunks: readonly ChunkMeta[];
  /** 회의 시작 전 안내 — 발언이 아직 없을 때 표시 */
  emptyHint?: string;
  /**
   * 트랙 ③ — 카드별 디렉션 전송.
   * 제공 시 페르소나 카드 우상단 ⋯ 버튼이 활성화된다.
   */
  onDirect?: (action: DirectionAction) => void;
  phase?: DebatePhase;
  activeSpeakerId?: string | null;
  thinkingMemberId?: string | null;
  speed?: PlaybackSpeed;
  onAdvance?: () => void;
  onSelectMember?: (memberId: string) => void;
  /** I-2 — 핀된 메시지 ID 집합. */
  pinnedIds?: ReadonlySet<string>;
  /** I-2 — 핀 토글 콜백. */
  onTogglePin?: (messageId: string) => void;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

/** 바닥 근처로 판정할 스크롤 임계값(px). */
const NEAR_BOTTOM_PX = 240;

/**
 * 토론 피드 — 트랙 ⑤-1.
 *
 * 청크 단위 그루핑:
 *   - 같은 chunkId 를 가진 메시지를 한 묶음으로 둘러 렌더.
 *   - 청크 사이에 얇은 separator + (있다면) 청크가 다룬 소주제 칩.
 *   - chunkId 없는 옛 메시지(마이그레이션 무중단)는 "플랫" 섹션 하나로 묶어 위에 표시.
 *
 * 스크롤 정책 (자율화 유지):
 *   - 사용자가 바닥 근처면 새 메시지 도착 시 자동으로 따라감.
 *   - 위로 올려 읽고 있으면 강제 점프 금지 — "↓ N개 새 발언" 배지로 알림.
 *   - 배지 클릭 → 부드럽게 바닥으로.
 *
 * 윈도우 스크롤 기준. DebateFeed 는 자체 스크롤 컨테이너가 아니다.
 */
export function DebateFeed({
  messages,
  cast,
  chunks,
  emptyHint,
  onDirect,
  phase = 'idle',
  activeSpeakerId = null,
  thinkingMemberId = null,
  speed = 1,
  onAdvance,
  onSelectMember,
  pinnedIds,
  onTogglePin,
  scrollContainerRef,
}: DebateFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const measureNearBottom = useCallback(() => {
    if (typeof window === 'undefined') return true;
    const container = scrollContainerRef?.current;
    if (container) {
      return (
        container.scrollHeight - (container.scrollTop + container.clientHeight) <
        NEAR_BOTTOM_PX
      );
    }
    const doc = document.scrollingElement ?? document.documentElement;
    const distanceFromBottom =
      doc.scrollHeight - (window.scrollY + window.innerHeight);
    return distanceFromBottom < NEAR_BOTTOM_PX;
  }, [scrollContainerRef]);

  useEffect(() => {
    function onScroll() {
      const atBottom = measureNearBottom();
      setIsNearBottom(atBottom);
      if (atBottom) setUnreadCount(0);
    }
    const scrollTarget = scrollContainerRef?.current ?? window;
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    setIsNearBottom(measureNearBottom());
    return () => scrollTarget.removeEventListener('scroll', onScroll);
  }, [measureNearBottom, scrollContainerRef]);

  const prevMessageCount = useRef(messages.length);
  useEffect(() => {
    const delta = messages.length - prevMessageCount.current;
    prevMessageCount.current = messages.length;
    if (delta <= 0) return;

    if (isNearBottom) {
      const container = scrollContainerRef?.current;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      } else {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    } else {
      setUnreadCount((c) => c + delta);
    }
  }, [messages.length, isNearBottom, scrollContainerRef]);

  const jumpToBottom = useCallback(() => {
    const container = scrollContainerRef?.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    setUnreadCount(0);
  }, [scrollContainerRef]);

  /** id → 메시지 (반박 대상 lookup) */
  const messageById = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  /** id → CastMember */
  const castMap = useMemo(() => {
    const map = new Map<string, CastMember>();
    for (const c of cast) map.set(c.id, c);
    return map;
  }, [cast]);

  /**
   * ⑤-5a — 멤버별 *첫 발언* 메시지 ID 집합.
   * 회의 전체에서 그 멤버가 처음 말한 카드에만 시그니처 표시.
   */
  const firstSpeakerMessageIds = useMemo(() => {
    const seen = new Set<string>();
    const firsts = new Set<string>();
    for (const m of messages) {
      if (m.speakerId === null) continue;
      if (seen.has(m.speakerId)) continue;
      seen.add(m.speakerId);
      firsts.add(m.id);
    }
    return firsts;
  }, [messages]);

  /**
   * 청크 단위 그루핑.
   * 결과 구조: [{ chunkId: undefined, messages: [...] }, { chunkId: 'xxx', meta, messages: [...] }, ...]
   * chunkId 없는 옛 메시지가 있으면 맨 앞 단일 그룹으로 둔다.
   */
  const groups = useMemo(() => {
    const chunkMetaById = new Map(chunks.map((c) => [c.id, c]));
    const out: {
      key: string;
      meta: ChunkMeta | null;
      messages: Message[];
    }[] = [];

    const ordered = [...messages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    for (const message of ordered) {
      const key = message.chunkId ?? `__flat__-${message.id}`;
      const previous = out[out.length - 1];
      if (previous?.key === key) {
        previous.messages.push(message);
      } else {
        out.push({
          key,
          meta: message.chunkId
            ? (chunkMetaById.get(message.chunkId) ?? null)
            : null,
          messages: [message],
        });
      }
    }

    return out;
  }, [messages, chunks]);

  const showUnreadBadge = !isNearBottom && unreadCount > 0;
  const latestMessageId = messages.reduce<Message | null>((latest, message) => {
    if (!latest) return message;
    return new Date(message.createdAt).getTime() >=
      new Date(latest.createdAt).getTime()
      ? message
      : latest;
  }, null)?.id;
  const thinkingMember = thinkingMemberId
    ? (castMap.get(thinkingMemberId) ?? null)
    : null;

  if (messages.length === 0 && emptyHint) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center">
        <p className="text-sm leading-relaxed text-text-muted">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g, idx) => (
        <section key={g.key} className="flex flex-col gap-3">
          {/* 청크 헤더 — 두 번째 그룹부터 표시 (첫 청크/플랫 그룹은 헤더 없이) */}
          {idx > 0 && g.meta && (
            <div className="flex items-center gap-3 pt-1">
              <div className="h-px flex-1 bg-border" />
              <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
                {chunkLabel(g.meta)}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          <div className="flex flex-col gap-3">
            {g.messages.map((m) => {
              const speaker =
                m.speakerId !== null ? (castMap.get(m.speakerId) ?? null) : null;

              let replyTarget: { speakerName: string; preview: string } | null =
                null;
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
                  showSignature={firstSpeakerMessageIds.has(m.id)}
                  cast={cast}
                  onDirect={onDirect}
                  onSelectMember={onSelectMember}
                  isPinned={pinnedIds?.has(m.id) ?? false}
                  onTogglePin={onTogglePin}
                  isLatest={
                    m.id === latestMessageId &&
                    ((phase === 'playing' && m.speakerId !== null) ||
                      ((phase === 'playing' || phase === 'generating') && m.kind === 'user-choice'))
                  }
                  isActive={m.speakerId === activeSpeakerId}
                  speed={speed}
                  onAdvance={onAdvance}
                />
              );
            })}
          </div>
        </section>
      ))}

      {thinkingMember && phase === 'generating' && (
        <TypingIndicator persona={thinkingMember} />
      )}

      <div ref={bottomRef} />

      {showUnreadBadge && (
        <button
          type="button"
          onClick={jumpToBottom}
          className={cn(
            scrollContainerRef
              ? 'sticky bottom-3 ml-auto'
              : 'fixed bottom-40 right-4 sm:right-6',
            'z-20 flex w-fit items-center gap-1.5 rounded-full',
            'bg-primary px-3 py-2 text-xs font-semibold text-white shadow-lg',
            'transition-transform hover:scale-105 animate-fade-in',
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

function chunkLabel(meta: ChunkMeta): string {
  if (meta.topic === '_first') return '오프닝';
  return meta.topic.length > 24 ? `${meta.topic.slice(0, 22)}…` : meta.topic;
}
