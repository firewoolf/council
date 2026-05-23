'use client';

import { Check, Plus } from 'lucide-react';

import { PersonaOrb } from './PersonaOrb';
import { cn } from '@/lib/utils';
import type { Persona } from '@/types/persona';

interface PersonaCardProps {
  persona: Persona;
  /** 회의에 참여 중인 상태 */
  selected: boolean;
  /** 추천 받은 페르소나일 때 AI가 준 사유 (왜 이 사람이 필요한가) */
  recommendReason?: string;
  /**
   * Phase A — 이 페르소나가 이 고민에서 취하는 입장 한 줄.
   * 추천된 3명에게만 있고 풀에서 추가한 페르소나는 없음(중립).
   */
  stance?: string;
  /** 도메인 전문가일 때 동적으로 주입된 분야명 */
  domain?: string | null;
  onToggle: (personaId: string) => void;
  disabled?: boolean;
}

/**
 * 페르소나 1명 카드.
 * 클릭하면 활성/비활성 토글 (회의 참여 여부).
 *
 * 모바일에서는 좌측 orb + 우측 정보, 데스크탑도 동일 레이아웃 유지.
 * 활성 상태는 카드 외곽선과 우측 체크로 한눈에 구분.
 */
export function PersonaCard({
  persona,
  selected,
  recommendReason,
  stance,
  domain,
  onToggle,
  disabled,
}: PersonaCardProps) {
  const isDomainExpert = persona.dynamic;
  const displayName =
    isDomainExpert && domain ? `${persona.name} (${domain})` : persona.name;

  return (
    <button
      type="button"
      onClick={() => onToggle(persona.id)}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'group relative flex w-full items-start gap-4 rounded-xl border bg-surface p-4 text-left transition-all',
        'hover:border-primary/40 hover:bg-surface-2',
        selected
          ? 'border-primary/60 bg-surface-2 glow-primary'
          : 'border-border',
        disabled && 'cursor-not-allowed opacity-50',
      )}
      style={
        selected
          ? {
              borderLeftWidth: 4,
              borderLeftColor: persona.colorTo,
            }
          : undefined
      }
    >
      <PersonaOrb
        persona={persona}
        size={56}
        glow={selected ? 'strong' : 'soft'}
        inactive={!selected}
        className="mt-0.5"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-text">
            {displayName}
          </h3>
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full transition-colors',
              selected
                ? 'bg-primary text-white'
                : 'bg-surface-2 text-text-muted group-hover:bg-primary/20',
            )}
          >
            {selected ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
          </span>
        </div>

        <p className="line-clamp-1 text-xs text-text-muted">{persona.role}</p>

        {recommendReason && (
          <p
            className={cn(
              'mt-1 line-clamp-2 rounded-md bg-primary/10 px-2 py-1 text-xs leading-relaxed',
              'text-text/90',
            )}
          >
            <span className="mr-1 font-medium text-primary">추천</span>
            {recommendReason}
          </p>
        )}

        {stance && (
          <p
            className={cn(
              'line-clamp-2 rounded-md border-l-2 border-accent/60 bg-accent/10 px-2 py-1 text-xs leading-relaxed',
              'text-text/90',
            )}
          >
            <span className="mr-1 font-semibold text-accent">입장</span>
            {stance}
          </p>
        )}
      </div>
    </button>
  );
}
