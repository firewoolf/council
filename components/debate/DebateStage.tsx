'use client';

import { useState } from 'react';
import { ChevronDown, Image as ImageIcon } from 'lucide-react';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { backgroundById } from '@/lib/stage/backgrounds';
import { cn } from '@/lib/utils';
import type { CastMember } from '@/types/persona';

interface DebateStageProps {
  cast: readonly CastMember[];
  speaker: CastMember | null;
  mode: 'speaking' | 'thinking' | 'idle' | 'concluded';
  /** 현재(최근 reveal) 발언 본문. */
  line?: string;
  /** speaking 첫 등장 시그니처(선택). */
  signatureLine?: string;
  backgroundId: string;
  activeSpeakerId?: string | null;
  thinkingMemberId?: string | null;
  onSelectMember?: (id: string) => void;
  /** 대사 박스 탭 → 다음 턴(skipTurn). */
  onAdvance?: () => void;
  onOpenBackground: () => void;
}

const CUTOUT_BASE = '/personas/cutouts';
const PORTRAIT_BASE = '/personas/portraits';

export function DebateStage({
  cast,
  speaker,
  mode,
  line,
  signatureLine,
  backgroundId,
  activeSpeakerId = null,
  thinkingMemberId = null,
  onSelectMember,
  onAdvance,
  onOpenBackground,
}: DebateStageProps) {
  const [bgErrored, setBgErrored] = useState(false);
  // 캐릭터 폴백 단계: 0=컷아웃, 1=초상화, 2=orb
  const [charStage, setCharStage] = useState(0);

  const bg = backgroundById(backgroundId);
  const archId = speaker?.archetypeId;
  const charSrc =
    archId && charStage === 0 ? `${CUTOUT_BASE}/${archId}.png`
    : archId && charStage === 1 ? `${PORTRAIT_BASE}/${archId}.webp`
    : undefined;
  const isStaticMode = mode === 'idle' || mode === 'concluded';

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border h-[60vh] min-h-[340px] sm:h-[66vh]">
      {/* 배경 */}
      {!bgErrored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bg.path} alt="" aria-hidden="true"
          onError={() => setBgErrored(true)}
          className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: 'var(--stage-bg)' }} aria-hidden="true" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" aria-hidden="true" />

      {!isStaticMode && cast.length > 0 && (
        <div className="absolute left-3 right-14 top-3 z-20 overflow-hidden rounded-full bg-black/30 px-3 py-2 backdrop-blur">
          <div
            className="flex gap-4 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {cast.map((member) => {
              const isActive = member.id === activeSpeakerId;
              const isThinking = member.id === thinkingMemberId;
              const orbState = isActive
                ? 'speaking'
                : isThinking
                  ? 'thinking'
                  : 'idle';

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onSelectMember?.(member.id)}
                  aria-label={`${member.name} 발언 모아보기`}
                  className={cn(
                    'flex shrink-0 flex-col items-center gap-1 transition-transform duration-200 [scroll-snap-align:start]',
                    isActive && 'scale-110',
                  )}
                >
                  <PersonaOrb
                    persona={member}
                    size={36}
                    state={orbState}
                    inactive={activeSpeakerId !== null && !isActive && !isThinking}
                  />
                  <span
                    className={cn(
                      'max-w-16 truncate text-center text-[10px] leading-none',
                      isActive ? 'font-semibold text-white' : 'text-white/65',
                    )}
                  >
                    {member.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isStaticMode && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {cast.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => onSelectMember?.(member.id)}
                aria-label={`${member.name} 발언 모아보기`}
                className="rounded-full transition-transform hover:scale-105"
              >
                <PersonaOrb persona={member} size={56} glow="soft" />
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

      {/* 캐릭터 컷아웃 (하단 정렬, 화자 전환 시 enter 애니) */}
      {!isStaticMode && speaker && charSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${speaker.id}-${charStage}`} src={charSrc} alt=""
          aria-hidden="true"
          onError={() => setCharStage((s) => s + 1)}
          className={cn(
            'stage-char-enter absolute inset-x-0 bottom-0 mx-auto h-[90%] object-contain object-bottom',
            mode === 'thinking' && 'opacity-70 saturate-[0.85]',
          )} />
      ) : !isStaticMode && speaker ? (
        <div className="absolute inset-0 flex items-end justify-center pb-16">
          <PersonaOrb persona={speaker} size={140} glow="strong" />
        </div>
      ) : null}

      {/* 상단 컨트롤 — 배경 */}
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button type="button" onClick={onOpenBackground} aria-label="배경 변경"
          className="flex size-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur hover:bg-black/60">
          <ImageIcon className="size-4" />
        </button>
      </div>

      {/* 준비 중 표시 */}
      {mode === 'thinking' && (
        <div className="absolute bottom-3 left-3 z-10 animate-pulse rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur">
          {speaker?.name ?? '패널'} 준비 중…
        </div>
      )}

      {/* 하단 대사 박스 — 탭하면 다음 턴 */}
      {speaker && (mode === 'speaking') && (
        <button type="button" onClick={onAdvance}
          className="absolute inset-x-0 bottom-0 z-10 cursor-pointer text-left">
          <div className="m-3 rounded-xl border border-white/15 bg-black/65 p-4 backdrop-blur">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-md px-2 py-0.5 text-sm font-bold text-white"
                style={{ background: `${speaker.colorTo}cc` }}>
                {speaker.name}
              </span>
              <ChevronDown className="ml-auto size-4 animate-bounce text-white/60" aria-hidden="true" />
            </div>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/95">
              {line ?? (signatureLine ? `"${signatureLine}"` : '')}
            </p>
          </div>
        </button>
      )}
    </div>
  );
}
