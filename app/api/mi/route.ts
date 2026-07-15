// COUNCIL MI 프록시 (/api/mi) — 서버 전용 경유지.
//
// 클라이언트가 insight-out 을 직접 부르면 토큰 노출·CORS 문제가 생긴다.
// 브라우저는 이 라우트만 호출하고, 실제 insight-out 호출은 서버에서 일어난다.
// insight-out 읽기 토큰은 이 서버 프로세스(INSIGHT_OUT_READ_TOKEN)에만 머문다.

import { NextResponse, type NextRequest } from 'next/server';

import { fetchMiBundle, isMiConfigured } from '@/lib/mi/insight-out';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') ?? undefined;
  const bundle = await fetchMiBundle(query);
  return NextResponse.json({ configured: isMiConfigured(), bundle });
}
