/**
 * 토론 도메인 타입.
 * Supabase 스키마와 1:1 대응.
 */

import type { AiProvider } from '@/lib/ai/providers';

export interface Session {
  id: string;
  /** 비로그인 허용 → device_id (LocalStorage) */
  userId?: string;
  /** 고민 한 줄 요약 */
  title: string;
  /** 원본 고민 텍스트 */
  concern: string;
  status: 'active' | 'concluded';
  /**
   * 세션에 사용된 LLM 공급사.
   * AiProvider 전체와 동기화 — BYOK 공급사 추가 시 함께 갱신된다.
   * Supabase 도입 시 ai_provider enum 마이그레이션 필요.
   */
  aiProvider: AiProvider;
  createdAt: string; // ISO
}

/**
 * 메시지 종류.
 *   - speech: 일반 발언 (페르소나 또는 사용자)
 *   - instruction: 사용자의 메타 지시 ("더 짧게", "다른 시각으로"). speakerId는 null.
 *     이후 모든 페르소나 발언이 이 지시를 반영해야 한다.
 */
export type MessageKind = 'speech' | 'instruction';

export interface Message {
  id: string;
  sessionId: string;
  /** null이면 사용자 발언 또는 사용자 지시 */
  speakerId: string | null;
  content: string;
  /** 'speech' (default) | 'instruction' */
  kind?: MessageKind;
  /** 반박 대상 message id */
  replyTo?: string;
  tokenCount?: number;
  createdAt: string; // ISO
  /** 페르소나 발언일 때, 사용자에게 질문이 포함되었는지 */
  isQuestion?: boolean;
}

export interface SessionPersona {
  sessionId: string;
  personaId: string;
  isActive: boolean;
  joinedAt: string; // ISO
}
