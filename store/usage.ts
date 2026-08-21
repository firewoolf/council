'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { AiProvider } from '@/lib/ai/providers';

export const MAX_SESSIONS = 30;

/** 호출 종류 — client.ts 함수 1:1 대응. */
export type UsageKind =
  | 'chunk'
  | 'conclusion'
  | 'clarify'
  | 'panel'
  | 'recommend'
  | 'topics'
  | 'mirror'
  | 'ping';

export interface UsageBucket {
  /** 호출 수 */
  n: number;
  /** 프롬프트(입력) 토큰 누적 */
  inTok: number;
  /** 완성(출력) 토큰 누적 */
  outTok: number;
  /** 캐시 적중 입력 토큰 누적 */
  cachedTok: number;
}

export interface SessionUsage extends UsageBucket {
  byKind: Partial<Record<UsageKind, UsageBucket>>;
  /** 이 세션에서 실제로 쓰인 공급사들 */
  providers: Partial<Record<AiProvider, UsageBucket>>;
  /** 첫 호출 시각(ms) — 정렬·LRU 용 */
  startedAt: number;
}

/**
 * 사용량 스토어 — 전체 AI 호출 횟수를 공급사별로 집계.
 *
 * 모든 AI 호출은 runWithFallback 단일 통로를 지나므로, 성공 시 거기서 bump 한다.
 * 사용자에게는 접이식 인디케이터(UsageIndicator)로 조용히 노출 — 공급사 한도/전환을
 * 불안한 토스트로 띄우는 대신, 원할 때만 펼쳐 보는 정보로 둔다.
 *
 * LocalStorage 저장 (BYOK 스토어와 동일 정책, 서버 전송 없음).
 */

export interface UsageState {
  /** 공급사별 성공 호출 횟수 */
  calls: Partial<Record<AiProvider, number>>;
  /** 전체 호출 횟수 */
  total: number;
  /** 마지막 사용 공급사 */
  lastProvider: AiProvider | null;
  currentSessionId: string | null;
  byKind: Partial<Record<UsageKind, UsageBucket>>;
  byProviderKind: Partial<
    Record<AiProvider, Partial<Record<UsageKind, UsageBucket>>>
  >;
  bySession: Record<string, SessionUsage>;

  bump: (provider: AiProvider) => void;
  setSession: (sessionId: string | null) => void;
  report: (args: {
    provider: AiProvider;
    kind: UsageKind;
    promptTokens?: number;
    completionTokens?: number;
    cachedTokens?: number;
  }) => void;
  reset: () => void;
}

const EMPTY_BUCKET: UsageBucket = { n: 0, inTok: 0, outTok: 0, cachedTok: 0 };

function tokenCount(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function addUsage(
  bucket: UsageBucket | undefined,
  inTok: number,
  outTok: number,
  cachedTok: number,
): UsageBucket {
  const current = bucket ?? EMPTY_BUCKET;
  return {
    n: current.n + 1,
    inTok: current.inTok + inTok,
    outTok: current.outTok + outTok,
    cachedTok: current.cachedTok + cachedTok,
  };
}

export const useUsageStore = create<UsageState>()(
  persist(
    (set) => ({
      calls: {},
      total: 0,
      lastProvider: null,
      currentSessionId: null,
      byKind: {},
      byProviderKind: {},
      bySession: {},

      bump: (provider) =>
        set((s) => ({
          calls: { ...s.calls, [provider]: (s.calls[provider] ?? 0) + 1 },
          total: s.total + 1,
          lastProvider: provider,
        })),

      setSession: (sessionId) => set({ currentSessionId: sessionId }),

      report: ({ provider, kind, promptTokens, completionTokens, cachedTokens }) =>
        set((s) => {
          const inTok = tokenCount(promptTokens);
          const outTok = tokenCount(completionTokens);
          const cachedTok = tokenCount(cachedTokens);
          const byKind = {
            ...s.byKind,
            [kind]: addUsage(s.byKind[kind], inTok, outTok, cachedTok),
          };
          const providerKinds = s.byProviderKind[provider] ?? {};
          const byProviderKind = {
            ...s.byProviderKind,
            [provider]: {
              ...providerKinds,
              [kind]: addUsage(providerKinds[kind], inTok, outTok, cachedTok),
            },
          };

          if (s.currentSessionId === null) return { byKind, byProviderKind };

          const sessionId = s.currentSessionId;
          const previous = s.bySession[sessionId];
          const base: SessionUsage = previous ?? {
            ...EMPTY_BUCKET,
            byKind: {},
            providers: {},
            startedAt: Date.now(),
          };
          const updated: SessionUsage = {
            ...addUsage(base, inTok, outTok, cachedTok),
            byKind: {
              ...base.byKind,
              [kind]: addUsage(base.byKind[kind], inTok, outTok, cachedTok),
            },
            providers: {
              ...base.providers,
              [provider]: addUsage(
                base.providers[provider],
                inTok,
                outTok,
                cachedTok,
              ),
            },
            startedAt: base.startedAt,
          };
          const bySession = { ...s.bySession, [sessionId]: updated };
          const sessionIds = Object.keys(bySession);
          if (sessionIds.length > MAX_SESSIONS) {
            sessionIds
              .sort((a, b) => bySession[a]!.startedAt - bySession[b]!.startedAt)
              .slice(0, sessionIds.length - MAX_SESSIONS)
              .forEach((id) => delete bySession[id]);
          }
          return { byKind, byProviderKind, bySession };
        }),

      reset: () =>
        set({
          calls: {},
          total: 0,
          lastProvider: null,
          currentSessionId: null,
          byKind: {},
          byProviderKind: {},
          bySession: {},
        }),
    }),
    {
      name: 'council-usage',
      storage: createJSONStorage(() => localStorage),
      version: 3,
      migrate: (persisted, from) => {
        const s = (persisted ?? {}) as Partial<UsageState>;
        return {
          calls: s.calls ?? {},
          total: s.total ?? 0,
          lastProvider: s.lastProvider ?? null,
          currentSessionId: null,
          byKind: from < 3 ? {} : (s.byKind ?? {}),
          byProviderKind: from < 3 ? {} : (s.byProviderKind ?? {}),
          bySession: from < 3 ? {} : (s.bySession ?? {}),
        };
      },
      partialize: (s) => ({
        calls: s.calls,
        total: s.total,
        lastProvider: s.lastProvider,
        byKind: s.byKind,
        byProviderKind: s.byProviderKind,
        bySession: s.bySession,
      }),
    },
  ),
);
