'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useEmbedAuthStore } from '@/store/embed-auth';

/**
 * 트랙 T-3 §B — URL 서명 링크(`?t=<ticket>`) 진입.
 *
 * 현행 EmbedBridge(postMessage) 경로는 그대로 두고, 독립 접속(임베드 아닌 탭)에서도
 * 서버 프록시 게이트를 통과할 수 있게 하는 두 번째 티켓 진입 경로.
 *
 * - `?t=` 가 있으면 sessionStorage 에 저장하고 URL 에서 제거한다(히스토리·어깨너머 노출 방지).
 * - 없으면 sessionStorage 에 남아있는 티켓으로 복원한다 — 새로고침은 견디고 탭을 닫으면 사라진다.
 *   (localStorage 는 쓰지 않는다. 티켓은 짧은 수명이다.)
 * - 루트 레이아웃에 상주 — /admin 을 포함한 모든 라우트에서 마운트되지만, 티켓이
 *   없으면 아무 동작도 하지 않는다.
 */

const TICKET_STORAGE_KEY = 'council:access-ticket';

export function AccessTicketBridge() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get('t');

    let ticket: string | null = fromQuery;

    if (fromQuery) {
      try {
        sessionStorage.setItem(TICKET_STORAGE_KEY, fromQuery);
      } catch {
        /* noop — sessionStorage 접근 불가 환경 */
      }
      url.searchParams.delete('t');
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    } else {
      try {
        ticket = sessionStorage.getItem(TICKET_STORAGE_KEY);
      } catch {
        ticket = null;
      }
    }

    if (!ticket) return;

    const store = useEmbedAuthStore.getState();
    store.setTicket(ticket);

    fetch('/api/ai/config', { headers: { 'x-council-ticket': ticket } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { providers?: unknown; mode?: unknown } | null) => {
        if (!d) return;
        if (Array.isArray(d.providers)) {
          useEmbedAuthStore.getState().setServerProviders(d.providers);
        }
        if (d.mode === 'demo' || d.mode === 'paid') {
          useEmbedAuthStore.getState().setMode(d.mode);
        }
      })
      .catch(() => {
        /* 서버 모드 불가 → BYOK 폴백 */
      });
  }, [router]);

  return null;
}
