/** @type {import('next').NextConfig} */

// insight-out 등 호스트가 COUNCIL 을 iframe 으로 임베드할 수 있도록 허용하는 오리진.
// EMBED_ALLOWED_ORIGINS 로 재정의 (공백/콤마 구분). 미설정 시 아래 기본값.
const EMBED_ALLOWED_ORIGINS = (
  process.env.EMBED_ALLOWED_ORIGINS ??
  'https://insight-out-app.vercel.app http://localhost:3000 http://localhost:3001'
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
