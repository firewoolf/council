'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { Conclusion } from '@/lib/prompts/orchestrator';
import type { Message, Session } from '@/types/debate';

/**
 * 세션 + 메시지 로컬 저장소.
 * Supabase 도입 전까지 LocalStorage가 단일 진실 공급원.
 *
 * 저장 단위:
 *   sessions: Record<sessionId, Session>
 *   sessionPersonas: Record<sessionId, string[]>  (personaId 배열)
 *   messages: Record<sessionId, Message[]>
 *   domains: Record<sessionId, string | null>  (도메인 전문가 동적 분야)
 */

interface SessionsState {
  sessions: Record<string, Session>;
  sessionPersonas: Record<string, string[]>;
  messages: Record<string, Message[]>;
  domains: Record<string, string | null>;
  conclusions: Record<string, Conclusion>;

  createSession: (input: {
    concern: string;
    title?: string;
    personaIds: string[];
    aiProvider: Session['aiProvider'];
    domain?: string | null;
  }) => Session;

  getSession: (id: string) => Session | undefined;
  getPersonaIds: (id: string) => string[];
  getDomain: (id: string) => string | null;
  getMessages: (id: string) => Message[];
  getConclusion: (id: string) => Conclusion | null;

  appendMessage: (sessionId: string, message: Message) => void;
  updatePersonaIds: (sessionId: string, personaIds: string[]) => void;
  /**
   * D-1: 토론 중 폴백이 발생해서 실제 사용 공급사가 바뀌었을 때.
   * 기존 값과 같으면 no-op — 매 턴마다 호출돼도 zustand write 안 일어남.
   */
  updateSessionProvider: (
    sessionId: string,
    provider: Session['aiProvider'],
  ) => void;

  /** 결론 저장 시 status를 concluded로 자동 전환 */
  saveConclusion: (sessionId: string, conclusion: Conclusion) => void;

  concludeSession: (id: string) => void;
  deleteSession: (id: string) => void;

  /** 최신순 정렬된 세션 목록 (createdAt desc) */
  listRecent: (limit?: number) => Session[];
}

function generateId(): string {
  // crypto.randomUUID는 브라우저(secure context)에서 사용 가능. fallback 포함.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function summarizeTitle(concern: string): string {
  const trimmed = concern.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 40) return trimmed;
  return `${trimmed.slice(0, 38)}…`;
}

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set, get) => ({
      sessions: {},
      sessionPersonas: {},
      messages: {},
      domains: {},
      conclusions: {},

      createSession: ({ concern, title, personaIds, aiProvider, domain }) => {
        const id = generateId();
        const session: Session = {
          id,
          title: title ?? summarizeTitle(concern),
          concern,
          status: 'active',
          aiProvider,
          createdAt: new Date().toISOString(),
        };

        set((s) => ({
          sessions: { ...s.sessions, [id]: session },
          sessionPersonas: { ...s.sessionPersonas, [id]: personaIds },
          messages: { ...s.messages, [id]: [] },
          domains: { ...s.domains, [id]: domain ?? null },
        }));

        return session;
      },

      getSession: (id) => get().sessions[id],
      getPersonaIds: (id) => get().sessionPersonas[id] ?? [],
      getDomain: (id) => get().domains[id] ?? null,
      getMessages: (id) => get().messages[id] ?? [],
      getConclusion: (id) => get().conclusions[id] ?? null,

      saveConclusion: (sessionId, conclusion) =>
        set((s) => {
          const current = s.sessions[sessionId];
          return {
            conclusions: { ...s.conclusions, [sessionId]: conclusion },
            sessions: current
              ? { ...s.sessions, [sessionId]: { ...current, status: 'concluded' } }
              : s.sessions,
          };
        }),

      appendMessage: (sessionId, message) =>
        set((s) => ({
          messages: {
            ...s.messages,
            [sessionId]: [...(s.messages[sessionId] ?? []), message],
          },
        })),

      updatePersonaIds: (sessionId, personaIds) =>
        set((s) => ({
          sessionPersonas: { ...s.sessionPersonas, [sessionId]: personaIds },
        })),

      updateSessionProvider: (sessionId, provider) =>
        set((s) => {
          const current = s.sessions[sessionId];
          if (!current || current.aiProvider === provider) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: { ...current, aiProvider: provider },
            },
          };
        }),

      concludeSession: (id) =>
        set((s) => {
          const current = s.sessions[id];
          if (!current) return s;
          return {
            sessions: {
              ...s.sessions,
              [id]: { ...current, status: 'concluded' },
            },
          };
        }),

      deleteSession: (id) =>
        set((s) => {
          const nextSessions = { ...s.sessions };
          delete nextSessions[id];
          const nextPersonas = { ...s.sessionPersonas };
          delete nextPersonas[id];
          const nextMessages = { ...s.messages };
          delete nextMessages[id];
          const nextDomains = { ...s.domains };
          delete nextDomains[id];
          const nextConclusions = { ...s.conclusions };
          delete nextConclusions[id];
          return {
            sessions: nextSessions,
            sessionPersonas: nextPersonas,
            messages: nextMessages,
            domains: nextDomains,
            conclusions: nextConclusions,
          };
        }),

      listRecent: (limit = 10) => {
        const all = Object.values(get().sessions);
        return all
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, limit);
      },
    }),
    {
      name: 'council:sessions',
      storage: createJSONStorage(() => localStorage),
      // 모든 상태 영속. 메시지가 무거워지면 별도 키로 분리 검토 (STEP 4 이후).
    },
  ),
);
