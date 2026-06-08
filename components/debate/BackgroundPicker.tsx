'use client';
import { X } from 'lucide-react';
import { STAGE_BACKGROUNDS } from '@/lib/stage/backgrounds';
import { useStageStore } from '@/store/stage';
import { cn } from '@/lib/utils';

export function BackgroundPicker({
  sessionId, currentId, open, onClose,
}: { sessionId: string; currentId: string; open: boolean; onClose: () => void }) {
  const setBackground = useStageStore((s) => s.setBackground);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[39] animate-fade-in bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="배경 선택"
        className="drawer-enter fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-4 sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:w-[420px] sm:rounded-l-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-text">배경 선택</p>
          <button onClick={onClose} aria-label="닫기" className="text-text-muted hover:text-text"><X className="size-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {STAGE_BACKGROUNDS.map((b) => (
            <button key={b.id} type="button"
              onClick={() => { setBackground(sessionId, b.id); onClose(); }}
              className={cn('relative aspect-video overflow-hidden rounded-lg border text-left',
                b.id === currentId ? 'border-primary ring-2 ring-primary/40' : 'border-border')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.path} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              <span className="absolute bottom-1 left-2 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[11px] text-white backdrop-blur">{b.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
