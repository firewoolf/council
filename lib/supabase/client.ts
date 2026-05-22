'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/env';
import type { Database } from './types';

/**
 * 브라우저용 Supabase 클라이언트.
 *
 * env 미설정 시 null 반환 — 호출자는 반드시 null 체크.
 * 이렇게 두면 Supabase가 아직 연결되지 않은 환경에서도 앱이 그대로 동작.
 *
 * 사용:
 *   const sb = getBrowserSupabase();
 *   if (!sb) { ... LocalStorage 폴백 ... }
 *   else { await sb.from('sessions').select(...) }
 */
let cached: SupabaseClient<Database> | null | undefined;

export function getBrowserSupabase(): SupabaseClient<Database> | null {
  if (cached !== undefined) return cached;

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    cached = null;
    return null;
  }

  cached = createBrowserClient<Database>(url, anonKey, {
    // 익명 device_id 헤더 — 비로그인 사용자도 RLS 격리되도록.
    global: {
      headers: {
        'x-device-id': getOrCreateDeviceId(),
      },
    },
  });
  return cached;
}

/**
 * 디바이스 ID — LocalStorage 영속.
 * 로그인 전까지 사용자 격리 키.
 */
const DEVICE_ID_KEY = 'council:device-id';
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Supabase가 설정되어 있는지 빠르게 확인. UI 분기용. */
export function isSupabaseConfigured(): boolean {
  return !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
