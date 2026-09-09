'use client';

import { useEffect } from 'react';

import { useEmbedAuthStore } from '@/store/embed-auth';

/**
 * 트랙 T-3 §B, T-3b — URL 서명 링크(`#t=<ticket>`) 진입 + 데모 티켓 저장소.
 *
 * 티켓을 쿼리(`?t=`)가 아니라 fragment(`#t=`)로 나른다 — fragment 는 서버로
 * 전송되지 않는다. 쿼리였다면 router.replace 로 히스토리는 정리해도
 * 첫 요청이 이미 서버(Vercel 액세스 로그)에 평문으로 도달한 뒤였다. 티켓은
 * 서버키 사용 권한이다.
 *
 * 현행 EmbedBridge(postMessage) 경로는 그대로 두고, 독립 접속(임베드 아닌 탭)에서도
 * 서버 프록시 게이트를 통과할 수 있게 하는 두 번째 티켓 진입 경로.
 *
 * - `#t=` 가 있으면 저장소에 저장하고 URL 에서 제거한다(히스토리·어깨너머 노출 방지).
 *   `history.replaceState` 로 지운다 — router.replace 는 hash 를 못 지울 수 있고,
 *   리렌더 없이 주소만 정리하면 충분하다.
 * - 없으면 저장소에 남아있는 티켓으로 복원한다.
 * - 루트 레이아웃에 상주 — /admin 을 포함한 모든 라우트에서 마운트되지만, 티켓이
 *   없으면 아무 동작도 하지 않는다.
 * - 배포 전이라 발급된 링크가 없다 — 구 `?t=` 쿼리 진입에 대한 하위 호환은 넣지 않는다.
 *
 * 저장소 — 트랙 T-3b, David 판정: 데모 환경은 본인 전용(시연·내부 사용)이며
 * 공유하지 않는다. 다른 사용자는 BYOK 또는 유료로 들어온다. 그래서 정기 갱신도
 * 회수 장치도 없다 — 데모 티켓은 **localStorage** 에 보관해 탭을 닫아도 유지된다
 * (T-3 서명 링크의 TTL 2주짜리 공유용 티켓과는 성격이 다르다. §B 의
 * "sessionStorage, 새로고침은 견디고 탭을 닫으면 사라진다" 문구는 T-3b 이전
 * 기준이며, 이제는 localStorage 로 굳는다).
 * `readStoredTicket`/`writeStoredTicket` 로 접근을 한 군데에 모은다 — 이 파일
 * 밖(예: DemoLoginForm)에서도 반드시 이 함수를 거쳐야, `#t=` 진입 경로와 로그인
 * 폼 경로가 서로 다른 저장소를 보는 일이 없다.
 */

const TICKET_STORAGE_KEY = 'council:access-ticket';

/** 저장된 티켓 읽기 — 저장소 접근 실패(프라이빗 모드 등)는 null 로 취급. */
export function readStoredTicket(): string | null {
  try {
    return localStorage.getItem(TICKET_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** 티켓 저장 — 저장소 접근 실패는 조용히 무시(BYOK 폴백으로 흘러감). */
export function writeStoredTicket(ticket: string): void {
  try {
    localStorage.setItem(TICKET_STORAGE_KEY, ticket);
  } catch {
    /* noop */
  }
}

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
      writeStoredTicket(fromHash);
      const url = new URL(window.location.href);
      history.replaceState(null, '', url.pathname + url.search);
    } else {
      ticket = readStoredTicket();
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
