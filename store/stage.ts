'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface StageState {
  /** sessionId → backgroundId */
  backgroundBySession: Record<string, string>;
  setBackground: (sessionId: string, backgroundId: string) => void;
}

export const useStageStore = create<StageState>()(
  persist(
    (set) => ({
      backgroundBySession: {},
      setBackground: (sessionId, backgroundId) =>
        set((s) => ({
          backgroundBySession: { ...s.backgroundBySession, [sessionId]: backgroundId },
        })),
    }),
    { name: 'council-stage', storage: createJSONStorage(() => localStorage) },
  ),
);
