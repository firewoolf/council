'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from 'sonner';

import type { DebateStatus } from '@/components/debate/DebateControls';
import { generateConclusion, generateSpeech } from '@/lib/ai/client';
import { AiCallError } from '@/lib/ai/errors';
import { PROVIDERS } from '@/lib/ai/providers';
import { runWithFallback } from '@/lib/ai/runWithFallback';
import { showAiError } from '@/lib/ai/showAiError';
import {
  buildDebateContext,
  decideNextSpeaker,
} from '@/lib/prompts/orchestrator';
import { composePersonaPrompt } from '@/lib/prompts/personas';
import { useApiKeyStore } from '@/store/api-key';
import { useSessionsStore } from '@/store/sessions';
import type { Message } from '@/types/debate';
import type { CastMember } from '@/types/persona';

interface UseDebateReturn {
  status: DebateStatus;
  /** 현재 발언 생성 중인 멤버 (UI: 생각 중...) */
  thinkingPersona: CastMember | null;
  /** 마지막 에러 메시지 */
  error: string | null;
  /** 활성 캐스트 (이 세션 출연진) */
  activePersonas: CastMember[];
  actions: {
    start: () => void;
    pause: () => void;
    resume: () => void;
    /** 결론 즉시 트리거 (사용자 요청) */
    conclude: () => void;
    /** 사용자 발언 삽입 — 페르소나들이 반응. 'paused'면 자동 재개. */
    injectUserMessage: (content: string) => void;
    /** 사용자 메타 지시 — 발언 카운트엔 안 들어가고, 다음 페르소나 발언부터 반영. */
    injectInstruction: (content: string) => void;
    /** 진행 중 멤버 추가. 이미 있으면 무시. */
    addCastMember: (member: CastMember) => void;
  };
}

const TURN_DELAY_MS = 900;
const FIRST_TURN_DELAY_MS = 250;
// 모듈 레벨 const — reference equality 유지로 zustand 셀렉터 무한 재구독 방지.
const EMPTY_CAST: readonly CastMember[] = Object.freeze([]);

function generateMessageId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 자동 토론 루프 훅.
 *
 * 상태 머신:
 *   idle ──(start)──▶ running ──(pause)──▶ paused
 *                       │                    │
 *                       │ shouldConclude      │
 *                       ▼                    │
 *                   concluding ◀──(conclude)─┘
 *                       │
 *                       ▼
 *                   concluded
 *
 * 루프 구조:
 *   useEffect([status, messages]) ──▶ setTimeout ──▶ decideNextSpeaker
 *                                                    │
 *                                                    ▼
 *                                              generateSpeech
 *                                                    │
 *                                                    ▼
 *                                              appendMessage
 *                                                    │
 *                                                    ▼ (messages 변경 → 재진입)
 *
 * 동시 호출 가드:
 *   - inFlightRef: 한 번에 하나의 LLM 호출만 진행 (strict mode 대응)
 *   - cleanup의 cancelled flag: 언마운트/재진입 시 stale 응답 무시
 */
export function useDebate(sessionId: string): UseDebateReturn {
  const session = useSessionsStore((s) => s.sessions[sessionId]);
  // Phase B — sessionCast 가 단일 진실. (옛 sessionPersonas + sessionStances 는 migrate 로 흡수됨)
  const cast = useSessionsStore((s) => s.sessionCast?.[sessionId] ?? EMPTY_CAST);
  const messages = useSessionsStore((s) => s.messages[sessionId]);
  const domain = useSessionsStore((s) => s.domains[sessionId] ?? null);
  const conclusion = useSessionsStore((s) => s.conclusions[sessionId]);
  const appendMessage = useSessionsStore((s) => s.appendMessage);
  const updateCast = useSessionsStore((s) => s.updateCast);
  const saveConclusion = useSessionsStore((s) => s.saveConclusion);
  const updateSessionProvider = useSessionsStore((s) => s.updateSessionProvider);

  // 라우팅 결정은 호출 시점에 useApiKeyStore.getState() 로 한다.
  // 여기선 "키가 하나라도 있는지" 만 구독하면 충분 → 토론 중 키 변경 시 effect 재진입.
  // (keys 객체 reference 가 바뀔 때만 재진입 — 빈번하지 않음.)
  const keys = useApiKeyStore((s) => s.keys);
  const hasAnyKey = Object.values(keys).some((k) => !!k);

  const safeMessages = useMemo<readonly Message[]>(
    () => messages ?? [],
    [messages],
  );

  const activePersonas = useMemo<CastMember[]>(() => [...cast], [cast]);

  // 결론이 이미 있으면 시작부터 concluded 상태
  const [status, setStatus] = useState<DebateStatus>(() =>
    conclusion ? 'concluded' : 'idle',
  );
  const [thinkingPersona, setThinkingPersona] = useState<CastMember | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inFlightRef = useRef(false);

  // 결론이 외부에서 저장되면 (예: 새로고침 후) 상태 동기화
  useEffect(() => {
    if (conclusion && status !== 'concluded') {
      setStatus('concluded');
    }
  }, [conclusion, status]);

  // ───────────────────────────── 메인 토론 루프
  useEffect(() => {
    if (status !== 'running') return;
    if (!session || !hasAnyKey) return;
    if (activePersonas.length < 2) return;
    if (inFlightRef.current) return;

    let cancelled = false;
    const delay =
      safeMessages.length === 0 ? FIRST_TURN_DELAY_MS : TURN_DELAY_MS;

    const handle = setTimeout(async () => {
      if (cancelled) return;
      inFlightRef.current = true;

      try {
        const decision = decideNextSpeaker(activePersonas, safeMessages);

        // HARD_LIMIT 초과 → 자동 결론으로 전환
        if (decision.shouldConclude) {
          if (!cancelled) setStatus('concluding');
          return;
        }

        if (!decision.nextSpeaker) {
          if (!cancelled) setStatus('idle');
          return;
        }

        const speaker = decision.nextSpeaker;
        if (!cancelled) setThinkingPersona(speaker);

        // Phase B — composePersonaPrompt 는 CastMember 한 명을 받는다.
        // stance/temperament/캐릭터 프롬프트 모두 cast 내부에 있음. domain 인자 제거.
        const systemPrompt = composePersonaPrompt(speaker, {
          concern: session.concern,
        });
        const userPrompt = buildDebateContext(
          session.concern,
          safeMessages,
          cast,
        );

        // Phase B+C: 'debate' 적합 공급사로 시도, quota 시 다른 공급사로 자동 폴백.
        // 폴백 발생 시 사용자에게 짧은 알림 — 무슨 일이 일어났는지 알게.
        const liveKeys = useApiKeyStore.getState().keys;
        const { result: speech, usedProvider } = await runWithFallback(
          'debate',
          liveKeys,
          (provider, apiKey) =>
            generateSpeech({
              provider,
              apiKey,
              system: systemPrompt,
              prompt: userPrompt,
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
        // D-1: 세션 메타데이터를 실제 사용 공급사와 동기화 (값이 같으면 store no-op)
        updateSessionProvider(sessionId, usedProvider);

        if (cancelled) return;

        // replyToId 무결성 — 모델이 가짜 ID를 만들 수 있어 검증
        const validReplyTo =
          speech.replyToId &&
          safeMessages.some((m) => m.id === speech.replyToId)
            ? speech.replyToId
            : undefined;

        const newMessage: Message = {
          id: generateMessageId(),
          sessionId,
          speakerId: speaker.id,
          content: speech.message.trim(),
          replyTo: validReplyTo,
          isQuestion: speech.isQuestion,
          createdAt: new Date().toISOString(),
        };

        appendMessage(sessionId, newMessage);
      } catch (err) {
        if (cancelled) return;
        // AiCallError → 모든 후보 소진. 친절한 토스트 + status='error' 로 정지.
        // 사용자가 /settings 에서 키를 손보고 "다시 시작" 누르면 재개 가능.
        if (err instanceof AiCallError) {
          showAiError(err, { alternateProvider: null });
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : 'unknown');
        }
        setStatus('error');
      } finally {
        inFlightRef.current = false;
        if (!cancelled) setThinkingPersona(null);
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    status,
    safeMessages,
    activePersonas,
    cast,
    session,
    hasAnyKey,
    sessionId,
    appendMessage,
    updateSessionProvider,
  ]);

  // ───────────────────────────── 결론 생성
  // inFlightRef 가드를 쓰지 않는 이유:
  //   사용자가 토론 진행 중("결론 내기" 클릭)에 트리거할 수 있는데,
  //   메인 루프의 in-flight LLM call이 끝날 때까지 inFlightRef=true가 유지되어
  //   결론 effect 가 영영 진행되지 않는 데드락이 발생.
  // 대신:
  //   1) setTimeout 으로 한 박자 늦춰 cleanup 이 먼저 동작하도록 함 (strict mode 더블 호출 방지)
  //   2) cancelled flag + conclusion 존재 가드로 중복 저장 차단.
  useEffect(() => {
    if (status !== 'concluding') return;
    if (!session || !hasAnyKey) return;
    if (conclusion) {
      // 이미 결론이 저장되어 있으면 상태만 동기화하고 끝
      setStatus('concluded');
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      if (cancelled) return;
      try {
        // Phase B+C: 'conclude' 적합 공급사로 시도, quota 시 다른 공급사로 자동 폴백
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
        // D-1: 결론 단계도 메타데이터 동기화
        updateSessionProvider(sessionId, usedProvider);
        saveConclusion(sessionId, result);
        setStatus('concluded');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AiCallError) {
          showAiError(err, { alternateProvider: null });
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : 'unknown');
        }
        setStatus('error');
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    status,
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
    setStatus('running');
  }, []);
  const pause = useCallback(() => setStatus('paused'), []);
  const resume = useCallback(() => {
    setError(null);
    setStatus('running');
  }, []);
  const conclude = useCallback(() => setStatus('concluding'), []);

  const injectUserMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const msg: Message = {
        id: generateMessageId(),
        sessionId,
        speakerId: null,
        kind: 'speech',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      appendMessage(sessionId, msg);
      // 결론/결론중이 아니라면 페르소나가 반응하도록 자동 재개
      setStatus((curr) =>
        curr === 'concluded' || curr === 'concluding' ? curr : 'running',
      );
      setError(null);
    },
    [appendMessage, sessionId],
  );

  const injectInstruction = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const msg: Message = {
        id: generateMessageId(),
        sessionId,
        speakerId: null,
        kind: 'instruction',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      appendMessage(sessionId, msg);
      // 지시는 톤/관점만 바꿀 뿐이므로 자동 재개는 하지 않는다.
    },
    [appendMessage, sessionId],
  );

  const addCastMember = useCallback(
    (member: CastMember) => {
      if (cast.some((m) => m.id === member.id)) return;
      updateCast(sessionId, [...cast, member]);
    },
    [cast, sessionId, updateCast],
  );

  return {
    status,
    thinkingPersona,
    error,
    activePersonas,
    actions: {
      start,
      pause,
      resume,
      conclude,
      injectUserMessage,
      injectInstruction,
      addCastMember,
    },
  };
}
