'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DebateStatus } from '@/components/debate/DebateControls';
import { generateConclusion, generateSpeech } from '@/lib/ai/client';
import {
  buildDebateContext,
  decideNextSpeaker,
} from '@/lib/prompts/orchestrator';
import {
  composePersonaPrompt,
  PERSONA_MAP,
} from '@/lib/prompts/personas';
import { useApiKeyStore } from '@/store/api-key';
import { useSessionsStore } from '@/store/sessions';
import type { Message } from '@/types/debate';
import type { Persona } from '@/types/persona';

interface UseDebateReturn {
  status: DebateStatus;
  /** 현재 발언 생성 중인 페르소나 (UI: 생각 중...) */
  thinkingPersona: Persona | null;
  /** 마지막 에러 메시지 */
  error: string | null;
  /** 활성 페르소나 (이 세션에 참여 중) */
  activePersonas: Persona[];
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
    /** 진행 중 페르소나 추가. 이미 있으면 무시. */
    addPersona: (personaId: string) => void;
  };
}

const TURN_DELAY_MS = 900;
const FIRST_TURN_DELAY_MS = 250;

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
  const personaIds = useSessionsStore((s) => s.sessionPersonas[sessionId]);
  const messages = useSessionsStore((s) => s.messages[sessionId]);
  const domain = useSessionsStore((s) => s.domains[sessionId] ?? null);
  const conclusion = useSessionsStore((s) => s.conclusions[sessionId]);
  const appendMessage = useSessionsStore((s) => s.appendMessage);
  const updatePersonaIds = useSessionsStore((s) => s.updatePersonaIds);
  const saveConclusion = useSessionsStore((s) => s.saveConclusion);

  const { provider, getActiveKey } = useApiKeyStore();
  const apiKey = getActiveKey();

  const safeMessages = useMemo<readonly Message[]>(
    () => messages ?? [],
    [messages],
  );

  const activePersonas = useMemo<Persona[]>(() => {
    const ids = personaIds ?? [];
    return ids
      .map((id) => PERSONA_MAP[id])
      .filter((p): p is Persona => Boolean(p));
  }, [personaIds]);

  // 결론이 이미 있으면 시작부터 concluded 상태
  const [status, setStatus] = useState<DebateStatus>(() =>
    conclusion ? 'concluded' : 'idle',
  );
  const [thinkingPersona, setThinkingPersona] = useState<Persona | null>(null);
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
    if (!session || !apiKey || !provider) return;
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

        const systemPrompt = composePersonaPrompt(speaker, {
          domain: domain ?? undefined,
          concern: session.concern,
        });
        const userPrompt = buildDebateContext(
          session.concern,
          safeMessages,
          PERSONA_MAP,
        );

        const speech = await generateSpeech({
          provider,
          apiKey,
          system: systemPrompt,
          prompt: userPrompt,
        });

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
        setError(err instanceof Error ? err.message : 'unknown');
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
    session,
    apiKey,
    provider,
    domain,
    sessionId,
    appendMessage,
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
    if (!session || !apiKey || !provider) return;
    if (conclusion) {
      // 이미 결론이 저장되어 있으면 상태만 동기화하고 끝
      setStatus('concluded');
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      if (cancelled) return;
      try {
        const result = await generateConclusion({
          provider,
          apiKey,
          concern: session.concern,
          messages: safeMessages,
          personaMap: PERSONA_MAP,
        });
        if (cancelled) return;
        saveConclusion(sessionId, result);
        setStatus('concluded');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'unknown');
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
    apiKey,
    provider,
    safeMessages,
    sessionId,
    saveConclusion,
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

  const addPersona = useCallback(
    (personaId: string) => {
      if (!personaIds || personaIds.includes(personaId)) return;
      updatePersonaIds(sessionId, [...personaIds, personaId]);
    },
    [personaIds, sessionId, updatePersonaIds],
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
      addPersona,
    },
  };
}
