'use client';

import { create } from 'zustand';

/**
 * 임베드 로그인 인증 스토어 — 서버키 프록시 게이트용.
 *
 * insight-out 임베드가 로그인 사용자 티켓을 postMessage 로 넘기면 여기에 보관한다.
 * 티켓이 있고 서버 공급사 목록이 채워지면 "서버 모드"가 활성 —
 * 이때는 사용자가 BYOK 키를 넣지 않아도 서버 등록 키로 토론이 돈다.
 *
 * 지속 저장 안 함(persist X) — 티켓은 짧은 수명이고 매 세션 임베드가 다시 넘긴다.
 */

/**
 * getModel 에 "서버 모드로 호출하라"는 신호로 쓰는 키 센티넬.
 * 실제 정의는 순수 모듈(lib/ai/providers)에 있다 — listAvailableProviders 가
 * 서버 모드를 판별해야 하는데, 스토어를 import 하면 순환이 된다.
 */
export { SERVER_KEY_SENTINEL } from '@/lib/ai/providers';

/**
 * 트랙 T-3 — 접속 모드 3종. `null` 은 "아직 서버가 알려주지 않음"(= insight-out
 * 임베드 postMessage 경로, mode 를 안 실어 보냄) 을 뜻하며 access.ts 가 'paid' 로
 * 간주한다 — EmbedBridge.tsx 는 무수정이라 여기서 기본값을 못 받는다.
 */
export type AccessMode = 'byok' | 'demo' | 'paid';

interface EmbedAuthState {
  /** insight-out 이 발급한 로그인 티켓 (HMAC 서명) */
  ticket: string | null;
  /** 서버에 키가 등록돼 쓸 수 있는 공급사 목록 (/api/ai/config 결과) */
  serverProviders: string[];
  /** /api/ai/config 가 실어 보낸 티켓 모드. EmbedBridge 경로는 세팅 안 함(=paid 취급). */
  mode: AccessMode | null;

  setTicket: (ticket: string | null) => void;
  setServerProviders: (providers: string[]) => void;
  setMode: (mode: AccessMode | null) => void;
  /** 서버 모드 활성 여부 */
  isServerMode: () => boolean;
}

export const useEmbedAuthStore = create<EmbedAuthState>((set, get) => ({
  ticket: null,
  serverProviders: [],
  mode: null,

  setTicket: (ticket) => set({ ticket }),
  setServerProviders: (serverProviders) => set({ serverProviders }),
  setMode: (mode) => set({ mode }),

  isServerMode: () => !!get().ticket && get().serverProviders.length > 0,
}));
