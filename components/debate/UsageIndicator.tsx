'use client';

import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';

import { PROVIDERS, type AiProvider } from '@/lib/ai/providers';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useUsageStore } from '@/store/usage';
import { cn } from '@/lib/utils';

/**
 * 접이식 사용량 인디케이터.
 *
 * 전체 AI 호출 횟수를 공급사별로 조용히 보여준다. 기본 접힘.
 * 공급사 한도/전환을 불안한 토스트로 띄우는 대신, 원할 때만 펼쳐 확인하는 정보로 둔다.
 * 사용 기록이 없으면 렌더하지 않는다.
 */
export function UsageIndicator({ className }: { className?: string }) {
  const mounted = useHasMounted();
  const [open, setOpen] = useState(false);
  const total = useUsageStore((s) => s.total);
  const calls = useUsageStore((s) => s.calls);
  const lastProvider = useUsageStore((s) => s.lastProvider);

  if (!mounted || total === 0) return null;

  const entries = (Object.entries(calls) as [AiProvider, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className={cn('rounded-lg border border-border bg-surface/60', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <Activity className="size-3.5" />
          사용량 <span className="font-mono text-text/80">{total}</span>회
          {lastProvider && (
            <span className="text-text-muted/60">
              · {PROVIDERS[lastProvider].displayName}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="size-3.5 text-text-muted" />
        ) : (
          <ChevronDown className="size-3.5 text-text-muted" />
        )}
      </button>

      {open && (
        <div className="space-y-1 border-t border-border px-3 py-2">
          {entries.map(([provider, n]) => (
            <div key={provider} className="flex items-center justify-between text-xs">
              <span className="text-text/80">{PROVIDERS[provider].displayName}</span>
              <span className="font-mono text-text-muted">{n}회</span>
            </div>
          ))}
          <p className="pt-1 text-[10px] leading-relaxed text-text-muted/60">
            공급사 무료 한도에 도달하면 다른 공급사로 자동 전환됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
