/**
 * Edge runtime 미들웨어와 Node 런타임 양쪽에서 공유 가능한 상수.
 * 어드민 인증 로직(node:crypto 사용)은 auth.ts 에 분리되어 있음.
 */

export const ADMIN_COOKIE_NAME = 'council_admin';
