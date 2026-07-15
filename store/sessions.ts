'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { Conclusion } from '@/lib/prompts/orchestrator';
import { PERSONA_MAP } from '@/lib/prompts/personas';
import type { ChunkMeta, Message, Pin, Session } from '@/types/debate';
import type { Archetype, CastMember, Trait } from '@/types/persona';

/**
 * 세션 + 메시지 로컬 저장소.
 * Supabase 도입 전까지 LocalStorage가 단일 진실 공급원.
 *
 * 마이그레이션:
 *   v0 → v1 (Phase B): sessionPersonas(string[]) → sessionCast(CastMember[])
 *   v1 → v2 (Phase E): CastMember.temperament(enum) → CastMember.trait(3축 객체)
 *
 * 모르는 값 → 안전 기본값으로 강등하되 세션/cast 는 살린다 (B-1 패턴 그대로).
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
  /**
   * 트랙 ⑤-1 — 세션별 청크 메타 목록. 가산적 필드 — 청크 이전 세션은 undefined.
   * turn 본문은 그대로 messages 에 평면 저장. 여기엔 topic·nextTopics·chosenNext 만.
   */
  sessionChunks?: Record<string, ChunkMeta[]>;
  /**
   * I-2 — 세션별 핀 집합. 가산적 필드 — 없으면 ?? [] 폴백(마이그레이션 무중단).
   */
  pins?: Record<string, Pin[]>;

  createSession: (input: {
    concern: string;
    title?: string;
    cast: CastMember[];
    aiProvider: Session['aiProvider'];
    domain?: string | null;
    miContext?: string;
  }) => Session;

  getSession: (id: string) => Session | undefined;
  getCast: (id: string) => CastMember[];
  getCastMember: (sessionId: string, memberId: string) => CastMember | undefined;
  getDomain: (id: string) => string | null;
  getMessages: (id: string) => Message[];
  getConclusion: (id: string) => Conclusion | null;
  /** 트랙 ⑤-1 — 항상 ?? [] 폴백. 청크 이전 세션이면 빈 배열. */
  getChunks: (id: string) => ChunkMeta[];

  appendMessage: (sessionId: string, message: Message) => void;
  updateCast: (sessionId: string, cast: CastMember[]) => void;
  /**
   * D-1: 자동 폴백 시 실제 사용 공급사 동기화. 값이 같으면 no-op.
   */
  updateSessionProvider: (
    sessionId: string,
    provider: Session['aiProvider'],
  ) => void;

  /** 트랙 ⑤-1 — 새 청크 메타 추가. */
  addChunk: (sessionId: string, chunk: ChunkMeta) => void;
  /** 트랙 ⑤-1 — 갈림길에서 사용자가 고른 다음 소주제를 청크에 기록. */
  updateChunkChoice: (
    sessionId: string,
    chunkId: string,
    chosenNextLabel: string,
  ) => void;

  /** I-2 — 핀 토글 (있으면 제거, 없으면 추가). */
  togglePin: (sessionId: string, messageId: string) => void;
  /** I-2 — 핀에 메모 결합 (핀 없으면 무시). */
  setPinNote: (sessionId: string, messageId: string, note: string) => void;
  /** I-2 — 세션의 핀 목록. */
  getPins: (sessionId: string) => Pin[];

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

// ─── Phase E: v1 → v2 마이그레이션 헬퍼 ─────────────────────────────────────

/** Phase B 의 단일 temperament enum → v2 3축 기본값 매핑. */
const TEMPERAMENT_TO_TRAIT: Record<string, Trait> = {
  advocate:    { stanceAxis: 'advocate', lens: 'pragmatist', expression: 'measured' },
  critic:      { stanceAxis: 'critic',   lens: 'analyst',    expression: 'measured' },
  analyst:     { stanceAxis: 'agnostic', lens: 'analyst',    expression: 'measured' },
  provocateur: { stanceAxis: 'agnostic', lens: 'pragmatist', expression: 'provocateur' },
  empath:      { stanceAxis: 'agnostic', lens: 'empath',     expression: 'measured' },
};
const DEFAULT_TRAIT: Trait = { stanceAxis: 'agnostic', lens: 'pragmatist', expression: 'measured' };

/**
 * v1 → v2: CastMember.temperament → CastMember.trait
 *
 * - archetype 멤버는 PERSONA_MAP 의 최신 trait 로 덮어씀 (가장 정확).
 * - generated/custom 멤버는 TEMPERAMENT_TO_TRAIT 표로 변환.
 * - 알 수 없는 값 → DEFAULT_TRAIT. cast/session 은 살린다.
 */
function migrateV1ToV2(persisted: Partial<SessionsState>): Partial<SessionsState> {
  const sessionCast: Record<string, CastMember[]> = {};

  for (const [sid, members] of Object.entries(persisted.sessionCast ?? {})) {
    sessionCast[sid] = members.map((m) => {
      // 이미 trait 가 있으면 그대로 (중복 마이그레이션 방지)
      if (m.trait && m.trait.stanceAxis) return m;

      const oldTemperament = (m as unknown as Record<string, unknown>).temperament as string | undefined;

      let trait: Trait;
      if (m.source === 'archetype' && m.archetypeId) {
        // 아키타입은 최신 personas.json 의 trait 를 우선
        const arch = PERSONA_MAP[m.archetypeId];
        trait = arch ? arch.trait : (TEMPERAMENT_TO_TRAIT[oldTemperament ?? ''] ?? DEFAULT_TRAIT);
      } else {
        trait = TEMPERAMENT_TO_TRAIT[oldTemperament ?? ''] ?? DEFAULT_TRAIT;
      }

      // temperament 필드 제거 (필요 없는 키 정리)
      const { temperament: _t, ...rest } = m as CastMember & { temperament?: unknown };
      void _t;
      return { ...rest, trait } as CastMember;
    });
  }

  return { ...persisted, sessionCast };
}

// ─── Phase B: v0 → v1 마이그레이션 ───────────────────────────────────────────

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
        trait: arch.trait,
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
      sessionChunks: {},
      pins: {},

      createSession: ({ concern, title, cast, aiProvider, domain, miContext }) => {
        const id = generateId();
        const session: Session = {
          id,
          title: title ?? summarizeTitle(concern),
          concern,
          status: 'active',
          aiProvider,
          ...(miContext ? { miContext } : {}),
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
      getChunks: (id) => get().sessionChunks?.[id] ?? [],
      getPins: (id) => get().pins?.[id] ?? [],

      togglePin: (sessionId, messageId) =>
        set((s) => {
          const prev = s.pins?.[sessionId] ?? [];
          const exists = prev.some((p) => p.messageId === messageId);
          const next = exists
            ? prev.filter((p) => p.messageId !== messageId)
            : [
                ...prev,
                {
                  messageId,
                  sessionId,
                  createdAt: new Date().toISOString(),
                },
              ];
          return { pins: { ...(s.pins ?? {}), [sessionId]: next } };
        }),

      setPinNote: (sessionId, messageId, note) =>
        set((s) => {
          const prev = s.pins?.[sessionId] ?? [];
          const next = prev.map((p) =>
            p.messageId === messageId ? { ...p, note } : p,
          );
          return { pins: { ...(s.pins ?? {}), [sessionId]: next } };
        }),

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

      addChunk: (sessionId, chunk) =>
        set((s) => {
          const prev = s.sessionChunks?.[sessionId] ?? [];
          return {
            sessionChunks: {
              ...(s.sessionChunks ?? {}),
              [sessionId]: [...prev, chunk],
            },
          };
        }),

      updateChunkChoice: (sessionId, chunkId, chosenNextLabel) =>
        set((s) => {
          const prev = s.sessionChunks?.[sessionId];
          if (!prev) return s;
          const next = prev.map((c) =>
            c.id === chunkId ? { ...c, chosenNextLabel } : c,
          );
          return {
            sessionChunks: {
              ...(s.sessionChunks ?? {}),
              [sessionId]: next,
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
          const nextChunks = { ...(s.sessionChunks ?? {}) };
          delete nextChunks[id];
          const nextPins = { ...(s.pins ?? {}) };
          delete nextPins[id];
          return {
            sessions: nextSessions,
            sessionCast: nextCast,
            messages: nextMessages,
            domains: nextDomains,
            conclusions: nextConclusions,
            sessionChunks: nextChunks,
            pins: nextPins,
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
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted, version) => {
        let state = persisted as Partial<SessionsState>;
        // v0 → v1 (Phase B: sessionPersonas → sessionCast)
        if (version < 1) {
          state = migrateV0ToV1(state);
        }
        // v1 → v2 (Phase E: temperament → trait)
        if (version < 2) {
          state = migrateV1ToV2(state);
        }
        return state as SessionsState;
      },
    },
  ),
);
