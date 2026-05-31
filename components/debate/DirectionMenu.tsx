'use client';

import { useEffect, useRef, useState } from 'react';
import { Flame, Hash, HelpCircle, RotateCcw, Swords } from 'lucide-react';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { cn } from '@/lib/utils';
import type { DirectionAction, Message } from '@/types/debate';
import type { CastMember } from '@/types/persona';

interface DirectionMenuProps {
  /** 디렉션 대상 발언 (클릭된 카드). */
  message: Message;
  /** 그 발언의 화자 — 호출처가 null 필터 후 전달. */
  speaker: CastMember;
  /** 패널 전원 — rebut byMember 선택용. */
  cast: readonly CastMember[];
  onClose: () => void;
  onSubmit: (action: DirectionAction) => void;
}

/**
 * 트랙 ③ — 카드별 감독 디렉션 메뉴.
 *
 * 발언 카드 우상단 ⋯ 버튼 클릭 시 absolute z-30 으로 열림.
 * ESC / 외부 클릭으로 닫힘.
 *
 * 5 액션:
 *   · tighten  — 더 세게 말해줘   (이 사람에게)
 *   · specify  — 근거 더 구체적으로 (이 사람에게)
 *   · reframe  — 다른 각도에서 다시 (이 사람에게)
 *   · rebut    — 반박시키기        (다른 멤버 선택 → inline expand)
 *   · ask-user — 사용자에게 질문   (이 사람이)
 */
export function DirectionMenu({
  message,
  speaker,
  cast,
  onClose,
  onSubmit,
}: DirectionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [rebutOpen, setRebutOpen] = useState(false);

  // 외부 클릭 → 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // ESC → 닫기
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleSimple(kind: 'tighten' | 'specify' | 'reframe' | 'ask-user') {
    onSubmit({ kind, targetMemberId: speaker.id, targetMessageId: message.id });
  }

  function handleRebut(byMemberId: string) {
    onSubmit({
      kind: 'rebut',
      targetMemberId: speaker.id,
      targetMessageId: message.id,
      byMemberId,
    });
  }

  // rebut 후보 — 자기 자신과 사회자 제외
  const rebutCandidates = cast.filter(
    (m) => m.id !== speaker.id && !m.isFacilitator,
  );

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="디렉션 메뉴"
      className="absolute right-0 top-8 z-30 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-xl animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ─── 이 사람에게 ──────────────────────────── */}
      <div className="px-3 pb-1 pt-2.5">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {speaker.name}에게
        </p>
        {(
          [
            { kind: 'tighten', Icon: Flame,     label: '더 세게 말해줘' },
            { kind: 'specify', Icon: Hash,      label: '근거 더 구체적으로' },
            { kind: 'reframe', Icon: RotateCcw, label: '다른 각도에서 다시' },
          ] as const
        ).map(({ kind, Icon, label }) => (
          <button
            key={kind}
            type="button"
            role="menuitem"
            onClick={() => handleSimple(kind)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-text hover:bg-surface-2"
          >
            <Icon className="size-3.5 shrink-0 text-text-muted" />
            {label}
          </button>
        ))}
      </div>

      <div className="mx-3 h-px bg-border" />

      {/* ─── 반박시켜 ─────────────────────────────── */}
      <div className="px-3 py-1.5">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          누군가에게 반박시켜
        </p>
        <button
          type="button"
          role="menuitem"
          onClick={() => setRebutOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-text hover:bg-surface-2"
        >
          <Swords className="size-3.5 shrink-0 text-text-muted" />
          반박시키기
          <span className="ml-auto text-[9px] text-text-muted">
            {rebutOpen ? '▲' : '▼'}
          </span>
        </button>

        {rebutOpen && (
          <div
            className={cn(
              'mt-1.5 flex flex-wrap gap-1.5 pb-0.5',
            )}
          >
            {rebutCandidates.length === 0 ? (
              <span className="text-[10px] text-text-muted">반박 가능한 멤버 없음</span>
            ) : (
              rebutCandidates.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleRebut(m.id)}
                  className="flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text transition-colors hover:border-primary/50 hover:bg-primary/10"
                >
                  <PersonaOrb persona={m} size={14} glow="none" />
                  {m.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="mx-3 h-px bg-border" />

      {/* ─── 사용자에게 질문 ──────────────────────── */}
      <div className="px-3 pb-2.5 pt-1.5">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          사용자에게
        </p>
        <button
          type="button"
          role="menuitem"
          onClick={() => handleSimple('ask-user')}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-text hover:bg-surface-2"
        >
          <HelpCircle className="size-3.5 shrink-0 text-text-muted" />
          사용자에게 질문
        </button>
      </div>
    </div>
  );
}
