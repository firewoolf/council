'use client';

import { Flag, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { playSound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import type { NextTopicChoice } from '@/types/debate';

interface NextDirectionsProps {
  topics: readonly NextTopicChoice[];
  onChoose: (label: string, hook?: string) => void;
  onConclude: () => void;
}

export function NextDirections({
  topics,
  onChoose,
  onConclude,
}: NextDirectionsProps) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {topics.map((topic, index) => (
          <li key={`${index}-${topic.label}`}>
            <button
              type="button"
              onClick={() => {
                playSound('steering-decide');
                onChoose(topic.label, topic.hook);
              }}
              className={cn(
                'flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
                topic.isBlindSpot
                  ? 'border-accent/60 bg-accent/10 shadow-[0_0_20px_hsl(var(--accent)/0.1)] hover:border-accent'
                  : 'border-border bg-surface-2 hover:border-primary/40 hover:bg-primary/5',
              )}
            >
              <div className="flex items-center gap-2">
                {topic.isBlindSpot && (
                  <Sparkles className="size-4 shrink-0 text-accent" />
                )}
                <span
                  className={cn(
                    'text-sm font-semibold leading-snug',
                    topic.isBlindSpot ? 'text-accent' : 'text-text',
                  )}
                >
                  {topic.label}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-text-muted">
                {topic.hook}
              </p>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex justify-end border-t border-border pt-3">
        <Button variant="secondary" size="sm" onClick={onConclude}>
          <Flag className="size-3.5" />
          결론 내기
        </Button>
      </div>
    </div>
  );
}
