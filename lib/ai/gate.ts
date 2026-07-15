/**
 * 로그인 게이트 — HMAC 티켓 발급/검증. ⚠️ 서버 전용 (node:crypto).
 *
 * 서버키 프록시(/api/ai/*)를 무방비로 열면 아무나 호출해 등록된 키(과금)를 태운다.
 * 그래서 "insight-out 로그인 사용자만" 통과시킨다:
 *   1) insight-out(호스트)이 로그인 사용자에게 짧은 수명 티켓을 발급(같은 SECRET 로 서명).
 *   2) 임베드가 그 티켓을 council 에 전달 → 프록시 요청 헤더(x-council-ticket)로 실림.
 *   3) 여기서 HMAC·aud·exp 만 검증. Supabase 결합/토큰 과다공유 없음, 위조 불가.
 *
 * 티켓 포맷(경량 JWT류): `base64url(payloadJSON).base64url(HMAC_SHA256(body, SECRET))`
 *   payload = { sub: userId, aud: 'council', iat, exp }  (exp/iat 는 초 단위)
 *
 * insight-out 발급 측도 이 알고리즘을 그대로 쓴다(mintTicket 참고).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.COUNCIL_GATE_SECRET ?? '';
const AUDIENCE = 'council';

export interface TicketPayload {
  sub: string;
  aud: string;
  iat: number;
  exp: number;
}

export function gateEnabled(): boolean {
  return SECRET.length > 0;
}

/** 발급 — insight-out 측에서 동일 로직으로 사용(참고/공유용). */
export function mintTicket(userId: string, ttlSeconds = 600): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TicketPayload = {
    sub: userId,
    aud: AUDIENCE,
    iat: now,
    exp: now + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** 검증 — 유효하면 payload, 아니면 null. */
export function verifyTicket(ticket: string | null | undefined): TicketPayload | null {
  if (!SECRET || !ticket) return null;
  const dot = ticket.indexOf('.');
  if (dot <= 0) return null;
  const body = ticket.slice(0, dot);
  const sig = ticket.slice(dot + 1);

  const expected = createHmac('sha256', SECRET).update(body).digest();
  let got: Buffer;
  try {
    got = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as TicketPayload;
    if (payload.aud !== AUDIENCE) return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
