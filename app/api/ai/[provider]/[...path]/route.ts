/**
 * 서버키 프록시 — /api/ai/<provider>/<...path>
 *
 * 클라이언트(AI SDK)가 baseURL 을 이 라우트로 잡고 호출하면, 여기서:
 *   1) 로그인 티켓 검증 (x-council-ticket 헤더) — 통과 못 하면 401.
 *   2) 그 공급사의 등록 키를 라운드로빈으로 하나 골라 인증 주입.
 *   3) 실제 공급사로 포워드하고 응답 스트림을 그대로 반환.
 *   4) 429(한도)면 같은 공급사의 다음 키로 자동 재시도 → 무료 한도 극대화.
 *
 * 스트리밍(SSE)은 resp.body 를 그대로 통과시켜 유지된다. AI SDK 불필요(순수 fetch).
 */

import type { NextRequest } from 'next/server';

import { verifyTicket } from '@/lib/ai/gate';
import { getServerKeys, nextCursor } from '@/lib/ai/serverKeys';
import { UPSTREAM } from '@/lib/ai/upstream';

export const runtime = 'nodejs';
// 스트리밍 응답이 잘리지 않도록 여유 있는 상한.
export const maxDuration = 60;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function handle(
  req: NextRequest,
  provider: string,
  path: string[],
): Promise<Response> {
  // 1) 게이트
  if (!verifyTicket(req.headers.get('x-council-ticket'))) {
    return json(401, { error: '로그인 인증이 필요합니다.' });
  }

  const up = UPSTREAM[provider];
  if (!up) return json(404, { error: `알 수 없는 공급사: ${provider}` });

  const keys = getServerKeys(provider);
  if (keys.length === 0) {
    return json(503, { error: `${provider}: 서버에 등록된 키가 없습니다.` });
  }

  // 2) 타깃 URL — base + 하위경로 + 원 쿼리(예: gemini ?alt=sse) 보존
  const search = new URL(req.url).search;
  const target = `${up.baseURL.replace(/\/$/, '')}/${path.join('/')}${search}`;

  // 요청 바디는 한 번만 읽어 재시도에 재사용
  const body =
    req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : await req.arrayBuffer();

  const start = nextCursor(provider, keys.length);
  let last: Response | null = null;

  // 3~4) 키 회전 + 429 재시도
  for (let n = 0; n < keys.length; n++) {
    const key = keys[(start + n) % keys.length]!;

    const headers = new Headers();
    const ct = req.headers.get('content-type');
    if (ct) headers.set('content-type', ct);
    const accept = req.headers.get('accept');
    if (accept) headers.set('accept', accept);

    if (up.auth === 'google') {
      headers.set('x-goog-api-key', key);
    } else {
      headers.set('authorization', `Bearer ${key}`);
    }
    if (provider === 'openrouter') {
      headers.set('HTTP-Referer', 'https://council.app');
      headers.set('X-Title', 'COUNCIL');
    }

    const resp = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    });

    // 429 외에는 그대로 스트림 반환 (성공·기타 오류 모두)
    if (resp.status !== 429) {
      const out = new Headers();
      const rct = resp.headers.get('content-type');
      if (rct) out.set('content-type', rct);
      return new Response(resp.body, { status: resp.status, headers: out });
    }
    last = resp;
  }

  // 모든 키가 429 — 마지막 응답 전달
  const out = new Headers();
  const rct = last?.headers.get('content-type');
  if (rct) out.set('content-type', rct);
  return new Response(last?.body ?? JSON.stringify({ error: 'rate limited' }), {
    status: 429,
    headers: out,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { provider: string; path?: string[] } },
): Promise<Response> {
  return handle(req, params.provider, params.path ?? []);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string; path?: string[] } },
): Promise<Response> {
  return handle(req, params.provider, params.path ?? []);
}
