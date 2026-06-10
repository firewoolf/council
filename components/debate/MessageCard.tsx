'use client';

import { useState } from 'react';
import { CornerDownRight, Flag, HelpCircle, Megaphone, MoreHorizontal, Sparkles, User } from 'lucide-react';

import { DirectionMenu } from './DirectionMenu';
import { TypewriterText } from './TypewriterText';
import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { LENS_LABEL_KR, SIGNATURE_LINES } from '@/lib/prompts/personas';
import { cn } from '@/lib/utils';
import type { PlaybackSpeed } from '@/hooks/useDebate';
import type { DirectionAction, Message } from '@/types/debate';
import type { CastMember } from '@/types/persona';

interface MessageCardProps {
  message: Message;
  /** 페르소나 발언일 때 그 발언자 CastMember. 사용자 발언이면 null. */
  speaker: CastMember | null;
  /** 반박 대상 메시지의 발언자 (페르소나) — replyTo가 있을 때만 */
  replyTarget?: { speakerName: string; preview: string } | null;
  /**
   * ⑤-5a — 회의 전체에서 이 멤버의 *첫 발언* 이면 true.
   * archetype 이고 SIGNATURE_LINES 에 등록돼 있으면 시그니처 한 줄을 카드 상단에 표시.
   * 부모(DebateFeed)가 멤버별 첫 발언 ID 를 계산해 전달.
   */
  showSignature?: boolean;
  /**
   * 트랙 ③ — 패널 전원 (DirectionMenu rebut 후보용).
   * onDirect 와 함께 제공. 없으면 디렉션 메뉴 비활성.
   */
  cast?: readonly CastMember[];
  /**
   * 트랙 ③ — 디렉션 전송 콜백.
   * 제공 시 페르소나 카드 우상단에 ⋯ 버튼 노출 → DirectionMenu.
   * 사용자 카드·메타지시 카드는 무시.
   */
  onDirect?: (action: DirectionAction) => void;
  onSelectMember?: (memberId: string) => void;
  isLatest?: boolean;
  isActive?: boolean;
  speed?: PlaybackSpeed;
  onAdvance?: () => void;
}

/**
 * 발언 카드.
 *
 * 두 종류:
 *  - 페르소나 발언: 좌측 색띠 + orb + 이름 + 본문 + (선택) 반박 표시
 *  - 사용자 발언: 우측 정렬 / 다른 톤 (회색 surface-2)
 *
 * CLAUDE.md ⓬: 말풍선 디자인 금지 → "카드" 형태로.
 *
 * ⑤-5a 게임화:
 *   · 첫 발언 시 archetype 시그니처 한 줄 (italic, 상단)
 *   · isKeyPoint 발언은 keypoint-pulse 1회 발광 + ★ 마커 (Aha 모먼트)
 */
export function MessageCard({
  message,
  speaker,
  replyTarget,
  showSignature,
  cast,
  onDirect,
  onSelectMember,
  isLatest = false,
  isActive = false,
  speed = 1,
  onAdvance,
}: MessageCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isUser = speaker === null;
  const isInstruction = message.kind === 'instruction';
  const isIntro = message.kind === 'intro';
  // ⋯ 버튼 노출 조건: 페르소나 발언 + onDirect 제공됨 (intro 제외)
  const canDirect = !isUser && !isInstruction && !isIntro && !!onDirect && !!cast;

  // 사용자 메타 지시 — 중앙 정렬 + 다른 톤. 토론과 별개 채널임을 시각적으로 분리.
  if (isInstruction) {
    return (
      <div className="flex justify-center animate-fade-in">
        <div className="flex max-w-[90%] items-start gap-2 rounded-full border border-dashed border-accent/40 bg-accent/5 px-4 py-2">
          <Megaphone className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <p className="text-xs italic leading-relaxed text-accent">
            <span className="mr-1 font-semibold not-italic">메타 지시</span>
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex flex-col items-end animate-fade-in">
        <div className="flex max-w-[85%] flex-col gap-2 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <User className="size-3.5" />
            나
          </div>
          <p className="whitespace-pre-wrap text-base font-normal leading-relaxed text-text">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  if (!speaker) {
    // 안전 가드 — 페르소나 데이터가 사라진 경우
    return null;
  }

  // 트랙 ⑤-2a — 좌측 색띠 두께: 기본 6px, isKeyPoint 8px, intro 10px (시작의 무게)
  const borderLeftWidth = message.isKeyPoint ? 8 : isIntro ? 10 : 6;

  // ⑤-5a — archetype 출신만 시그니처 표시 (generated/custom 은 없음)
  const signature =
    showSignature && speaker.source === 'archetype' && speaker.archetypeId
      ? SIGNATURE_LINES[speaker.archetypeId]
      : undefined;

  return (
    <div className="flex items-start gap-2 animate-card-enter">
      <button
        type="button"
        onClick={() => onSelectMember?.(speaker.id)}
        aria-label={`${speaker.name} 발언 모아보기`}
        className="mt-1 shrink-0 rounded-full lg:hidden"
      >
        <PersonaOrb
          persona={speaker}
          size={40}
          glow={isActive ? 'strong' : 'soft'}
          state={isActive ? 'speaking' : 'idle'}
        />
      </button>
      <div
        className={cn(
          'relative flex max-w-[88%] flex-1 flex-col gap-2 rounded-2xl rounded-tl-md border p-3 lg:max-w-none lg:rounded-xl lg:p-4',
          message.isKeyPoint
            ? 'border-accent/50 animate-keypoint-pulse'
            : isActive
              ? 'border-primary/60 shadow-[0_0_24px_hsl(var(--primary)/0.18)]'
              : 'border-border',
        )}
        style={{
          borderLeftWidth,
          borderLeftColor: speaker.colorTo,
          background: `linear-gradient(135deg, ${speaker.colorFrom}09, transparent 45%), hsl(var(--surface))`,
        }}
      >
      {/* 트랙 ③ — 카드 우상단 ⋯ 버튼 + DirectionMenu */}
      {canDirect && (
        <div className="absolute right-2 top-2 z-10">
          <button
            type="button"
            aria-label="디렉션 메뉴 열기"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className={cn(
              'flex size-6 items-center justify-center rounded-md text-text-muted/50 transition-colors',
              'hover:bg-surface-2 hover:text-text-muted',
              menuOpen && 'bg-surface-2 text-text-muted',
            )}
          >
            <MoreHorizontal className="size-3.5" />
          </button>
          {menuOpen && (
            <DirectionMenu
              message={message}
              speaker={speaker!}
              cast={cast!}
              onClose={() => setMenuOpen(false)}
              onSubmit={(action) => {
                onDirect!(action);
                setMenuOpen(false);
              }}
            />
          )}
        </div>
      )}

      {/* 반박 연결선 */}
      {replyTarget && (
        <div className="flex items-center gap-1.5 text-xs text-accent">
          <CornerDownRight className="size-3.5 shrink-0" />
          <span className="font-medium">{replyTarget.speakerName}</span>
          <span className="text-text-muted">에 반박</span>
          <span className="truncate text-text-muted/70">
            · &ldquo;{replyTarget.preview}&rdquo;
          </span>
        </div>
      )}

      {/* 발언자 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSelectMember?.(speaker.id)}
          aria-label={`${speaker.name} 발언 모아보기`}
          className="hidden rounded-full lg:block"
        >
          <PersonaOrb persona={speaker} size={40} glow="soft" />
        </button>
        <span className="text-sm font-semibold text-text">{speaker.name}</span>
        {/* lens 미니 칩 (⑤-2a, Phase E 이후 lens 표기) */}
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none"
          style={{
            color: speaker.colorTo,
            background: `${speaker.colorTo}22`,
          }}
        >
          {LENS_LABEL_KR[speaker.trait.lens]}
        </span>
        {/* ⑤-5e — 모두 발언 마커 */}
        {isIntro && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <Flag className="size-3" />
            모두 발언
          </span>
        )}
        {/* ⑤-5a — isKeyPoint 핵심 발언 마커 (Persona 5 Aha 모먼트) */}
        {message.isKeyPoint && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent"
            title="이 청크의 핵심 발언"
          >
            <Sparkles className="size-3" />
            핵심
          </span>
        )}
        {message.isQuestion && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
            <HelpCircle className="size-3" />
            질문
          </span>
        )}
      </div>

      {/* ⑤-5a 시그니처 한 줄 — 첫 발언일 때만 (캐릭터 정체성) */}
      {signature && (
        <p
          className="border-l-2 px-2 py-0.5 text-xs italic leading-relaxed text-text-muted/90"
          style={{ borderLeftColor: `${speaker.colorTo}88` }}
        >
          &ldquo;{signature}&rdquo;
        </p>
      )}

      {/* 본문 */}
      {isLatest && onAdvance ? (
        <TypewriterText
          text={message.content}
          speed={speed}
          onAdvance={onAdvance}
        />
      ) : (
        <p className="whitespace-pre-wrap text-base font-normal leading-relaxed text-text">
          {message.content}
        </p>
      )}
      </div>
    </div>
  );
}
