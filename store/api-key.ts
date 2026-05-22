'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { AiProvider } from '@/lib/ai/providers';

/**
 * API 키 스토어 — BYOK 핵심.
 *
 * 키는 LocalStorage에만 저장. 서버에 절대 전송 안 함.
 * (이 스토어를 호출하는 모든 코드는 클라이언트 컴포넌트여야 한다.)
 */

interface ApiKeyState {
  /** 현재 선택된 공급사 */
  provider: AiProvider | null;
  /** 공급사별 키 저장 (사용자가 여러 키를 보관할 수 있게) */
  keys: Partial<Record<AiProvider, string>>;
  /** 마지막으로 연결 테스트 성공한 시각 (ISO) */
  lastTestedAt: Partial<Record<AiProvider, string>>;

  setProvider: (provider: AiProvider) => void;
  setKey: (provider: AiProvider, key: string) => void;
  clearKey: (provider: AiProvider) => void;
  markTested: (provider: AiProvider) => void;

  /** 현재 활성 키 — provider가 정해져 있고 그 공급사 키가 있으면 반환 */
  getActiveKey: () => string | null;
}

export const useApiKeyStore = create<ApiKeyState>()(
  persist(
    (set, get) => ({
      provider: null,
      keys: {},
      lastTestedAt: {},

      setProvider: (provider) => set({ provider }),

      setKey: (provider, key) =>
        set((s) => ({
          keys: { ...s.keys, [provider]: key.trim() },
        })),

      clearKey: (provider) =>
        set((s) => {
          const nextKeys = { ...s.keys };
          delete nextKeys[provider];
          const nextTested = { ...s.lastTestedAt };
          delete nextTested[provider];
          return { keys: nextKeys, lastTestedAt: nextTested };
        }),

      markTested: (provider) =>
        set((s) => ({
          lastTestedAt: {
            ...s.lastTestedAt,
            [provider]: new Date().toISOString(),
          },
        })),

      getActiveKey: () => {
        const { provider, keys } = get();
        if (!provider) return null;
        return keys[provider] ?? null;
      },
    }),
    {
      name: 'council:api-key',
      storage: createJSONStorage(() => localStorage),
      // 키 자체는 영구 저장. 사용자가 명시적으로 clearKey 하기 전까지 유지.
      partialize: (state) => ({
        provider: state.provider,
        keys: state.keys,
        lastTestedAt: state.lastTestedAt,
      }),
    },
  ),
);
