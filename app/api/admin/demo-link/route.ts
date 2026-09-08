/**
 * 데모 서명 링크 발급 — 트랙 T-3 §E.
 * POST { label, ttlHours } → { url }
 *
 * mintTicket 은 node:crypto 를 쓰는 서버 전용 모듈이라 여기(route handler)에서만 호출한다.
 * 발급 이력은 저장하지 않는다 — 링크는 응답 시점에만 반환된다.
 */

import { NextResponse } from 'next/server';

import { isAuthenticated } from '@/lib/admin/auth';
import { gateEnabled, mintTicket } from '@/lib/ai/gate';

const MIN_TTL_HOURS = 1;
const MAX_TTL_HOURS = 24 * 14; // 2주 상한 — 서명 링크가 무기한 떠도는 걸 막는다.
const DEFAULT_TTL_HOURS = 24;

export async function POST(request: Request): Promise<Response> {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  if (!gateEnabled()) {
    return NextResponse.json(
      { error: 'COUNCIL_GATE_SECRET 환경변수가 설정되지 않았습니다.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 });
  }

  const label =
    typeof body === 'object' && body !== null && 'label' in body
      ? String((body as { label: unknown }).label).trim()
      : '';
  if (!label) {
    return NextResponse.json({ error: '대상자 라벨을 입력하세요.' }, { status: 400 });
  }

  const rawTtl =
    typeof body === 'object' && body !== null && 'ttlHours' in body
      ? Number((body as { ttlHours: unknown }).ttlHours)
      : DEFAULT_TTL_HOURS;
  const ttlHours =
    Number.isFinite(rawTtl) && rawTtl > 0
      ? Math.min(Math.max(rawTtl, MIN_TTL_HOURS), MAX_TTL_HOURS)
      : DEFAULT_TTL_HOURS;

  const ticket = mintTicket(label, 'demo', Math.round(ttlHours * 3600));
  // fragment(#) — 쿼리(?)와 달리 서버로 전송되지 않는다. 티켓이 Vercel 액세스
  // 로그에 평문으로 남는 걸 피한다 (TTL 최대 2주짜리 서버키 사용 권한이라 더 신중).
  const url = `${new URL(request.url).origin}/#t=${ticket}`;

  return NextResponse.json({ url, ttlHours });
}
