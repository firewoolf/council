'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from 'sonner';

import { generateChunk, generateConclusion } from '@/lib/ai/client';
import { AiCallError } from '@/lib/ai/errors';
import { PROVIDERS } from '@/lib/ai/providers';
import { runWithFallback } from '@/lib/ai/runWithFallback';
import { showAiError } from '@/lib/ai/showAiError';
import { readingTime } from '@/lib/utils';
import { useApiKeyStore } from '@/store/api-key';
import { useSessionsStore } from '@/store/sessions';
import type { ChunkMeta, Message, NextTopicChoice } from '@/types/debate';
import type { CastMember } from '@/types/persona';

/**
 * 트랙 ⑤-1 — 청크 엔진 + 재생 + 갈림길 phase 머신.
 *
 * 흐름:
 *   idle ─(start)─▶ generating ─(청크 도착)─▶ playing
 *     playing ─(턴 다 드러남)─▶ steering
 *     steering ─(소주제 선택/직접입력)─▶ generating ─▶ playing  (반복)
 *     steering ─(결론 내기)─▶ concluding ─▶ concluded
 *     generating/concluding ─(에러)─▶ error
 *
 * 재생 상태(`currentChunkIndex` / `revealedTurnCount`)는 ephemeral — persist 안 함.
 * 새로고침하면 저장된 메시지가 전부 한꺼번에 보이고, half-state 없다.
 */
export type DebatePhase =
  | 'idle'
  | 'generating'
  | 'playing'
  | 'steering'
  | 'concluding'
  | 'concluded'
  | 'error';

export type PlaybackSpeed = 1 | 2;

interface UseDebateReturn {
  phase: DebatePhase;
  /** 마지막 에러 메시지 */
  error: string | null;
  /** 활성 캐스트 */
  activePersonas: CastMember[];
  /** 전체 메시지 (저장된 청크 + 옛 평면 메시지) */
  messages: readonly Message[];
  /** 세션의 청크 메타 목록 */
  chunks: readonly ChunkMeta[];
  /** 현재 재생 중인 청크의 메타. steering 단계에서는 마지막 청크. */
  currentChunk: ChunkMeta | null;
  /** 재생 진행만큼 드러난 메시지 — DebateFeed 는 이걸 렌더. */
  revealedMessages: readonly Message[];
  /** 재생 일시정지 여부 */
  isPaused: boolean;
  /** 재생 속도 */
  speed: PlaybackSpeed;
  /** 현재 청크의 재생 진행 — revealed / total turn 수 */
  progress: { revealed: number; total: number };
  actions: {
    /** 첫 청크 생성 시작 */
    start: () => void;
    /** 재생 일시정지 / 재개 토글 */
    play: () => void;
    pause: () => void;
    /** 재생 속도 변경 */
    setSpeed: (s: PlaybackSpeed) => void;
    /** 탭 — 다음 턴 즉시 드러내기 */
    skipTurn: () => void;
    /** 갈림길에서 소주제 선택 → 다음 청크 생성 */
    chooseTopic: (label: string, hook?: string) => void;
    /** 갈림길에서 직접 입력 → 다음 청크 생성 */
    submitCustomTopic: (text: string) => void;
    /** 갈림길에서 "결론 내기" */
    conclude: () => void;
  };
}

const FIRST_GENERATING_DELAY_MS = 150;
const PHASE_TRANSITION_TAIL_MS = 600; // 마지막 턴 드러난 후 steering 으로 넘어가기 전 여유
const EMPTY_CAST: readonly CastMember[] = Object.freeze([]);

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 최근 N 메시지의 화자별 한 줄 압축.
 * "LLM 요약 호출 금지" — 토큰 절약이 청크의 목적이라 단순 조립만.
 */
function buildTranscript(
  messages: readonly Message[],
  cast: readonly CastMember[],
  maxTurns: number,
): string {
  const map = new Map(cast.map((c) => [c.id, c]));
  const tail = messages.slice(-maxTurns);
  return tail
    .map((m) => {
      if (m.speakerId === null) return `[사용자] ${m.content}`;
      const name = map.get(m.speakerId)?.name ?? '???';
      return `[${name}] ${m.content}`;
    })
    .join('\n');
}

export function useDebate(sessionId: string): UseDebateReturn {
  const session = useSessionsStore((s) => s.sessions[sessionId]);
  const cast = useSessionsStore((s) => s.sessionCast?.[sessionId] ?? EMPTY_CAST);
  const messages = useSessionsStore((s) => s.messages[sessionId]);
  const chunks = useSessionsStore((s) => s.sessionChunks?.[sessionId]);
  const conclusion = useSessionsStore((s) => s.conclusions[sessionId]);
  const appendMessage = useSessionsStore((s) => s.appendMessage);
  const addChunk = useSessionsStore((s) => s.addChunk);
  const updateChunkChoice = useSessionsStore((s) => s.updateChunkChoice);
  const saveConclusion = useSessionsStore((s) => s.saveConclusion);
  const updateSessionProvider = useSessionsStore((s) => s.updateSessionProvider);

  const keys = useApiKeyStore((s) => s.keys);
  const hasAnyKey = Object.values(keys).some((k) => !!k);

  const safeMessages = useMemo<readonly Message[]>(
    () => messages ?? [],
    [messages],
  );
  const safeChunks = useMemo<readonly ChunkMeta[]>(
    () => chunks ?? [],
    [chunks],
  );
  const activePersonas = useMemo<CastMember[]>(() => [...cast], [cast]);

  const [phase, setPhase] = useState<DebatePhase>(() =>
    conclusion ? 'concluded' : 'idle',
  );
  const [error, setError] = useState<string | null>(null);

  // 재생 엔진 — ephemeral
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(() => {
    // 새로고침 시: 저장된 청크가 있으면 마지막 청크의 steering 상태로 이어진다.
    // (실제 phase 결정은 별도 effect 에서)
    return Math.max(0, (chunks?.length ?? 1) - 1);
  });
  const [revealedTurnCount, setRevealedTurnCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  // 새로고침 후 — 저장된 청크가 있으면 마지막 청크 끝 + steering 으로 보정.
  // chunks 가 늦게 hydrate 되더라도 한 번 보정.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (conclusion) {
      hydratedRef.current = true;
      setPhase('concluded');
      return;
    }
    if (safeChunks.length > 0) {
      hydratedRef.current = true;
      const lastIdx = safeChunks.length - 1;
      setCurrentChunkIndex(lastIdx);
      // 모든 청크의 turn 을 다 보여준 상태로 시작
      const lastChunk = safeChunks[lastIdx];
      if (lastChunk) {
        const turnsInLast = safeMessages.filter(
          (m) => m.chunkId === lastChunk.id,
        ).length;
        setRevealedTurnCount(turnsInLast);
      }
      setPhase('steering');
    }
  }, [conclusion, safeChunks, safeMessages]);

  // 결론이 외부에서 저장되면 phase 동기화
  useEffect(() => {
    if (conclusion && phase !== 'concluded') {
      setPhase('concluded');
    }
  }, [conclusion, phase]);

  // ───────────────────────────── 청크 생성 트리거
  // phase 가 'generating' 이 될 때 호출. nextTopicForGeneration 에 다음 topic 을 박아둔다.
  const pendingTopicRef = useRef<{ topic: string; isFirst: boolean } | null>(null);
  const generateInFlightRef = useRef(false);

  useEffect(() => {
    if (phase !== 'generating') return;
    if (!session || !hasAnyKey) return;
    if (activePersonas.length < 2) return;
    if (generateInFlightRef.current) return;

    const pending = pendingTopicRef.current;
    if (!pending) return;

    let cancelled = false;
    generateInFlightRef.current = true;

    const handle = setTimeout(async () => {
      if (cancelled) return;
      try {
        const transcript = pending.isFirst
          ? ''
          : buildTranscript(safeMessages, cast, 12);

        const panel = cast.map((c) => ({
          name: c.name,
          role: c.role,
          stance: c.stance ?? '',
        }));

        const liveKeys = useApiKeyStore.getState().keys;
        const { result: chunk, usedProvider } = await runWithFallback(
          'chunk',
          liveKeys,
          (provider, apiKey) =>
            generateChunk({
              provider,
              apiKey,
              concern: session.concern,
              panel,
              topic: pending.topic,
              transcript,
              isFirst: pending.isFirst,
            }),
          {
            onFallback: (from, to) => {
              toast.info(
                `${PROVIDERS[from].displayName} 한도 → ${PROVIDERS[to].displayName} 로 자동 전환`,
                { duration: 4_000 },
              );
            },
          },
        );
        if (cancelled) return;

        updateSessionProvider(sessionId, usedProvider);

        // turn → Message 변환
        const newChunkId = generateId();
        const nameToCastId = new Map(cast.map((c) => [c.name, c.id]));
        const localIndexToMessageId = new Map<number, string>();
        const newMessages: Message[] = [];

        for (let i = 0; i < chunk.turns.length; i++) {
          const turn = chunk.turns[i]!;
          const speakerId = nameToCastId.get(turn.speakerName);
          if (!speakerId) {
            // 환각 — 명단에 없는 인물. 드롭 + 경고.
            toast.warning(
              `모델이 명단에 없는 인물(${turn.speakerName})을 등장시켜 발언을 건너뜁니다.`,
              { duration: 4_000 },
            );
            continue;
          }
          const msgId = generateId();
          localIndexToMessageId.set(i, msgId);
          const replyToMsgId =
            turn.replyToIndex !== null
              ? localIndexToMessageId.get(turn.replyToIndex)
              : undefined;
          newMessages.push({
            id: msgId,
            sessionId,
            speakerId,
            content: turn.message.trim(),
            createdAt: new Date().toISOString(),
            chunkId: newChunkId,
            isKeyPoint: turn.isKeyPoint,
            ...(replyToMsgId ? { replyTo: replyToMsgId } : {}),
          });
        }

        if (newMessages.length === 0) {
          throw new Error(
            '청크의 모든 발언이 환각 처리됨 — 명단의 이름과 일치하는 발언이 없습니다.',
          );
        }

        for (const m of newMessages) {
          appendMessage(sessionId, m);
        }

        const nextTopics: NextTopicChoice[] = chunk.nextTopics.map((t) => ({
          label: t.label,
          hook: t.hook,
          isBlindSpot: t.isBlindSpot,
        }));

        const chunkMeta: ChunkMeta = {
          id: newChunkId,
          sessionId,
          topic: pending.isFirst ? '_first' : pending.topic,
          nextTopics,
          createdAt: new Date().toISOString(),
        };
        addChunk(sessionId, chunkMeta);

        pendingTopicRef.current = null;

        // 재생 시작 — 새 청크 인덱스로 점프
        const newIdx = safeChunks.length; // 추가되기 전 길이 = 새 청크의 인덱스
        setCurrentChunkIndex(newIdx);
        setRevealedTurnCount(0);
        setIsPaused(false);
        setPhase('playing');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AiCallError) {
          showAiError(err, { alternateProvider: null });
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : 'unknown');
        }
        setPhase('error');
      } finally {
        generateInFlightRef.current = false;
      }
    }, FIRST_GENERATING_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    phase,
    session,
    hasAnyKey,
    activePersonas.length,
    cast,
    sessionId,
    safeMessages,
    safeChunks.length,
    appendMessage,
    addChunk,
    updateSessionProvider,
  ]);

  // ───────────────────────────── 재생 엔진
  // 현재 청크의 turn 들을 readingTime 만큼씩 setTimeout 으로 드러낸다.
  const currentChunk = safeChunks[currentChunkIndex] ?? null;
  const currentChunkTurns = useMemo<readonly Message[]>(() => {
    if (!currentChunk) return [];
    return safeMessages.filter((m) => m.chunkId === currentChunk.id);
  }, [currentChunk, safeMessages]);

  useEffect(() => {
    if (phase !== 'playing') return;
    if (isPaused) return;
    if (!currentChunk) return;

    if (revealedTurnCount >= currentChunkTurns.length) {
      // 한 청크 다 드러남 → 약간의 여유 후 steering
      const handle = setTimeout(() => {
        setPhase('steering');
      }, PHASE_TRANSITION_TAIL_MS);
      return () => clearTimeout(handle);
    }

    const nextTurn = currentChunkTurns[revealedTurnCount];
    if (!nextTurn) return;

    const delay = readingTime(nextTurn.content) / speed;
    const handle = setTimeout(() => {
      setRevealedTurnCount((c) => c + 1);
    }, delay);

    return () => clearTimeout(handle);
  }, [phase, isPaused, currentChunk, currentChunkTurns, revealedTurnCount, speed]);

  // revealedMessages: 이전 청크들의 모든 turn + 현재 청크의 revealed 만큼.
  const revealedMessages = useMemo<readonly Message[]>(() => {
    const result: Message[] = [];
    for (let i = 0; i < currentChunkIndex; i++) {
      const c = safeChunks[i];
      if (!c) continue;
      for (const m of safeMessages) {
        if (m.chunkId === c.id) result.push(m);
      }
    }
    // 청크 이전 옛 평면 메시지(있다면) 도 포함 — 마이그레이션 무중단
    for (const m of safeMessages) {
      if (!m.chunkId && !result.includes(m)) {
        result.unshift(m); // 옛 메시지는 청크들 앞에 (시간순 가정)
      }
    }
    if (currentChunk) {
      const revealed = currentChunkTurns.slice(0, revealedTurnCount);
      result.push(...revealed);
      // steering 단계에서는 모든 턴이 드러난 상태로 본다
      if (phase === 'steering' || phase === 'concluding' || phase === 'concluded') {
        const all = currentChunkTurns;
        // revealed 가 부족하면 채운다
        for (const m of all) {
          if (!result.includes(m)) result.push(m);
        }
      }
    }
    return result;
  }, [
    safeChunks,
    safeMessages,
    currentChunkIndex,
    currentChunk,
    currentChunkTurns,
    revealedTurnCount,
    phase,
  ]);

  // ───────────────────────────── 결론 생성
  useEffect(() => {
    if (phase !== 'concluding') return;
    if (!session || !hasAnyKey) return;
    if (conclusion) {
      setPhase('concluded');
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      if (cancelled) return;
      try {
        const liveKeys = useApiKeyStore.getState().keys;
        const { result, usedProvider } = await runWithFallback(
          'conclude',
          liveKeys,
          (provider, apiKey) =>
            generateConclusion({
              provider,
              apiKey,
              concern: session.concern,
              messages: safeMessages,
              cast,
            }),
          {
            onFallback: (from, to) => {
              toast.info(
                `결론 생성: ${PROVIDERS[from].displayName} 한도 → ${PROVIDERS[to].displayName} 로 전환`,
                { duration: 4_000 },
              );
            },
          },
        );
        if (cancelled) return;
        updateSessionProvider(sessionId, usedProvider);
        saveConclusion(sessionId, result);
        setPhase('concluded');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AiCallError) {
          showAiError(err, { alternateProvider: null });
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : 'unknown');
        }
        setPhase('error');
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    phase,
    session,
    hasAnyKey,
    safeMessages,
    cast,
    sessionId,
    saveConclusion,
    updateSessionProvider,
    conclusion,
  ]);

  // ───────────────────────────── 액션
  const start = useCallback(() => {
    setError(null);
    pendingTopicRef.current = { topic: '_first', isFirst: true };
    setPhase('generating');
  }, []);

  const play = useCallback(() => setIsPaused(false), []);
  const pause = useCallback(() => setIsPaused(true), []);
  const setSpeedAction = useCallback((s: PlaybackSpeed) => setSpeed(s), []);

  const skipTurn = useCallback(() => {
    if (phase !== 'playing') return;
    setRevealedTurnCount((c) =>
      Math.min(c + 1, currentChunkTurns.length),
    );
  }, [phase, currentChunkTurns.length]);

  const chooseTopic = useCallback(
    (label: string, _hook?: string) => {
      void _hook;
      if (phase !== 'steering') return;
      const last = safeChunks[currentChunkIndex];
      if (last) updateChunkChoice(sessionId, last.id, label);
      setError(null);
      pendingTopicRef.current = { topic: label, isFirst: false };
      setPhase('generating');
    },
    [phase, safeChunks, currentChunkIndex, updateChunkChoice, sessionId],
  );

  const submitCustomTopic = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      chooseTopic(trimmed);
    },
    [chooseTopic],
  );

  const conclude = useCallback(() => {
    setError(null);
    setPhase('concluding');
  }, []);

  return {
    phase,
    error,
    activePersonas,
    messages: safeMessages,
    chunks: safeChunks,
    currentChunk,
    revealedMessages,
    isPaused,
    speed,
    progress: {
      revealed: Math.min(revealedTurnCount, currentChunkTurns.length),
      total: currentChunkTurns.length,
    },
    actions: {
      start,
      play,
      pause,
      setSpeed: setSpeedAction,
      skipTurn,
      chooseTopic,
      submitCustomTopic,
      conclude,
    },
  };
}
