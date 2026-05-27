'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Plus, Trash2, Replace } from 'lucide-react';

import { PersonaOrb } from './PersonaOrb';
import { cn } from '@/lib/utils';
import { TEMPERAMENT_LABEL_KR } from '@/lib/prompts/personas';
import type { CastMember } from '@/types/persona';

interface PersonaCardProps {
  /** 표시할 캐스트 멤버. archetype/generated/custom 모두 받음. */
  member: CastMember;
  /** archetype 멤버용 추천 사유 (있을 때만 표시). */
  recommendReason?: string;
  /**
   * 액션 메뉴(⋯) 노출 여부.
   *   - picking 화면의 패널 카드 = true (remove, archetype 은 swap 도)
   *   - 풀(아키타입 추가 후보) 카드 = false → 클릭 시 추가
   */
  showActions?: boolean;
  /** 풀 카드 클릭 — showActions=false 일 때만 동작. archetypeId 인자로 부모에게 전달. */
  onPick?: (archetypeId: string) => void;
  /** 멤버 제거 — showActions=true 일 때 액션 메뉴에서 호출. */
  onRemove?: (memberId: string) => void;
  /** archetype 멤버 swap 시작 — 부모가 후보 드롭다운/모달 띄움. */
  onSwapStart?: (memberId: string) => void;
  disabled?: boolean;
}

const SOURCE_LABEL: Record<CastMember['source'], { text: string; tone: 'archetype' | 'generated' | 'custom' } | null> = {
  archetype: null, // 라벨 없음 — 기본 카드
  generated: { text: '즉석 설계', tone: 'generated' },
  custom: { text: '내가 추가', tone: 'custom' },
};

/**
 * 한 명의 CastMember 카드.
 *
 * 정보 우선순위:
 *   [orb] [이름]·····[temperament 뱃지][액션 ⋯]
 *          역할
 *          입장: ___________________ (stance, accent 강조)
 *          추천: ___________________ (recommendReason, archetype 만)
 *          [source 라벨 칩] (generated/custom 만)
 *
 * showActions=false (풀 카드) 일 때:
 *   - 클릭 → onPick 호출
 *   - 우측에 ⊕ 아이콘
 */
export function PersonaCard({
  member,
  recommendReason,
  showActions = true,
  onPick,
  onRemove,
  onSwapStart,
  disabled,
}: PersonaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭으로 메뉴 닫기
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const sourceLabel = SOURCE_LABEL[member.source];
  const isPoolCard = !showActions;

  const handleCardClick = () => {
    if (!isPoolCard) return;
    if (!member.archetypeId) return;       // pool 카드는 항상 archetype
    onPick?.(member.archetypeId);
  };

  return (
    <div
      className={cn(
        'group relative flex w-full items-start gap-4 rounded-xl border bg-surface p-4 transition-all',
        isPoolCard && 'cursor-pointer hover:border-primary/40 hover:bg-surface-2',
        !isPoolCard && 'border-primary/60 bg-surface-2 glow-primary',
        isPoolCard && 'border-border',
        disabled && 'cursor-not-allowed opacity-50',
      )}
      style={
        !isPoolCard
          ? { borderLeftWidth: 4, borderLeftColor: member.colorTo }
          : undefined
      }
      onClick={handleCardClick}
      role={isPoolCard ? 'button' : undefined}
      tabIndex={isPoolCard ? 0 : undefined}
      onKeyDown={
        isPoolCard
          ? (e) => {
              if ((e.key === 'Enter' || e.key === ' ') && member.archetypeId) {
                e.preventDefault();
                onPick?.(member.archetypeId);
              }
            }
          : undefined
      }
    >
      <PersonaOrb
        persona={member}
        size={56}
        glow={isPoolCard ? 'soft' : 'strong'}
        inactive={isPoolCard}
        className="mt-0.5"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-text">
            {member.name}
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-muted"
              title={`성향: ${TEMPERAMENT_LABEL_KR[member.temperament]}`}
            >
              {TEMPERAMENT_LABEL_KR[member.temperament]}
            </span>
            {isPoolCard ? (
              <span className="flex size-6 items-center justify-center rounded-full bg-surface-2 text-text-muted transition-colors group-hover:bg-primary/20">
                <Plus className="size-3.5" />
              </span>
            ) : (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((v) => !v);
                  }}
                  aria-label="멤버 액션 메뉴"
                  className="flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface hover:text-text"
                >
                  <MoreHorizontal className="size-4" />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {member.source === 'archetype' && onSwapStart && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onSwapStart(member.id);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text hover:bg-surface-2"
                      >
                        <Replace className="size-3.5" />
                        다른 아키타입으로 교체
                      </button>
                    )}
                    {onRemove && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onRemove(member.id);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="size-3.5" />
                        제거
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="line-clamp-1 text-xs text-text-muted">{member.role}</p>

        {member.stance && (
          <p className="line-clamp-2 rounded-md border-l-2 border-accent/60 bg-accent/10 px-2 py-1 text-xs leading-relaxed text-text/90">
            <span className="mr-1 font-semibold text-accent">입장</span>
            {member.stance}
          </p>
        )}

        {recommendReason && member.source === 'archetype' && (
          <p className="line-clamp-2 rounded-md bg-primary/10 px-2 py-1 text-xs leading-relaxed text-text/90">
            <span className="mr-1 font-medium text-primary">추천</span>
            {recommendReason}
          </p>
        )}

        {sourceLabel && (
          <span
            className={cn(
              'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
              sourceLabel.tone === 'generated' &&
                'bg-accent/15 text-accent',
              sourceLabel.tone === 'custom' &&
                'bg-primary/15 text-primary',
            )}
          >
            {sourceLabel.text}
          </span>
        )}
      </div>
    </div>
  );
}
