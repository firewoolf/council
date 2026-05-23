'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';

import { PersonaCard } from '@/components/persona/PersonaCard';
import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { Button } from '@/components/ui/button';
import { PERSONAS, PERSONA_MAP } from '@/lib/prompts/personas';
import { cn } from '@/lib/utils';
import type { Persona } from '@/types/persona';

interface PersonaPickerProps {
  /** AI가 추천한 personaId 목록 (보통 3개) */
  recommendedIds: string[];
  /** personaId → 추천 사유 매핑 */
  reasons: Record<string, string>;
  /**
   * Phase A — personaId → 추천기가 배정한 입장(한 줄).
   * 추천된 3명에게만 들어있다. 풀에서 추가한 페르소나는 없음(중립).
   */
  stances: Record<string, string>;
  /** 동적 분야 (도메인 전문가용) */
  domain: string | null;
  /** 현재 선택된 personaId 목록 (사회자 포함) */
  selectedIds: string[];
  onToggle: (personaId: string) => void;
  onStart: () => void;
  busy?: boolean;
}

const FACILITATOR_ID = 'facilitator';

/**
 * 추천 결과 + 풀에서 추가 선택하는 화면.
 *
 * 구성:
 *   - 상단: AI 추천 3명 (자동 선택됨, 이유 표시)
 *   - 사회자(facilitator) — 항상 자동 포함, 토글 불가
 *   - "다른 페르소나 추가" 접힘식: 풀에서 토글로 추가/제거
 *   - 하단 sticky: 현재 패널 미리보기 + "회의 시작"
 *
 * 모바일 퍼스트 — 모든 동작은 탭 한 번. 드래그는 다음 마일스톤.
 */
export function PersonaPicker({
  recommendedIds,
  reasons,
  stances,
  domain,
  selectedIds,
  onToggle,
  onStart,
  busy,
}: PersonaPickerProps) {
  const [poolOpen, setPoolOpen] = useState(false);

  const recommended = useMemo<Persona[]>(
    () =>
      recommendedIds
        .map((id) => PERSONA_MAP[id])
        .filter((p): p is Persona => Boolean(p)),
    [recommendedIds],
  );

  // 추천에 없는 나머지 페르소나. 사회자는 별도 취급이라 제외.
  const poolOthers = useMemo<Persona[]>(
    () =>
      PERSONAS.filter(
        (p) =>
          !recommendedIds.includes(p.id) && p.id !== FACILITATOR_ID,
      ),
    [recommendedIds],
  );

  const selectedSet = new Set(selectedIds);
  const selectedPersonas = selectedIds
    .map((id) => PERSONA_MAP[id])
    .filter((p): p is Persona => Boolean(p));

  return (
    <section className="flex flex-col gap-6 pb-32">
      {/* 헤더 */}
      <div className="space-y-2">
        <h1 className="font-sans text-3xl font-black leading-tight tracking-tight text-text sm:text-4xl">
          이 사람들이 토론할 거예요.
        </h1>
        <p className="text-sm leading-relaxed text-text-muted sm:text-base">
          AI가 당신의 고민에 가장 잘 맞는 3명을 골랐습니다. 마음에 들지 않으면
          빼거나 다른 페르소나를 추가할 수 있습니다.
        </p>
        {domain && (
          <p className="text-xs text-text-muted">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px]">
              감지된 분야
            </span>{' '}
            <span className="font-medium text-text/90">{domain}</span>
          </p>
        )}
      </div>

      {/* 추천 3명 */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          AI 추천
        </h2>
        <div className="flex flex-col gap-3">
          {recommended.map((p) => (
            <PersonaCard
              key={p.id}
              persona={p}
              selected={selectedSet.has(p.id)}
              recommendReason={reasons[p.id]}
              stance={stances[p.id]}
              domain={p.dynamic ? domain : undefined}
              onToggle={onToggle}
            />
          ))}
        </div>
      </div>

      {/* 사회자 (자동 포함, 정보성) */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-4">
        <PersonaOrb
          persona={PERSONA_MAP[FACILITATOR_ID]!}
          size={40}
          glow="soft"
        />
        <div className="flex-1">
          <p className="text-sm font-semibold text-text">
            사회자는 자동으로 참여합니다
          </p>
          <p className="text-xs text-text-muted">
            토론 진행과 결론 정리를 담당합니다.
          </p>
        </div>
      </div>

      {/* 다른 페르소나 추가 (접힘) */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setPoolOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-md px-1 py-2 text-sm font-semibold uppercase tracking-wider text-text-muted hover:text-text"
        >
          <span>다른 페르소나 추가 ({poolOthers.length}명)</span>
          <ChevronDown
            className={cn(
              'size-4 transition-transform',
              poolOpen && 'rotate-180',
            )}
          />
        </button>
        {poolOpen && (
          <div className="flex flex-col gap-3 animate-fade-in">
            {poolOthers.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                selected={selectedSet.has(p.id)}
                domain={p.dynamic ? domain : undefined}
                onToggle={onToggle}
              />
            ))}
          </div>
        )}
      </div>

      {/* 하단 sticky — 현재 패널 + 회의 시작 */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex -space-x-2">
            {selectedPersonas.slice(0, 5).map((p) => (
              <PersonaOrb
                key={p.id}
                persona={p}
                size={32}
                glow="none"
                className="ring-2 ring-background"
              />
            ))}
            {selectedPersonas.length > 5 && (
              <div className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-xs font-medium text-text-muted ring-2 ring-background">
                +{selectedPersonas.length - 5}
              </div>
            )}
          </div>

          <span className="flex-1 truncate text-xs text-text-muted">
            <Users className="mr-1 inline size-3.5" />
            {selectedPersonas.length}명 참여
          </span>

          <Button
            size="default"
            onClick={onStart}
            disabled={busy || selectedPersonas.length < 2}
          >
            회의 시작
          </Button>
        </div>
      </div>
    </section>
  );
}
