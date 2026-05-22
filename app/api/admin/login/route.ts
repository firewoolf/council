/**
 * 어드민 로그인 엔드포인트.
 * POST { password } → 쿠키 set or 401
 */

import { NextResponse } from 'next/server';

import {
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_OPTIONS,
  checkPassword,
  isAdminEnabled,
} from '@/lib/admin/auth';

export async function POST(request: Request) {
  if (!isAdminEnabled()) {
    return NextResponse.json(
      { error: '어드민 기능이 비활성화되어 있습니다. ADMIN_PASSWORD 환경변수를 설정하세요.' },
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

  if (!checkPassword(password)) {
    // 무차별 대입 방지용 작은 딜레이
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, password, ADMIN_COOKIE_OPTIONS);
  return response;
}
