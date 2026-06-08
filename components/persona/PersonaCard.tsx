'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Plus, Trash2, Replace } from 'lucide-react';

import { PersonaOrb } from './PersonaOrb';
import { StatGauge } from './StatGauge';
import { cn } from '@/lib/utils';
import {
  STANCE_LABEL_KR,
  LENS_LABEL_KR,
  EXPRESSION_LABEL_KR,
  statsForMember,
} from '@/lib/prompts/personas';
import type { CastMember, StanceAxis, Lens, Expression, Trait } from '@/types/persona';

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
  /**
   * trait 축 변경 콜백 — 제공 시 chip 인터랙티브, 없으면 읽기 전용.
   * picking 화면에서만 주입한다.
   */
  onTraitChange?: (memberId: string, axis: keyof Trait, newValue: string) => void;
  disabled?: boolean;
}

// ─── trait 3축 cycle 정의 ─────────────────────────────────────────────────────

const STANCE_CYCLE: StanceAxis[] = ['advocate', 'critic', 'agnostic'];
const LENS_CYCLE: Lens[] = ['analyst', 'empath', 'pragmatist'];
const EXPR_CYCLE: Expression[] = ['measured', 'provocateur'];

function cycleNext<T>(arr: T[], current: T): T {
  const idx = arr.indexOf(current);
  // arr is always non-empty and bounded by %; cast is safe
  return arr[(idx + 1) % arr.length] as T;
}

// ─── TraitChip ───────────────────────────────────────────────────────────────

function TraitChip({
  label,
  colorClass,
  title,
  onClick,
}: {
  label: string;
  colorClass: string;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={cn(
          'flex min-h-[28px] min-w-[56px] items-center justify-center rounded-full px-2 py-0.5',
          'font-mono text-[10px] transition-opacity hover:opacity-75 active:scale-95',
          colorClass,
        )}
      >
        {label}
      </button>
    );
  }
  return (
    <span
      title={title}
      className={cn('rounded-full px-2 py-0.5 font-mono text-[10px]', colorClass)}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<CastMember['source'], { text: string; tone: 'archetype' | 'generated' | 'custom' } | null> = {
  archetype: null, // 라벨 없음 — 기본 카드
  generated: { text: '즉석 설계', tone: 'generated' },
  custom: { text: '내가 추가', tone: 'custom' },
};

/**
 * 한 명의 CastMember 카드.
 *
 * 정보 우선순위:
 *   [orb] [이름]·····[액션 ⋯]
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
  onTraitChange,
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
        {/* 이름 행 — 오른쪽: pool 카드 ⊕ 또는 패널 카드 ⋯ 메뉴 */}
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-text">
            {member.name}
          </h3>
          <div className="flex shrink-0 items-center">
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

        {/* trait 3축 칩 행 */}
        <div className="flex flex-wrap items-center gap-1">
          {/* stanceAxis 칩 */}
          <TraitChip
            label={STANCE_LABEL_KR[member.trait.stanceAxis]}
            colorClass="bg-primary/15 text-primary"
            title={onTraitChange ? '클릭하여 입장 변경' : `입장: ${STANCE_LABEL_KR[member.trait.stanceAxis]}`}
            onClick={
              onTraitChange
                ? (e) => {
                    e.stopPropagation();
                    onTraitChange(
                      member.id,
                      'stanceAxis',
                      cycleNext(STANCE_CYCLE, member.trait.stanceAxis),
                    );
                  }
                : undefined
            }
          />
          {/* lens 칩 */}
          <TraitChip
            label={LENS_LABEL_KR[member.trait.lens]}
            colorClass="bg-surface-2 text-text-muted"
            title={onTraitChange ? '클릭하여 관점 변경' : `관점: ${LENS_LABEL_KR[member.trait.lens]}`}
            onClick={
              onTraitChange
                ? (e) => {
                    e.stopPropagation();
                    onTraitChange(
                      member.id,
                      'lens',
                      cycleNext(LENS_CYCLE, member.trait.lens),
                    );
                  }
                : undefined
            }
          />
          {/* expression 칩 — measured 일 때는 읽기 전용에서 숨김 */}
          {(member.trait.expression !== 'measured' || !!onTraitChange) && (
            <TraitChip
              label={EXPRESSION_LABEL_KR[member.trait.expression]}
              colorClass={
                member.trait.expression === 'provocateur'
                  ? 'bg-accent/15 text-accent'
                  : 'bg-surface-2/60 text-text-dim'
              }
              title={onTraitChange ? '클릭하여 표현 방식 변경' : `표현: ${EXPRESSION_LABEL_KR[member.trait.expression]}`}
              onClick={
                onTraitChange
                  ? (e) => {
                      e.stopPropagation();
                      onTraitChange(
                        member.id,
                        'expression',
                        cycleNext(EXPR_CYCLE, member.trait.expression),
                      );
                    }
                  : undefined
              }
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {statsForMember(member).map((s) => (
            <StatGauge
              key={s.label}
              label={s.label}
              score={s.score}
              color={member.colorTo}
            />
          ))}
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
