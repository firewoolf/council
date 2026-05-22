import { cn } from '@/lib/utils';
import type { Persona } from '@/types/persona';

interface PersonaOrbProps {
  persona: Pick<Persona, 'name' | 'colorFrom' | 'colorTo'>;
  /** px 단위 — 32(작은 발언자 아이콘), 56(카드), 80(스테이지) */
  size?: number;
  /** 글로우 효과 강도 */
  glow?: 'none' | 'soft' | 'strong';
  /** 비활성 — 채도 빠진 표현 */
  inactive?: boolean;
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
  className,
}: PersonaOrbProps) {
  const initial = persona.name.charAt(0);

  // 인라인 스타일이 어울리는 케이스 — 색은 페르소나 데이터에서 동적.
  const orbStyle: React.CSSProperties = {
    width: size,
    height: size,
    background: `radial-gradient(circle at 30% 30%, ${persona.colorTo}, ${persona.colorFrom})`,
    boxShadow:
      glow === 'none' || inactive
        ? 'none'
        : glow === 'strong'
          ? `0 0 ${size * 0.45}px ${persona.colorTo}66`
          : `0 0 ${size * 0.3}px ${persona.colorTo}44`,
    filter: inactive ? 'saturate(0.25) brightness(0.7)' : undefined,
  };

  const fontSize = Math.max(12, Math.round(size * 0.42));

  return (
    <div
      role="img"
      aria-label={`${persona.name} 아이콘`}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full transition-transform',
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
