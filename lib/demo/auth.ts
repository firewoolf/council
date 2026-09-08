/**
 * 데모 게이트 인증 헬퍼 — 트랙 T-3b.
 *
 * `lib/admin/auth.ts` 와 같은 전략(env 비밀번호 + timingSafeEqual)을 그대로 쓴다.
 * 다른 점은 세션 표현: 어드민은 비밀번호 자체를 쿠키에 저장해 유지하지만,
 * 데모는 검증 성공 시 `mintTicket` 으로 demo 티켓을 발급한다(app/api/demo/login).
 * 그래서 여기엔 쿠키 관련 상수/옵션이 없다.
 */

import { timingSafeEqual } from 'node:crypto';

import { env } from '@/env';

/** 데모 게이트 활성화 여부 (DEMO_PASSWORD 설정 여부, 8자 이상) */
export function isDemoEnabled(): boolean {
  return !!env.DEMO_PASSWORD && env.DEMO_PASSWORD.length >= 8;
}

/** 비밀번호가 DEMO_PASSWORD 와 일치하는지 타이밍 공격 안전하게 비교. */
export function checkDemoPassword(input: string): boolean {
  const expected = env.DEMO_PASSWORD;
  if (!expected) return false;
  // 길이가 다르면 timingSafeEqual이 throw → 사전에 가드
  if (Buffer.byteLength(input) !== Buffer.byteLength(expected)) return false;
  return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}
