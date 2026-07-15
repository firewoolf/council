'use client';

/**
 * AI 접근 해석 — 서버 모드 vs BYOK.
 *
 * 서버 모드(임베드 로그인)면 서버 공급사들을 센티넬 키로 매핑해 돌려준다.
 * 그러면 기존 흐름(listAvailableProviders / runWithFallback / getModel)이
 * 코드 변경 없이 서버 프록시로 라우팅된다 — getModel 이 센티넬을 보고 프록시로 전환.
 * 서버 모드가 아니면 기존 BYOK 키 맵을 그대로 반환.
 */

import { SERVER_KEY_SENTINEL, useEmbedAuthStore } from '@/store/embed-auth';
import { useApiKeyStore } from '@/store/api-key';
import { SERVER_PROVIDERS, type AiProvider } from './providers';

/**
 * 현재 사용할 키 맵.
 * - 서버 모드: 서버 공급사(∩ 클라이언트가 만들 수 있는 BYOK 공급사)를 센티넬로.
 * - 그 외: BYOK 키 맵.
 */
export function resolveKeys(): Partial<Record<AiProvider, string>> {
  const embed = useEmbedAuthStore.getState();
  if (embed.isServerMode()) {
    const keys: Partial<Record<AiProvider, string>> = {};
    for (const p of embed.serverProviders) {
      // 클라이언트가 SDK 로 생성 가능한 공급사만(현재 BYOK_PROVIDERS 집합).
      if ((SERVER_PROVIDERS as readonly string[]).includes(p)) {
        keys[p as AiProvider] = SERVER_KEY_SENTINEL;
      }
    }
    if (Object.keys(keys).length > 0) return keys;
  }
  return useApiKeyStore.getState().keys;
}

/** 서버 모드 활성 여부(키 입력 없이 토론 가능). */
export function isServerMode(): boolean {
  const embed = useEmbedAuthStore.getState();
  if (!embed.isServerMode()) return false;
  // 클라이언트가 만들 수 있는 서버 공급사가 하나라도 있어야 유효.
  return embed.serverProviders.some((p) =>
    (SERVER_PROVIDERS as readonly string[]).includes(p),
  );
}
