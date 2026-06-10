'use client';

import { X } from 'lucide-react';

import { NextDirections } from './NextDirections';
import type { ChunkMeta } from '@/types/debate';

interface SteeringSheetProps {
  chunk: ChunkMeta;
  open: boolean;
  onClose: () => void;
  onChoose: (label: string, hook?: string) => void;
  onConclude: () => void;
}

export function SteeringSheet({
  chunk,
  open,
  onClose,
  onChoose,
  onConclude,
}: SteeringSheetProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[39] bg-black/55 backdrop-blur-sm lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="다음 방향 고르기"
        className="drawer-enter fixed inset-x-0 bottom-0 z-40 max-h-[78vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">다음 방향 고르기</h2>
            <p className="mt-1 text-xs text-text-muted">
              시트를 내려도 토론은 이 갈림길에서 기다립니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex size-9 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>
        <NextDirections
          topics={chunk.nextTopics}
          onChoose={(label, hook) => {
            onClose();
            onChoose(label, hook);
          }}
          onConclude={() => {
            onClose();
            onConclude();
          }}
        />
      </section>
    </>
  );
}
