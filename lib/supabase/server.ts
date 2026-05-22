import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { env } from '@/env';
import type { Database } from './types';

/**
 * 서버 컴포넌트/Route Handler 용 Supabase 클라이언트.
 *
 * env 미설정 시 null. Next 14 App Router 의 cookies() 활용.
 *
 * 사용 예:
 *   const sb = await getServerSupabase();
 *   if (!sb) return new Response('Supabase not configured', { status: 503 });
 *   const { data } = await sb.from('sessions').select('*');
 */
export async function getServerSupabase(): Promise<SupabaseClient<Database> | null> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component 내부에서 호출되면 set이 실패할 수 있음.
          // Middleware 또는 Route Handler 컨텍스트에서만 setAll이 의미 있다.
        }
      },
    },
  });
}
