/** @type {import('next').NextConfig} */

// insight-out 등 호스트가 COUNCIL 을 iframe 으로 임베드할 수 있도록 허용하는 오리진.
// EMBED_ALLOWED_ORIGINS 로 재정의 (공백/콤마 구분). 미설정 시 아래 기본값.
//
// `https://*.vercel.app` — insight-out 프로덕션 + preview 배포(도메인이 매번 바뀜)를
// 한 번에 커버한다. 프로덕션 도메인 문자열 하나로 박아두면 preview·도메인 변경 때마다
// 프레임이 하얗게 깨지므로(frame-ancestors 불일치) 와일드카드로 둔다.
// frame-ancestors 는 클릭재킹 방어일 뿐, 서버키/MI 는 별도(티켓·서버토큰)로 게이트되므로
// vercel.app 전반 허용은 베타에서 수용 가능. 커스텀 도메인은 EMBED_ALLOWED_ORIGINS 로 추가.
const EMBED_ALLOWED_ORIGINS = (
  process.env.EMBED_ALLOWED_ORIGINS ??
  'https://*.vercel.app https://insight-out-app.vercel.app http://localhost:3000 http://localhost:3001'
)
  .split(/[\s,]+/)
  .filter(Boolean)
  .join(' ');

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  async headers() {
    return [
      {
        // 프레이밍 허용 대상을 frame-ancestors 로 제한 (X-Frame-Options 대체).
        // 'self' + 화이트리스트 호스트에서만 iframe 임베드 가능.
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors 'self' ${EMBED_ALLOWED_ORIGINS};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
