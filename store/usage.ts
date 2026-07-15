'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { AiProvider } from '@/lib/ai/providers';

/**
 * 사용량 스토어 — 전체 AI 호출 횟수를 공급사별로 집계.
 *
 * 모든 AI 호출은 runWithFallback 단일 통로를 지나므로, 성공 시 거기서 bump 한다.
 * 사용자에게는 접이식 인디케이터(UsageIndicator)로 조용히 노출 — 공급사 한도/전환을
 * 불안한 토스트로 띄우는 대신, 원할 때만 펼쳐 보는 정보로 둔다.
 *
 * LocalStorage 저장 (BYOK 스토어와 동일 정책, 서버 전송 없음).
 */

interface UsageState {
  /** 공급사별 성공 호출 횟수 */
  calls: Partial<Record<AiProvider, number>>;
  /** 전체 호출 횟수 */
  total: number;
  /** 마지막 사용 공급사 */
  lastProvider: AiProvider | null;

  bump: (provider: AiProvider) => void;
  reset: () => void;
}

export const useUsageStore = create<UsageState>()(
  persist(
    (set) => ({
      calls: {},
      total: 0,
      lastProvider: null,

      bump: (provider) =>
        set((s) => ({
          calls: { ...s.calls, [provider]: (s.calls[provider] ?? 0) + 1 },
          total: s.total + 1,
          lastProvider: provider,
        })),

      reset: () => set({ calls: {}, total: 0, lastProvider: null }),
    }),
    {
      name: 'council-usage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
