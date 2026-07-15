/**
 * 서버키 프록시 설정 조회 — /api/ai/config
 *
 * 클라이언트는 어떤 공급사가 서버 키를 갖고 있는지 모른다(키는 서버 전용).
 * 티켓으로 인증된 클라이언트가 이 엔드포인트로 "서버 모드로 쓸 수 있는 공급사 목록"을 받는다.
 */

import type { NextRequest } from 'next/server';

import { verifyTicket } from '@/lib/ai/gate';
import { configuredServerProviders } from '@/lib/ai/serverKeys';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  if (!verifyTicket(req.headers.get('x-council-ticket'))) {
    return new Response(JSON.stringify({ error: '로그인 인증이 필요합니다.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  return Response.json({ providers: configuredServerProviders() });
}
