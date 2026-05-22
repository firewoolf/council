import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * T3 Env — 타입 안전 환경변수.
 * 절대 process.env.XXX 직접 접근 금지. 항상 `env.XXX` 사용.
 *
 * 1-2단계에서는 모든 키가 optional. BYOK가 기본 경로이기 때문.
 * 키가 비어있으면 클라이언트는 BYOK 흐름을 강제한다.
 */
export const env = createEnv({
  server: {
    ANTHROPIC_API_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  },
  runtimeEnv: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  emptyStringAsUndefined: true,
});
