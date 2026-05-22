/**
 * 어드민 로그아웃 엔드포인트.
 * POST → 쿠키 삭제 후 리다이렉트 정보 반환.
 */

import { NextResponse } from 'next/server';

import { ADMIN_COOKIE_NAME } from '@/lib/admin/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
