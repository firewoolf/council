import { cn } from '@/lib/utils';
import type { Archetype as Persona } from '@/types/persona';

interface PersonaOrbProps {
  persona: Pick<Persona, 'name' | 'colorFrom' | 'colorTo'>;
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
 * 페르소나의 정체성을 한 점으로 응축. 색과 이니셜만으로 식별 가능해야 한다.
 *
 * 디자인 선택:
 * - 한국어 이름의 첫 글자(initial) 표시.
 * - radial-gradient 로 깊이감 (한 쪽이 더 밝은 빛처럼)
 * - hover 시 미세 확대 (parent에서 group-hover 적용 가능)
 */
export function PersonaOrb({
  persona,
  size = 56,
  glow = 'soft',
  inactive = false,
  state = 'idle',
  className,
}: PersonaOrbProps) {
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
      <span
        className="font-display font-extrabold tracking-tight text-white/95 drop-shadow"
        style={{ fontSize }}
      >
        {initial}
      </span>
    </div>
  );
}
