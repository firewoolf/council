'use client';

import { useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Code2,
  Heart,
  Mountain,
  Palette,
  Rocket,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Archetype, CastMember } from '@/types/persona';

/**
 * ⑤-5d — archetype 별 lucide 아이콘 매핑.
 *
 * 동급생 식 캐릭터 식별성 — 페르소나가 *한 점* 이 아닌 *얼굴* 로 보인다.
 * archetype 출신 멤버만 아이콘 (generated/custom 은 initial 글자 폴백).
 * 워크오더 ⑤-5 §G+ 박제 매핑 그대로.
 */
const ARCHETYPE_ICONS: Record<string, LucideIcon> = {
  'cold-investor':       BarChart3,
  'cynical-dev':         Code2,
  'jobs-designer':       Sparkles,
  'realist':             Mountain,
  'startup-expert':      Rocket,
  'branding-strategist': Palette,
  'psychologist':        Heart,
  'growth-marketer':     TrendingUp,
  'domain-expert':       BookOpen,
  'facilitator':         Users,
};

/** ⑤-5f-A — 반신 일러스트 자산 루트. */
const PORTRAIT_BASE = '/personas/portraits';

interface PersonaOrbProps {
  /**
   * 표시 대상. Archetype 또는 CastMember 둘 다 받음.
   * - archetypeId 가 있으면 (CastMember 의 archetype 출신) → ARCHETYPE_ICONS 조회
   * - id 가 있으면 (Archetype 직접 전달) → ARCHETYPE_ICONS 조회
   * - 둘 다 매칭 안 되면 (generated/custom) → 이름 첫 글자 폴백
   */
  persona: Pick<Archetype | CastMember, 'name' | 'colorFrom' | 'colorTo'> & {
    id?: string;
    archetypeId?: string;
  };
  /** px 단위 — 32(작은 발언자 아이콘), 56(카드), 80(스테이지) */
  size?: number;
  /** 글로우 효과 강도 */
  glow?: 'none' | 'soft' | 'strong';
  /** 비활성 — 채도 빠진 표현 */
  inactive?: boolean;
  /**
   * 트랙 ⑤-2a — 살아남 모드.
   * - 'idle'     : 기존 정적 동작 (기본값)
   * - 'speaking' : 맥동 (orb-pulse 1.5s) + glow strong 강제
   * - 'thinking' : 부유 (orb-bob 0.6s) + glow soft 강제
   */
  state?: 'idle' | 'speaking' | 'thinking';
  className?: string;
}

/**
 * 페르소나 시그니처 — 그라디언트 동그라미.
 *
 * ⑤-5f-A 폴백 3단:
 *   1. 이미지 자산 (public/personas/portraits/{archetypeId}.webp)
 *   2. lucide 아이콘 (⑤-5d, archetype 출신만)
 *   3. 이름 첫 글자 (generated/custom 출신)
 *
 * fix ⓐ — objectPosition: '50% 20%' 으로 반신 일러스트 얼굴(상단 1/3) 보정.
 * fix ⓑ — 이미지 모드에선 radial-gradient 가 이미지에 가려지므로
 *           border ring 으로 페르소나 색 시그니처 유지.
 *           speaking 펄스(box-shadow 애니메이션)는 border ring 위에 발산.
 */
export function PersonaOrb({
  persona,
  size = 56,
  glow = 'soft',
  inactive = false,
  state = 'idle',
  className,
}: PersonaOrbProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgErrored, setImgErrored] = useState(false);

  // ⑤-5d — archetype 출신이면 아이콘, 아니면 첫 글자
  const iconKey = persona.archetypeId ?? persona.id;
  const Icon: LucideIcon | undefined =
    iconKey ? ARCHETYPE_ICONS[iconKey] : undefined;
  const initial = persona.name.charAt(0);

  // ⑤-5f-A — 이미지 자산: lucide 아이콘이 있는 archetype 에만 시도 (generated/custom 제외)
  const portraitPath =
    Icon && iconKey ? `${PORTRAIT_BASE}/${iconKey}.webp` : undefined;

  // 3단 폴백 우선순위
  const showImage = !!(portraitPath && !imgErrored);
  const showIcon = !showImage && !!Icon;
  // showInitial: !showImage && !showIcon

  // state 가 glow 를 강제하는 경우
  const effectiveGlow: typeof glow =
    state === 'speaking' ? 'strong' : state === 'thinking' ? 'soft' : glow;

  // ─── 인라인 스타일 구성 ────────────────────────────────────────────────────
  // 그라디언트 배경은 항상 유지 (이미지 뒤 후광 + 이미지 로딩 중 자리 표시).
  const orbStyle: React.CSSProperties = {
    width: size,
    height: size,
    background: `radial-gradient(circle at 30% 30%, ${persona.colorTo}, ${persona.colorFrom})`,
    filter: inactive ? 'saturate(0.25) brightness(0.7)' : undefined,
  };

  if (showImage) {
    // fix ⓑ: 이미지가 그라디언트를 덮으므로 border ring 으로 페르소나 색 유지.
    // border 는 box-shadow 와 독립 — speaking 맥동 애니메이션(box-shadow) 과 충돌 없음.
    orbStyle.border = `2px solid ${persona.colorTo}`;
    // speaking 상태: animation 이 box-shadow 담당 (inline 생략).
    // 그 외: glow 표현.
    if (state !== 'speaking') {
      orbStyle.boxShadow =
        effectiveGlow === 'none' || inactive
          ? 'none'
          : effectiveGlow === 'strong'
            ? `0 0 ${size * 0.45}px ${persona.colorTo}66`
            : `0 0 ${size * 0.3}px ${persona.colorTo}44`;
    }
  } else {
    // 기존 그라디언트 모드 — speaking 은 animation 에 위임, 나머지는 inline.
    if (state !== 'speaking') {
      orbStyle.boxShadow =
        effectiveGlow === 'none' || inactive
          ? 'none'
          : effectiveGlow === 'strong'
            ? `0 0 ${size * 0.45}px ${persona.colorTo}66`
            : `0 0 ${size * 0.3}px ${persona.colorTo}44`;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const iconSize = Math.max(12, Math.round(size * 0.5));
  const fontSize = Math.max(12, Math.round(size * 0.42));

  return (
    <div
      role="img"
      aria-label={`${persona.name} 아이콘`}
      className={cn(
        // overflow-hidden: 이미지가 rounded-full 경계 밖으로 넘치지 않도록
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        // state 에 따른 CSS 애니메이션
        state === 'speaking' && 'animate-orb-pulse',
        state === 'thinking' && 'animate-orb-bob',
        // speaking/thinking 이면 transition 생략 (animation 이 transform 을 제어)
        state === 'idle' && 'transition-transform',
        className,
      )}
      style={orbStyle}
    >
      {/* ⑤-5f-A — 반신 일러스트 (1순위) */}
      {showImage && (
        // native <img> 의도 사용 — onError 폴백 + loading="lazy" 브라우저 네이티브 필요.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portraitPath!}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgErrored(true)}
          className={cn(
            'absolute inset-0 size-full object-cover',
            // fix ⓐ: 반신 일러스트 얼굴이 상단 1/3 에 집중됨 — center top 정렬
            'transition-opacity duration-300',
            imgLoaded ? 'opacity-100' : 'opacity-0',
          )}
          style={{ objectPosition: '50% 20%' }}
        />
      )}

      {/* ⑤-5d — lucide 아이콘 (2순위) */}
      {showIcon && (
        <Icon
          className="text-white/95 drop-shadow"
          style={{ width: iconSize, height: iconSize }}
          aria-hidden="true"
        />
      )}

      {/* 이름 첫 글자 (3순위 — generated/custom 출신) */}
      {!showImage && !showIcon && (
        <span
          className="font-display font-extrabold tracking-tight text-white/95 drop-shadow"
          style={{ fontSize }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
