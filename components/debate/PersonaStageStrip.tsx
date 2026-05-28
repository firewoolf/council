'use client';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { cn } from '@/lib/utils';
import type { CastMember } from '@/types/persona';

interface PersonaStageStripProps {
  cast: readonly CastMember[];
  /** 지금 발화 중인 멤버 (재생 중인 turn 의 speakerId). null 이면 무대 정적. */
  activeSpeakerId: string | null;
  /** "준비 중" 인디케이터 — 청크 생성 중일 때 표시할 멤버 (옵션). */
  thinkingMemberId: string | null;
  /** orb 클릭 → 페르소나 필터 드로어 열기. */
  onSelect: (memberId: string) => void;
}

/**
 * 트랙 ⑤-2a — 회의실 상단 sticky orb 줄.
 *
 * 패널 전원을 한 줄에 배치. 지금 말하는 사람이 확대·맥동한다.
 * 모바일: 멤버 5인 이상 가로 스크롤 (snap-x).
 * 클릭 → PersonaDetailDrawer 열기 (⑤-2b 에서 본체 구현).
 */
export function PersonaStageStrip({
  cast,
  activeSpeakerId,
  thinkingMemberId,
  onSelect,
}: PersonaStageStripProps) {
  if (cast.length === 0) return null;

  const hasActive = activeSpeakerId !== null;

  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-border/50 bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div
        className="flex gap-5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {cast.map((member) => {
          const isActive = member.id === activeSpeakerId;
          const isThinking = member.id === thinkingMemberId;
          const orbState: 'speaking' | 'thinking' | 'idle' = isActive
            ? 'speaking'
            : isThinking
              ? 'thinking'
              : 'idle';

          return (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect(member.id)}
              aria-label={`${member.name} 발언 모아보기`}
              className={cn(
                'flex shrink-0 flex-col items-center gap-1.5 transition-transform duration-200',
                // snap 대상
                '[scroll-snap-align:start]',
                // 활성 화자 확대
                isActive && 'scale-[1.15]',
              )}
            >
              <PersonaOrb
                persona={member}
                size={40}
                state={orbState}
                // 누군가 말하고 있을 때 비활성 멤버는 흐리게
                inactive={hasActive && !isActive && !isThinking}
              />
              <span
                className={cn(
                  'max-w-[72px] truncate text-center text-[10px] leading-none',
                  isActive
                    ? 'font-semibold text-text'
                    : 'text-text-muted',
                )}
              >
                {member.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
