/**
 * 어드민 인증 헬퍼.
 *
 * 전략:
 *   - ADMIN_PASSWORD 환경변수에 단일 비밀번호 저장
 *   - 로그인 시 비밀번호를 검증하고 HTTP-only 쿠키 set (값 = 비밀번호 자체)
 *   - 미들웨어/서버 컴포넌트에서 쿠키 == env 비교 (timingSafeEqual)
 *
 * 보안 모델:
 *   - 단일 어드민 (운영자 본인) 전용
 *   - HttpOnly + Secure + SameSite=Strict 쿠키
 *   - Vercel HTTPS 도메인에서만 동작
 *
 * 한계:
 *   - 비밀번호 자체가 쿠키에 저장됨 → 쿠키 탈취 시 로그인 가능
 *   - 다중 사용자, 역할 분리 필요 시 NextAuth/Clerk로 교체
 */

import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

import { env } from '@/env';
import { ADMIN_COOKIE_NAME } from './constants';

export { ADMIN_COOKIE_NAME };
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7일

/** 어드민 기능 활성화 여부 (ADMIN_PASSWORD 설정 여부) */
export function isAdminEnabled(): boolean {
  return !!env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 8;
}

/** 비밀번호가 ADMIN_PASSWORD 와 일치하는지 타이밍 공격 안전하게 비교. */
export function checkPassword(input: string): boolean {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) return false;
  // 길이가 다르면 timingSafeEqual이 throw → 사전에 가드
  if (Buffer.byteLength(input) !== Buffer.byteLength(expected)) return false;
  return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}

/** 쿠키 기반 어드민 세션 검증 (서버 컴포넌트/route handler 용) */
export function isAuthenticated(): boolean {
  if (!isAdminEnabled()) return false;
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  return checkPassword(token);
}

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: COOKIE_MAX_AGE_SEC,
};
