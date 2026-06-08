import { cn } from '@/lib/utils';

interface StatGaugeProps {
  label: string;
  score: 1 | 2 | 3 | 4 | 5;
  /** 채운 별 색 — 기본 accent, 카드에선 persona colorTo 주입 가능. */
  color?: string;
  /** 'sm' 카드용(작게) | 'md' 드로어용. */
  size?: 'sm' | 'md';
  className?: string;
}

export function StatGauge({
  label,
  score,
  color,
  size = 'sm',
  className,
}: StatGaugeProps) {
  return (
    <div
      className={cn('flex min-w-0 items-center gap-1.5', className)}
      role="img"
      aria-label={`${label} 5점 만점에 ${score}점`}
    >
      <span
        className={cn(
          'shrink-0 text-text-muted',
          size === 'sm' ? 'text-[10px]' : 'text-xs',
        )}
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'shrink-0 font-mono leading-none tracking-normal',
          size === 'sm' ? 'text-[11px]' : 'text-sm',
        )}
        style={{ color: color ?? 'var(--accent)' }}
      >
        {'★'.repeat(score)}
        <span className="text-text-dim">{'☆'.repeat(5 - score)}</span>
      </span>
    </div>
  );
}
