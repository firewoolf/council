import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind class merger. shadcn/ui 표준 cn 헬퍼.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
