'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
  COUNCIL_EMBED_PROTOCOL,
  EMBED_SEED_KEY,
  allowedParentOrigins,
  isEmbedded,
  rememberParentOrigin,
  type CouncilToHostMessage,
  type HostToCouncilMessage,
} from '@/lib/embed/protocol';
import { useEmbedAuthStore } from '@/store/embed-auth';

/**
 * 임베드 브릿지 — iframe 안에서만 활성.
 *
 * 1) 마운트 시 부모(호스트)로 'ready' 를 알림.
 * 2) 화이트리스트 오리진에서 온 'set-context' 를 받으면
 *    sessionStorage 에 저장하고 /session/new 로 이동해 고민을 프리필.
 *
 * (main)/layout.tsx 에 상주. 비임베드 환경에서는 아무 동작도 하지 않는다.
 */
export function EmbedBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isEmbedded()) return;

    // 임베드 테마 활성화 — globals.css 의 insight-out 팔레트 오버라이드 적용.
    document.documentElement.setAttribute('data-embed', 'insight-out');

    // 임베드 진입 시 마케팅 홈 대신 바로 토론 입력화면으로 — 기능처럼 보이게.
    // (set-context 로도 /session/new 로 가지만, 컨텍스트 없는 실험실 탭 진입까지 커버.)
    if (window.location.pathname === '/') {
      router.replace('/session/new');
    }

    const allowed = allowedParentOrigins();

    const onMessage = (event: MessageEvent) => {
      if (!allowed.includes(event.origin)) return;
      const data = event.data as Partial<HostToCouncilMessage> | null;
      if (!data || data.protocol !== COUNCIL_EMBED_PROTOCOL) return;

      rememberParentOrigin(event.origin);

      if (data.type === 'set-context' && data.payload) {
        try {
          sessionStorage.setItem(EMBED_SEED_KEY, JSON.stringify(data.payload));
        } catch {
          /* noop */
        }
        if (typeof data.payload.concern === 'string' && data.payload.concern.trim()) {
          router.push('/session/new');
        }
      }

      // 로그인 티켓 수신 → 보관 + 서버 공급사 목록 조회(서버 모드 활성).
      if (data.type === 'set-auth' && data.payload?.ticket) {
        const ticket = data.payload.ticket;
        useEmbedAuthStore.getState().setTicket(ticket);
        fetch('/api/ai/config', { headers: { 'x-council-ticket': ticket } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && Array.isArray(d.providers)) {
              useEmbedAuthStore.getState().setServerProviders(d.providers);
            }
          })
          .catch(() => {
            /* 서버 모드 불가 → BYOK 폴백 */
          });
      }
    };

    window.addEventListener('message', onMessage);

    // 부모에게 준비 완료 통지 — 화이트리스트 각 오리진으로 announce.
    const ready: CouncilToHostMessage = {
      protocol: COUNCIL_EMBED_PROTOCOL,
      type: 'ready',
    };
    allowed.forEach((origin) => {
      try {
        window.parent.postMessage(ready, origin);
      } catch {
        /* noop */
      }
    });

    return () => window.removeEventListener('message', onMessage);
  }, [router]);

  return null;
}
