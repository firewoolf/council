'use client';

import { useEffect, useState } from 'react';

import type { PlaybackSpeed } from '@/hooks/useDebate';

interface TypewriterTextProps {
  text: string;
  speed: PlaybackSpeed;
  onAdvance: () => void;
}

export function TypewriterText({
  text,
  speed,
  onAdvance,
}: TypewriterTextProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const complete = visibleCount >= text.length;

  useEffect(() => {
    setVisibleCount(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleCount(text.length);
      return;
    }

    const interval = window.setInterval(() => {
      setVisibleCount((count) => {
        if (count >= text.length) {
          window.clearInterval(interval);
          return count;
        }
        return count + 1;
      });
    }, 28 / speed);

    return () => window.clearInterval(interval);
  }, [text, speed]);

  return (
    <button
      type="button"
      onClick={() => {
        if (complete) {
          onAdvance();
        } else {
          setVisibleCount(text.length);
        }
      }}
      className="w-full cursor-pointer whitespace-pre-wrap text-left text-base font-normal leading-relaxed text-text"
      aria-label={complete ? '다음 발언으로' : '타이핑 즉시 완성'}
    >
      {text.slice(0, visibleCount)}
      {!complete && (
        <span className="ml-0.5 inline-block animate-pulse text-primary" aria-hidden="true">
          ▌
        </span>
      )}
    </button>
  );
}
