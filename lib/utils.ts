import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind class merger. shadcn/ui 표준 cn 헬퍼.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 트랙 ⑤-1 — 한국어 발언 한 줄의 권장 노출 시간(ms).
 *
 * 기준치: 한국어 묵독 속도 ~ 400자/분 = 6.67자/초 ≈ 150ms/자.
 * 짧은 발언은 너무 빨리 사라지지 않게 최소 800ms, 긴 발언도 끊김 없이
 * 다음 턴이 이어지도록 최대 6000ms 로 클램프.
 *
 * ⑤-5e 튜닝 (2026-06-01): ms/char 150 → 180, min 800 → 1200.
 * 한국어 평균 읽기 속도 더 여유있게 + 짧은 발언도 최소 1.2초 보장.
 *
 * 재생 엔진은 이 값을 speed(1x/2x) 로 나눠 setTimeout 딜레이로 쓴다.
 */
export function readingTime(content: string): number {
  const len = content.trim().length;
  const ms = len * 180;
  return Math.max(1200, Math.min(6000, ms));
}
