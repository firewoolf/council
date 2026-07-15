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

/** getModel 에 "서버 모드로 호출하라"는 신호로 쓰는 키 센티넬. */
export const SERVER_KEY_SENTINEL = '__council_server__';

interface EmbedAuthState {
  /** insight-out 이 발급한 로그인 티켓 (HMAC 서명) */
  ticket: string | null;
  /** 서버에 키가 등록돼 쓸 수 있는 공급사 목록 (/api/ai/config 결과) */
  serverProviders: string[];

  setTicket: (ticket: string | null) => void;
  setServerProviders: (providers: string[]) => void;
  /** 서버 모드 활성 여부 */
  isServerMode: () => boolean;
}

export const useEmbedAuthStore = create<EmbedAuthState>((set, get) => ({
  ticket: null,
  serverProviders: [],

  setTicket: (ticket) => set({ ticket }),
  setServerProviders: (serverProviders) => set({ serverProviders }),

  isServerMode: () => !!get().ticket && get().serverProviders.length > 0,
}));
