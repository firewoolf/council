'use client';

import { useState } from 'react';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { LENS_LABEL_KR } from '@/lib/prompts/personas';
import { cn } from '@/lib/utils';
import type { CastMember } from '@/types/persona';

const PORTRAIT_BASE = '/personas/portraits';

interface SpeakerSpotlightProps {
  /** 무대에 올릴 화자. null 이면 무대 접힘. */
  speaker: CastMember | null;
  /** 'speaking'=발언 중 / 'thinking'=청크 생성 중 / 'idle'=접힘. */
  mode: 'speaking' | 'thinking' | 'idle';
  /** archetype 시그니처 한 줄. speaking 일 때만 표시(선택). */
  signatureLine?: string;
}

/**
 * ⑤-5g — 발언자 스포트라이트.
 * 지금 말하는(또는 준비 중인) 페르소나의 반신 일러스트를 크게 무대에 올린다.
 * 표시 전용 — 재생 엔진 무관. DebateFeed 가 sticky 헤더 안에서 렌더.
 */
export function SpeakerSpotlight({ speaker, mode, signatureLine }: SpeakerSpotlightProps) {
  const [errored, setErrored] = useState(false);

  // §2-6 — 접힘
  if (!speaker || mode === 'idle') return null;

  const portraitPath = speaker.archetypeId
    ? `${PORTRAIT_BASE}/${speaker.archetypeId}.webp`
    : undefined;
  const showPortrait = !!(portraitPath && !errored);

  return (
    <div
      key={speaker.id} // 화자 바뀌면 enter 애니 재생
      className={cn(
        'spotlight-enter relative w-full overflow-hidden rounded-2xl border',
        'h-32 sm:h-44', // 모바일 128px / 데스크탑 176px
        mode === 'thinking' && 'opacity-80',
      )}
      style={{
        borderColor: `${speaker.colorTo}66`,
        background: `linear-gradient(160deg, ${speaker.colorFrom}, ${speaker.colorTo})`,
      }}
      role="img"
      aria-label={`${speaker.name} ${mode === 'speaking' ? '발언 중' : '준비 중'}`}
    >
      {showPortrait ? (
        // native <img> — onError 폴백 필요(Next Image 아님).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portraitPath!}
          alt=""
          aria-hidden="true"
          onError={() => setErrored(true)}
          className="absolute inset-0 size-full object-cover"
          // 반신 일러스트 얼굴이 상단 1/3 — 상단 정렬(⑤-5f fix ⓐ 와 동일 의도)
          style={{ objectPosition: '50% 18%' }}
        />
      ) : (
        // 폴백: 그라디언트 위 orb(아이콘/이니셜)
        <div className="absolute inset-0 flex items-center justify-center">
          <PersonaOrb persona={speaker} size={80} glow="soft" />
        </div>
      )}

      {/* 발언 중 — 페르소나 색 인셋 링 맥동 */}
      {mode === 'speaking' && (
        <div
          className="pointer-events-none absolute inset-0 animate-spotlight-glow rounded-2xl"
          style={{ boxShadow: `inset 0 0 0 2px ${speaker.colorTo}` }}
          aria-hidden="true"
        />
      )}

      {/* 하단 그라디언트 + 이름/시그니처 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white drop-shadow sm:text-lg">
            {speaker.name}
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] leading-none text-white/90">
            {LENS_LABEL_KR[speaker.trait.lens]}
          </span>
          {mode === 'thinking' && (
            <span className="ml-auto animate-pulse text-[11px] text-white/70">준비 중…</span>
          )}
        </div>
        {mode === 'speaking' && signatureLine && (
          <p className="mt-1 line-clamp-1 text-xs italic text-white/85 drop-shadow sm:text-sm">
            &ldquo;{signatureLine}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}
