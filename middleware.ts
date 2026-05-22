/**
 * 어드민 경로 보호 미들웨어.
 *
 * /admin/* 전체에 대해 어드민 쿠키를 확인하고,
 * 쿠키가 없거나 무효하면 /admin/login 으로 redirect.
 *
 * 예외:
 *   - /admin/login : 로그인 페이지 자체는 통과
 *   - /api/admin/login : 로그인 API endpoint 통과
 *
 * 비고:
 *   미들웨어는 Edge runtime이라 node:crypto 사용 불가 →
 *   여기선 쿠키 "존재 + 비어있지 않음" 만 검사하고,
 *   실제 비밀번호 비교는 서버 컴포넌트/route handler에서 수행.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { ADMIN_COOKIE_NAME } from '@/lib/admin/constants';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 로그인 페이지/엔드포인트는 통과
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
