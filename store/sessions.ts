'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { Conclusion } from '@/lib/prompts/orchestrator';
import { PERSONA_MAP } from '@/lib/prompts/personas';
import type { Message, Session } from '@/types/debate';
import type { Archetype, CastMember } from '@/types/persona';

/**
 * 세션 + 메시지 로컬 저장소.
 * Supabase 도입 전까지 LocalStorage가 단일 진실 공급원.
 *
 * Phase B 마이그레이션 (v0 → v1):
 *   v0: sessionPersonas: Record<sessionId, string[]>
 *       + sessionStances: Record<sessionId, Record<personaId, string>>  (Phase A)
 *   v1: sessionCast:    Record<sessionId, CastMember[]>
 *
 * v0 → v1 변환은 모든 personaId 가 아키타입(고정 10명) 출신이라는 가정에서
 * 안전하다. 모르는 id 는 드롭하되 앱은 살려둔다.
 *
 * 저장 단위:
 *   sessions: Record<sessionId, Session>
 *   sessionCast: Record<sessionId, CastMember[]>
 *   messages: Record<sessionId, Message[]>
 *   domains: Record<sessionId, string | null>  (도메인 전문가 동적 분야 — 호환 잔존)
 *   conclusions: Record<sessionId, Conclusion>
 */

interface SessionsState {
  sessions: Record<string, Session>;
  sessionCast: Record<string, CastMember[]>;
  messages: Record<string, Message[]>;
  domains: Record<string, string | null>;
  conclusions: Record<string, Conclusion>;

  createSession: (input: {
    concern: string;
    title?: string;
    cast: CastMember[];
    aiProvider: Session['aiProvider'];
    domain?: string | null;
  }) => Session;

  getSession: (id: string) => Session | undefined;
  getCast: (id: string) => CastMember[];
  getCastMember: (sessionId: string, memberId: string) => CastMember | undefined;
  getDomain: (id: string) => string | null;
  getMessages: (id: string) => Message[];
  getConclusion: (id: string) => Conclusion | null;

  appendMessage: (sessionId: string, message: Message) => void;
  updateCast: (sessionId: string, cast: CastMember[]) => void;
  /**
   * D-1: 자동 폴백 시 실제 사용 공급사 동기화. 값이 같으면 no-op.
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

/**
 * v0 → v1 데이터 변환.
 * 옛 `sessionPersonas`(string[]) + `sessionStances` 를 `sessionCast` 로 합친다.
 *
 * 예외 처리:
 *   - 옛 personaId 가 PERSONA_MAP 에 없으면 그 멤버만 드롭(세션은 살림).
 *   - sessionPersonas 자체가 없으면 빈 cast 로 둠.
 */
function migrateV0ToV1(persisted: unknown): Partial<SessionsState> {
  const old = (persisted ?? {}) as {
    sessionPersonas?: Record<string, string[]>;
    sessionStances?: Record<string, Record<string, string>>;
    sessionCast?: Record<string, CastMember[]>;
    [k: string]: unknown;
  };

  // 이미 v1 형태로 있으면(혼합 상태 대비) 그대로 보존.
  const sessionCast: Record<string, CastMember[]> = { ...(old.sessionCast ?? {}) };

  for (const [sid, ids] of Object.entries(old.sessionPersonas ?? {})) {
    if (sessionCast[sid]) continue; // v1 데이터 우선
    const members: CastMember[] = [];
    for (const aid of ids ?? []) {
      const arch: Archetype | undefined = PERSONA_MAP[aid];
      if (!arch) continue; // 알 수 없는 아키타입 → 드롭 (앱은 살림)
      members.push({
        id: aid, // §4.3 — 아키타입 id 그대로 (messages.speakerId 호환)
        source: 'archetype',
        archetypeId: aid,
        name: arch.name,
        role: arch.role,
        temperament: arch.temperament,
        stance: old.sessionStances?.[sid]?.[aid] ?? '',
        colorFrom: arch.colorFrom,
        colorTo: arch.colorTo,
        isFacilitator: aid === 'facilitator',
      });
    }
    sessionCast[sid] = members;
  }

  // 옛 키 정리해서 반환
  const { sessionPersonas: _p, sessionStances: _s, ...rest } = old;
  void _p;
  void _s;
  return { ...(rest as Partial<SessionsState>), sessionCast };
}

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set, get) => ({
      sessions: {},
      sessionCast: {},
      messages: {},
      domains: {},
      conclusions: {},

      createSession: ({ concern, title, cast, aiProvider, domain }) => {
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
          sessionCast: { ...s.sessionCast, [id]: cast },
          messages: { ...s.messages, [id]: [] },
          domains: { ...s.domains, [id]: domain ?? null },
        }));

        return session;
      },

      getSession: (id) => get().sessions[id],
      getCast: (id) => get().sessionCast?.[id] ?? [],
      getCastMember: (sessionId, memberId) =>
        get().sessionCast?.[sessionId]?.find((m) => m.id === memberId),
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

      updateCast: (sessionId, cast) =>
        set((s) => ({
          sessionCast: { ...s.sessionCast, [sessionId]: cast },
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
          const nextCast = { ...(s.sessionCast ?? {}) };
          delete nextCast[id];
          const nextMessages = { ...s.messages };
          delete nextMessages[id];
          const nextDomains = { ...s.domains };
          delete nextDomains[id];
          const nextConclusions = { ...s.conclusions };
          delete nextConclusions[id];
          return {
            sessions: nextSessions,
            sessionCast: nextCast,
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
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted, version) => {
        if (version >= 1) return persisted as SessionsState;
        // v0 → v1 (Phase B 마이그레이션)
        return migrateV0ToV1(persisted) as SessionsState;
      },
    },
  ),
);
