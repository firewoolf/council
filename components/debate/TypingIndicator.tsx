import { PersonaOrb } from '@/components/persona/PersonaOrb';
import type { Archetype, CastMember } from '@/types/persona';

interface TypingIndicatorProps {
  /** Archetype 또는 CastMember 모두 수용 — 이름·색만 쓴다. */
  persona: Pick<Archetype | CastMember, 'name' | 'colorFrom' | 'colorTo'>;
}

/**
 * "{페르소나} 가 생각 중…" 인디케이터.
 * CLAUDE.md ⓬: 스켈레톤 로딩 금지, "생각 중..." 텍스트만 사용.
 *
 * 단순한 SVG dot 애니메이션 — CSS keyframes 만으로 작동, JS 불필요.
 */
export function TypingIndicator({ persona }: TypingIndicatorProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-3 animate-fade-in"
      style={{
        borderLeftWidth: 4,
        borderLeftColor: persona.colorTo,
      }}
    >
      <PersonaOrb persona={persona} size={32} glow="soft" className="animate-pulse-glow" />
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-primary">{persona.name}</span>
        <span className="inline-flex items-center gap-1 text-sm text-text-muted">
          생각 중
          <span className="inline-flex gap-0.5">
            <Dot delay={0} />
            <Dot delay={150} />
            <Dot delay={300} />
          </span>
        </span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block size-1 animate-pulse rounded-full bg-text-muted"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
