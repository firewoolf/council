'use client';

import { useEffect, useMemo, useState } from 'react';
import { CornerDownRight, X } from 'lucide-react';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { Button } from '@/components/ui/button';
import { LENS_LABEL_KR } from '@/lib/prompts/personas';
import { cn } from '@/lib/utils';
import type { ChunkMeta, Message } from '@/types/debate';
import type { CastMember } from '@/types/persona';

interface PersonaDetailDrawerProps {
  /** 드로어에 표시할 멤버 */
  member: CastMember;
  /** 이 멤버의 발언만 (부모가 pre-filter). 시간순 가정. */
  messages: readonly Message[];
  /** replyTo lookup 용 전체 표시 메시지 */
  allMessages: readonly Message[];
  /** 청크 topic 조회용 */
  chunks: readonly ChunkMeta[];
  /** replyTo 발언자 이름 조회용 */
  cast: readonly CastMember[];
  open: boolean;
  onClose: () => void;
}

/**
 * 트랙 ⑤-2b — 페르소나 발언 필터 드로어.
 *
 * 모바일: 하단 bottom sheet (max-h-[80vh], slide-up 진입).
 * 데스크탑(sm+): 우측 side panel (w-[420px], slide-in-right 진입).
 * 닫기: ESC 키 / 배경 오버레이 클릭 / 닫기 버튼.
 *
 * CSS only — motion/framer-motion 금지.
 */
export function PersonaDetailDrawer({
  member,
  messages,
  allMessages,
  chunks,
  cast,
  open,
  onClose,
}: PersonaDetailDrawerProps) {
  // ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // 드로어가 열려있을 때 body 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ⑤-5f-A — 반신 일러스트 (archetype 출신만, 자산 없으면 orb 유지)
  const [portraitLoaded, setPortraitLoaded] = useState(false);
  const [portraitErrored, setPortraitErrored] = useState(false);
  const portraitPath = member.archetypeId
    ? `/personas/portraits/${member.archetypeId}.webp`
    : undefined;
  // showPortrait: 경로가 있고 아직 오류 없음
  const showPortrait = !!(portraitPath && !portraitErrored);

  const messageById = useMemo(() => {
    const m = new Map<string, Message>();
    for (const msg of allMessages) m.set(msg.id, msg);
    return m;
  }, [allMessages]);

  const castById = useMemo(() => {
    const m = new Map<string, CastMember>();
    for (const c of cast) m.set(c.id, c);
    return m;
  }, [cast]);

  const chunkById = useMemo(() => {
    const m = new Map<string, ChunkMeta>();
    for (const c of chunks) m.set(c.id, c);
    return m;
  }, [chunks]);

  if (!open) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 z-[29] animate-fade-in bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 드로어 패널 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${member.name} 발언 모아보기`}
        className={cn(
          // 공통 — 항상 적용
          'drawer-enter fixed z-30 flex flex-col overflow-hidden bg-surface',
          // 모바일: 하단 bottom sheet
          'inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl border-t border-border',
          // 데스크탑: 우측 side panel
          'sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:w-[420px] sm:max-h-none sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0',
        )}
      >
        {/* 모바일 드래그 핸들 힌트 */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* ⑤-5f-A — 반신 일러스트 카드 (이미지 자산 있을 때) */}
        {portraitPath && (
          <div
            className="relative aspect-square w-full shrink-0 overflow-hidden"
            style={{
              // 로딩 중 + 오류 시 페르소나 색 그라디언트가 자리 표시
              background: `linear-gradient(160deg, ${member.colorFrom}, ${member.colorTo})`,
              // 오류 시 섹션 자체를 접음
              display: portraitErrored ? 'none' : undefined,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={portraitPath}
              alt=""
              aria-hidden="true"
              loading="lazy"
              onLoad={() => setPortraitLoaded(true)}
              onError={() => setPortraitErrored(true)}
              className={cn(
                'size-full object-cover transition-opacity duration-500',
                // fix ⓐ: 반신 일러스트 얼굴이 상단 1/3 — center top 정렬
                portraitLoaded ? 'opacity-100' : 'opacity-0',
              )}
              style={{ objectPosition: '50% 20%' }}
            />

            {/* 하단 그라디언트 오버레이 + 이름/역할 */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
              <p className="text-xl font-bold text-white drop-shadow">{member.name}</p>
              <p className="mt-0.5 text-sm text-white/80 drop-shadow">{member.role}</p>
            </div>

            {/* 닫기 버튼 — 이미지 모드에서 우상단 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="닫기"
              className="absolute right-2 top-2 text-white/70 hover:bg-black/30 hover:text-white"
            >
              <X className="size-4" />
            </Button>
          </div>
        )}

        {/* 헤더 — 이미지 없으면 orb 포함, 이미지 있으면 trait 칩만 */}
        <div className="flex shrink-0 items-start gap-4 border-b border-border px-5 pb-4 pt-3 sm:pt-5">
          {/* orb: 이미지 자산 없을 때만 표시 (이미지가 시각 정체성 담당) */}
          {!showPortrait && (
            <PersonaOrb persona={member} size={64} glow="soft" className="shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            {/* 이미지 없을 때만 이름/역할 표시 (이미지 오버레이가 담당) */}
            {!showPortrait && (
              <>
                <p className="text-base font-semibold text-text">{member.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                  {member.role}
                </p>
              </>
            )}
            <div className={cn('flex flex-wrap items-center gap-2', !showPortrait && 'mt-2')}>
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium leading-none"
                style={{
                  color: member.colorTo,
                  background: `${member.colorTo}22`,
                }}
              >
                {LENS_LABEL_KR[member.trait.lens]}
              </span>
              {member.stance && (
                <span className="text-[11px] italic leading-none text-text-muted/80">
                  &ldquo;{member.stance}&rdquo;
                </span>
              )}
            </div>
          </div>
          {/* 닫기 버튼: 이미지 없을 때만 (이미지 모드에서는 portrait 오버레이가 담당) */}
          {!showPortrait && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="shrink-0"
              aria-label="닫기"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        {/* 발언 수 바 */}
        <div className="shrink-0 border-b border-border/50 px-5 py-2">
          <p className="font-mono text-[11px] text-text-muted">
            발언 {messages.length}개
          </p>
        </div>

        {/* 발언 목록 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center p-10">
              <p className="text-center text-sm text-text-muted">
                아직 발언이 없습니다.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {messages.map((m) => {
                // replyTo 대상 lookup
                let replyInfo: { speakerName: string; preview: string } | null =
                  null;
                if (m.replyTo) {
                  const target = messageById.get(m.replyTo);
                  if (target?.speakerId) {
                    const targetSpeaker = castById.get(target.speakerId);
                    if (targetSpeaker) {
                      replyInfo = {
                        speakerName: targetSpeaker.name,
                        preview:
                          target.content.length > 30
                            ? `${target.content.slice(0, 28)}…`
                            : target.content,
                      };
                    }
                  }
                }

                // 청크 topic lookup
                const chunk = m.chunkId ? chunkById.get(m.chunkId) : undefined;
                const topicLabel = chunk
                  ? chunk.topic === '_first'
                    ? '오프닝'
                    : chunk.topic.length > 22
                      ? `${chunk.topic.slice(0, 20)}…`
                      : chunk.topic
                  : null;

                return (
                  <li
                    key={m.id}
                    className="px-5 py-4"
                    style={{
                      borderLeftWidth: 4,
                      borderLeftColor: member.colorTo,
                    }}
                  >
                    {/* 청크 소주제 칩 */}
                    {topicLabel && (
                      <p className="mb-1.5 font-mono text-[10px] text-text-muted/60">
                        # {topicLabel}
                      </p>
                    )}

                    {/* 반박 대상 연결 */}
                    {replyInfo && (
                      <div className="mb-2 flex items-center gap-1.5 text-xs text-accent">
                        <CornerDownRight className="size-3.5 shrink-0" />
                        <span className="font-medium">{replyInfo.speakerName}</span>
                        <span className="text-text-muted">에 반박</span>
                        <span className="truncate text-text-muted/70">
                          &nbsp;&bull;&nbsp;&ldquo;{replyInfo.preview}&rdquo;
                        </span>
                      </div>
                    )}

                    {/* 발언 본문 */}
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                      {m.content}
                    </p>

                    {/* isKeyPoint 뱃지 */}
                    {m.isKeyPoint && (
                      <span className="mt-2 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-semibold text-accent">
                        핵심 발언
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 푸터 */}
        <div className="shrink-0 flex justify-end border-t border-border px-5 py-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </>
  );
}
