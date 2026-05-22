/**
 * Supabase 동기화 헬퍼 (1단계 — 단순 write-through 인터페이스).
 *
 * 정책:
 *   - LocalStorage 가 primary source of truth (오프라인 우선).
 *   - Supabase 는 보조 백업 + 멀티 디바이스 동기화 채널.
 *   - 사용자가 명시적으로 "동기화" 트리거하거나, 로그인 시 자동 sync.
 *
 * 이 파일은 인터페이스 + upsert 헬퍼만 정의.
 * Realtime 구독, 충돌 해결, optimistic update 는 다음 마일스톤.
 *
 * 사용:
 *   const sb = getBrowserSupabase();
 *   if (sb) await pushSession(sb, session, personaIds, domain);
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Conclusion } from '@/lib/prompts/orchestrator';
import type { Message, Session } from '@/types/debate';
import { getOrCreateDeviceId } from './client';
import type { Database } from './types';

type SB = SupabaseClient<Database>;

export async function pushSession(
  sb: SB,
  session: Session,
  personaIds: string[],
  domain: string | null,
): Promise<void> {
  const deviceId = getOrCreateDeviceId();

  const { error: sessErr } = await sb.from('sessions').upsert({
    id: session.id,
    device_id: deviceId,
    title: session.title,
    concern: session.concern,
    status: session.status,
    ai_provider: session.aiProvider,
    domain,
    created_at: session.createdAt,
  });
  if (sessErr) throw new Error(`session upsert 실패: ${sessErr.message}`);

  if (personaIds.length > 0) {
    const rows = personaIds.map((pid) => ({
      session_id: session.id,
      persona_id: pid,
      is_active: true,
    }));
    const { error: spErr } = await sb
      .from('session_personas')
      .upsert(rows, { onConflict: 'session_id,persona_id' });
    if (spErr) throw new Error(`session_personas upsert 실패: ${spErr.message}`);
  }
}

export async function pushMessage(sb: SB, message: Message): Promise<void> {
  const { error } = await sb.from('messages').insert({
    id: message.id,
    session_id: message.sessionId,
    speaker_id: message.speakerId,
    kind: message.kind ?? 'speech',
    content: message.content,
    reply_to: message.replyTo ?? null,
    is_question: message.isQuestion ?? false,
    token_count: message.tokenCount ?? 0,
    created_at: message.createdAt,
  });
  if (error) throw new Error(`message insert 실패: ${error.message}`);
}

export async function pushConclusion(
  sb: SB,
  sessionId: string,
  conclusion: Conclusion,
): Promise<void> {
  const { error } = await sb.from('conclusions').upsert({
    session_id: sessionId,
    key_conclusion: conclusion.keyConclusion,
    risks: conclusion.risks,
    persona_positions: conclusion.personaPositions,
    recommended_actions: conclusion.recommendedActions,
  });
  if (error) throw new Error(`conclusion upsert 실패: ${error.message}`);

  // 세션 status 도 함께 동기화
  const { error: sessErr } = await sb
    .from('sessions')
    .update({ status: 'concluded' })
    .eq('id', sessionId);
  if (sessErr) throw new Error(`session status 갱신 실패: ${sessErr.message}`);
}

/**
 * 디바이스의 전체 세션 가져오기 — 로그인 또는 동기화 트리거 시.
 * LocalStorage에 없는 세션을 머지.
 */
export async function pullSessions(sb: SB): Promise<{
  sessions: Database['public']['Tables']['sessions']['Row'][];
  messages: Database['public']['Tables']['messages']['Row'][];
  sessionPersonas: Database['public']['Tables']['session_personas']['Row'][];
  conclusions: Database['public']['Tables']['conclusions']['Row'][];
}> {
  const [sessions, messages, sessionPersonas, conclusions] = await Promise.all([
    sb.from('sessions').select('*').order('created_at', { ascending: false }),
    sb.from('messages').select('*').order('created_at', { ascending: true }),
    sb.from('session_personas').select('*'),
    sb.from('conclusions').select('*'),
  ]);

  const firstErr =
    sessions.error || messages.error || sessionPersonas.error || conclusions.error;
  if (firstErr) throw new Error(`pull 실패: ${firstErr.message}`);

  return {
    sessions: sessions.data ?? [],
    messages: messages.data ?? [],
    sessionPersonas: sessionPersonas.data ?? [],
    conclusions: conclusions.data ?? [],
  };
}
