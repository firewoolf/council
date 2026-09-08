'use client';

import { useEffect } from 'react';

import { useEmbedAuthStore } from '@/store/embed-auth';

/**
 * 트랙 T-3 §B — URL 서명 링크(`#t=<ticket>`) 진입.
 *
 * 티켓을 쿼리(`?t=`)가 아니라 fragment(`#t=`)로 나른다 — fragment 는 서버로
 * 전송되지 않는다. 쿼리였다면 router.replace 로 브라우저 히스토리는 정리해도
 * 첫 요청이 이미 서버(Vercel 액세스 로그)에 평문으로 도달한 뒤였다. 티켓은
 * 서버키 사용 권한이고 TTL 최대 2주라, 로그에 장기 보관되는 걸 피한다.
 *
 * 현행 EmbedBridge(postMessage) 경로는 그대로 두고, 독립 접속(임베드 아닌 탭)에서도
 * 서버 프록시 게이트를 통과할 수 있게 하는 두 번째 티켓 진입 경로.
 *
 * - `#t=` 가 있으면 sessionStorage 에 저장하고 URL 에서 제거한다(히스토리·어깨너머 노출 방지).
 *   `history.replaceState` 로 지운다 — router.replace 는 hash 를 못 지울 수 있고,
 *   리렌더 없이 주소만 정리하면 충분하다.
 * - 없으면 sessionStorage 에 남아있는 티켓으로 복원한다 — 새로고침은 견디고 탭을 닫으면 사라진다.
 *   (localStorage 는 쓰지 않는다. 티켓은 짧은 수명이다.)
 * - 루트 레이아웃에 상주 — /admin 을 포함한 모든 라우트에서 마운트되지만, 티켓이
 *   없으면 아무 동작도 하지 않는다.
 * - 배포 전이라 발급된 링크가 없다 — 구 `?t=` 쿼리 진입에 대한 하위 호환은 넣지 않는다.
 */

const TICKET_STORAGE_KEY = 'council:access-ticket';

function readTicketFromHash(): string | null {
  const hash = window.location.hash;
  if (!hash || hash.length <= 1) return null;
  const params = new URLSearchParams(hash.slice(1));
  const raw = params.get('t');
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function AccessTicketBridge() {
  useEffect(() => {
    const fromHash = readTicketFromHash();

    let ticket: string | null = fromHash;

    if (fromHash) {
      try {
        sessionStorage.setItem(TICKET_STORAGE_KEY, fromHash);
      } catch {
        /* noop — sessionStorage 접근 불가 환경 */
      }
      const url = new URL(window.location.href);
      history.replaceState(null, '', url.pathname + url.search);
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
  }, []);

  return null;
}
