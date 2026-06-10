'use client';

import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { backgroundById } from '@/lib/stage/backgrounds';
import { cn } from '@/lib/utils';
import type { CastMember } from '@/types/persona';

type StageMode = 'speaking' | 'thinking' | 'idle' | 'concluded';

interface StagePanelProps {
  cast: readonly CastMember[];
  speaker: CastMember | null;
  mode: StageMode;
  /** speaking 첫 등장 시그니처(선택). 발언 본문은 받지 않는다 — 텍스트는 피드에만. */
  signatureLine?: string;
  backgroundId: string;
  onSelectMember?: (id: string) => void;
  onOpenBackground: () => void;
  /**
   * full   — 웹 3패널(xl+)의 좌측 세로 무대.
   * compact — 웹 2패널(lg)의 피드 상단 스피커 밴드(한 줄).
   */
  variant?: 'full' | 'compact';
}

const CUTOUT_BASE = '/personas/cutouts';
const PORTRAIT_BASE = '/personas/portraits';

/**
 * 트랙 R-1.5b — 무대 패널.
 *
 * R-1 무대(stage)에서 분리·축소. **발언 텍스트가 없다** — 인물 연출만 담당하고
 * 텍스트는 피드(메시지 카드)가 유일하게 표시한다(중복 금지).
 * 용과 같이 효과 = 화자 전환 시 컷아웃 enter 모션 + 피드 최신 카드 타이핑의 조합.
 */
export function StagePanel({
  cast,
  speaker,
  mode,
  signatureLine,
  backgroundId,
  onSelectMember,
  onOpenBackground,
  variant = 'full',
}: StagePanelProps) {
  // 캐릭터 폴백 단계: 0=컷아웃, 1=초상화, 2=orb. 화자 전환 시 컷아웃부터 재시도.
  const [charStage, setCharStage] = useState(0);
  const [bgErrored, setBgErrored] = useState(false);
  useEffect(() => {
    setCharStage(0);
  }, [speaker?.id]);

  const archId = speaker?.archetypeId;
  const charSrc =
    archId && charStage === 0 ? `${CUTOUT_BASE}/${archId}.png`
    : archId && charStage === 1 ? `${PORTRAIT_BASE}/${archId}.webp`
    : undefined;

  if (variant === 'compact') {
    return (
      <StageBand
        cast={cast}
        speaker={speaker}
        mode={mode}
        signatureLine={signatureLine}
        onSelectMember={onSelectMember}
        onOpenBackground={onOpenBackground}
      />
    );
  }

  const bg = backgroundById(backgroundId);
  const isStaticMode = mode === 'idle' || mode === 'concluded';

  return (
    <div className="relative flex h-full min-h-[340px] w-full flex-col overflow-hidden rounded-2xl border border-border">
      {/* 배경 */}
      {!bgErrored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg.path}
          alt=""
          aria-hidden="true"
          onError={() => setBgErrored(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'var(--stage-bg)' }}
          aria-hidden="true"
        />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/15"
        aria-hidden="true"
      />

      {/* 상단 컨트롤 — 배경 변경 */}
      <button
        type="button"
        onClick={onOpenBackground}
        aria-label="배경 변경"
        className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur hover:bg-black/60"
      >
        <ImageIcon className="size-4" />
      </button>

      {/* idle / concluded — 단체샷 */}
      {isStaticMode && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-5 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {cast.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => onSelectMember?.(member.id)}
                aria-label={`${member.name} 발언 모아보기`}
                className="rounded-full transition-transform hover:scale-105"
              >
                <PersonaOrb persona={member} size={48} glow="soft" />
              </button>
            ))}
          </div>
          <p className="rounded-full bg-black/45 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur">
            {mode === 'concluded'
              ? '토론이 종결되었습니다'
              : '패널이 모였습니다 — 토론 시작을 누르세요'}
          </p>
        </div>
      )}

      {/* speaking / thinking — 현재 화자 컷아웃 */}
      {!isStaticMode && speaker && (
        <>
          {charSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${speaker.id}-${charStage}`}
              src={charSrc}
              alt=""
              aria-hidden="true"
              onError={() => setCharStage((s) => s + 1)}
              className={cn(
                'stage-char-enter absolute inset-x-0 bottom-0 mx-auto h-[88%] object-contain object-bottom',
                mode === 'thinking' && 'opacity-70 saturate-[0.85]',
              )}
            />
          ) : (
            <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center pb-20">
              <PersonaOrb
                persona={speaker}
                size={132}
                state={mode === 'speaking' ? 'speaking' : 'thinking'}
                glow="strong"
              />
            </div>
          )}
        </>
      )}

      {/* 하단 인물 정보 — 이름 + 상태 + 시그니처 (발언 텍스트 없음) */}
      {!isStaticMode && speaker && (
        <div className="relative z-10 mt-auto flex flex-col gap-1.5 p-4">
          <button
            type="button"
            onClick={() => onSelectMember?.(speaker.id)}
            className="flex w-fit items-center gap-2 text-left"
            aria-label={`${speaker.name} 발언 모아보기`}
          >
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-sm font-bold text-white',
                mode === 'speaking' &&
                  'shadow-[0_0_18px_hsl(var(--primary)/0.5)]',
              )}
              style={{ background: `${speaker.colorTo}cc` }}
            >
              {speaker.name}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur',
                mode === 'thinking'
                  ? 'animate-pulse bg-black/40 text-white/80'
                  : 'bg-black/45 text-white/90',
              )}
            >
              {mode === 'thinking' ? '준비 중…' : '발언 중'}
            </span>
          </button>
          {mode === 'speaking' && signatureLine && (
            <p className="max-w-[260px] truncate rounded-md bg-black/40 px-2 py-1 text-xs italic text-white/85 backdrop-blur">
              “{signatureLine}”
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** 웹 2패널(lg) — 피드 상단 컴팩트 스피커 밴드. StagePanel 의 compact variant. */
function StageBand({
  cast,
  speaker,
  mode,
  signatureLine,
  onSelectMember,
  onOpenBackground,
}: {
  cast: readonly CastMember[];
  speaker: CastMember | null;
  mode: StageMode;
  signatureLine?: string;
  onSelectMember?: (id: string) => void;
  onOpenBackground: () => void;
}) {
  const isStaticMode = mode === 'idle' || mode === 'concluded';

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/70 p-3">
      {isStaticMode ? (
        <>
          <div className="flex -space-x-1.5">
            {cast.slice(0, 5).map((member) => (
              <PersonaOrb
                key={member.id}
                persona={member}
                size={32}
                glow="none"
                className="ring-2 ring-surface"
              />
            ))}
          </div>
          <p className="text-sm text-text-muted">
            {mode === 'concluded'
              ? '토론이 종결되었습니다'
              : '패널이 모였습니다'}
          </p>
        </>
      ) : speaker ? (
        <>
          <button
            type="button"
            onClick={() => onSelectMember?.(speaker.id)}
            aria-label={`${speaker.name} 발언 모아보기`}
            className="shrink-0 rounded-full"
          >
            <PersonaOrb
              persona={speaker}
              size={48}
              state={mode === 'speaking' ? 'speaking' : 'thinking'}
              glow={mode === 'speaking' ? 'strong' : 'soft'}
            />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-text">
                {speaker.name}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                  mode === 'thinking'
                    ? 'animate-pulse bg-surface-2 text-text-muted'
                    : 'bg-primary/15 text-primary',
                )}
              >
                {mode === 'thinking' ? '준비 중' : '발언 중'}
              </span>
            </div>
            {mode === 'speaking' && signatureLine && (
              <p className="truncate text-xs italic text-text-muted">
                “{signatureLine}”
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="flex-1 text-sm text-text-muted">토론 준비 중…</p>
      )}

      <button
        type="button"
        onClick={onOpenBackground}
        aria-label="배경 변경"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        <ImageIcon className="size-4" />
      </button>
    </div>
  );
}
