'use client';

import { useState } from 'react';
import { Image as ImageIcon, ScrollText, ChevronDown } from 'lucide-react';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { backgroundById } from '@/lib/stage/backgrounds';
import { cn } from '@/lib/utils';
import type { CastMember } from '@/types/persona';

interface DebateStageProps {
  /** 현재 화자(발언 중) 또는 준비 중 멤버. null 이면 무대 비움. */
  speaker: CastMember | null;
  mode: 'speaking' | 'thinking' | 'idle';
  /** 현재(최근 reveal) 발언 본문. */
  line?: string;
  /** speaking 첫 등장 시그니처(선택). */
  signatureLine?: string;
  backgroundId: string;
  /** 대사 박스 탭 → 다음 턴(skipTurn). */
  onAdvance?: () => void;
  onOpenBackground: () => void;
  onOpenTranscript: () => void;
}

const CUTOUT_BASE = '/personas/cutouts';
const PORTRAIT_BASE = '/personas/portraits';

export function DebateStage({
  speaker, mode, line, signatureLine, backgroundId,
  onAdvance, onOpenBackground, onOpenTranscript,
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

      {/* 캐릭터 컷아웃 (하단 정렬, 화자 전환 시 enter 애니) */}
      {speaker && charSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${speaker.id}-${charStage}`} src={charSrc} alt=""
          aria-hidden="true"
          onError={() => setCharStage((s) => s + 1)}
          className={cn(
            'stage-char-enter absolute inset-x-0 bottom-0 mx-auto h-[90%] object-contain object-bottom',
            mode === 'thinking' && 'opacity-70 saturate-[0.85]',
          )} />
      ) : speaker ? (
        <div className="absolute inset-0 flex items-end justify-center pb-16">
          <PersonaOrb persona={speaker} size={140} glow="strong" />
        </div>
      ) : null}

      {/* 상단 컨트롤 — 배경/대화록 */}
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button type="button" onClick={onOpenBackground} aria-label="배경 변경"
          className="flex size-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur hover:bg-black/60">
          <ImageIcon className="size-4" />
        </button>
        <button type="button" onClick={onOpenTranscript} aria-label="대화록 보기"
          className="flex size-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur hover:bg-black/60">
          <ScrollText className="size-4" />
        </button>
      </div>

      {/* 준비 중 표시 */}
      {mode === 'thinking' && (
        <div className="absolute left-3 top-3 z-10 animate-pulse rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur">
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
