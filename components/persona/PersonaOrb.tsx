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
 * 페르소나의 정체성을 한 점으로 응축.
 *
 * 디자인 진화:
 * - ⑤-2a 이전: 색 + 한국어 이름 첫 글자
 * - ⑤-5d (현재): archetype 출신은 lucide 아이콘으로 캐릭터 식별성 강화.
 *   generated/custom 은 첫 글자 폴백 (그들만의 정체성).
 * - radial-gradient 로 깊이감 (한 쪽이 더 밝은 빛처럼)
 */
export function PersonaOrb({
  persona,
  size = 56,
  glow = 'soft',
  inactive = false,
  state = 'idle',
  className,
}: PersonaOrbProps) {
  // ⑤-5d — archetype 출신이면 아이콘, 아니면 첫 글자
  const iconKey = persona.archetypeId ?? persona.id;
  const Icon: LucideIcon | undefined =
    iconKey ? ARCHETYPE_ICONS[iconKey] : undefined;
  const initial = persona.name.charAt(0);

  // state 가 glow 를 강제하는 경우
  const effectiveGlow: typeof glow =
    state === 'speaking' ? 'strong' : state === 'thinking' ? 'soft' : glow;

  // 인라인 스타일이 어울리는 케이스 — 색은 페르소나 데이터에서 동적.
  // speaking 상태에선 box-shadow 를 CSS keyframe 이 제어하므로 inline 생략.
  const orbStyle: React.CSSProperties = {
    width: size,
    height: size,
    background: `radial-gradient(circle at 30% 30%, ${persona.colorTo}, ${persona.colorFrom})`,
    ...(state !== 'speaking'
      ? {
          boxShadow:
            effectiveGlow === 'none' || inactive
              ? 'none'
              : effectiveGlow === 'strong'
                ? `0 0 ${size * 0.45}px ${persona.colorTo}66`
                : `0 0 ${size * 0.3}px ${persona.colorTo}44`,
        }
      : {}),
    filter: inactive ? 'saturate(0.25) brightness(0.7)' : undefined,
  };

  // 아이콘 크기 — orb 의 50%. fontSize 와 같은 비율.
  const iconSize = Math.max(12, Math.round(size * 0.5));
  const fontSize = Math.max(12, Math.round(size * 0.42));

  return (
    <div
      role="img"
      aria-label={`${persona.name} 아이콘`}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full',
        // state 에 따른 CSS 애니메이션
        state === 'speaking' && 'animate-orb-pulse',
        state === 'thinking' && 'animate-orb-bob',
        // speaking/thinking 이면 transition 생략 (animation 이 transform 을 제어)
        state === 'idle' && 'transition-transform',
        className,
      )}
      style={orbStyle}
    >
      {Icon ? (
        <Icon
          className="text-white/95 drop-shadow"
          style={{ width: iconSize, height: iconSize }}
          aria-hidden="true"
        />
      ) : (
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
