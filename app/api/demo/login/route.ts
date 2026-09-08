/**
 * 데모 게이트 로그인 엔드포인트 — 트랙 T-3b.
 * POST { password } → demo 티켓 발급 or 401/503
 *
 * 미들웨어 matcher 는 /admin/:path* · /api/admin/:path* 뿐이라 이 경로는
 * 자동으로 공개다 (인증은 이 라우트 자신이 수행).
 */

import { NextResponse } from 'next/server';

import { checkDemoPassword, isDemoEnabled } from '@/lib/demo/auth';
import { gateEnabled, mintTicket } from '@/lib/ai/gate';

const TICKET_TTL_SECONDS = 60 * 60 * 24 * 7; // 7일 고정 — 만료돼도 비밀번호만 다시 치면 된다.

export async function POST(request: Request) {
  if (!isDemoEnabled()) {
    return NextResponse.json(
      { error: '데모 게이트가 비활성화되어 있습니다. DEMO_PASSWORD 환경변수를 설정하세요.' },
      { status: 503 },
    );
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
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const password =
    typeof body === 'object' && body !== null && 'password' in body
      ? String((body as { password: unknown }).password)
      : '';

  if (!password) {
    return NextResponse.json({ error: '비밀번호를 입력하세요.' }, { status: 400 });
  }

  if (!checkDemoPassword(password)) {
    // 무차별 대입 방지용 작은 딜레이 — /api/admin/login 과 동일 패턴.
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
  }

  // sub 는 'demo' 고정 — 비밀번호 방식엔 개인 식별이 없고, 사용량은 브라우저
  // 로컬 집계라 라벨을 받아도 구분되지 않는다.
  const ticket = mintTicket('demo', 'demo', TICKET_TTL_SECONDS);
  return NextResponse.json({ ticket });
}
