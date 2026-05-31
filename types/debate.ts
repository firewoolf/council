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
  /** 트랙 ⑤-1 — 이 발언이 속한 청크 id. 청크 이전 세션의 메시지는 undefined. */
  chunkId?: string;
  /** 트랙 ⑤-1 — 이 청크에서 가장 날카로운 1~2개 라인이면 true. */
  isKeyPoint?: boolean;
}

/**
 * 트랙 ⑤-1 — 세션에 저장하는 청크 메타데이터.
 * 청크 한 단위가 다룬 소주제, 끝난 뒤 사용자에게 제시된 갈림길, 사용자의 선택.
 * turn 본문은 그대로 messages 에 평면 저장되고, 여기엔 메타만 둔다.
 */
export interface ChunkMeta {
  id: string;
  sessionId: string;
  /** 이 청크가 다룬 소주제 */
  topic: string;
  /** 재생 완료 후 제시된 다음 소주제 후보 */
  nextTopics: NextTopicChoice[];
  /** 사용자가 다음으로 고른 것 (직접 입력 포함). 마지막 청크면 undefined */
  chosenNextLabel?: string;
  createdAt: string; // ISO
}

export interface NextTopicChoice {
  label: string;
  hook: string;
  /** 트랙 ⑤-1 부록 D — *못 본 각도* 후보면 true. nextTopics 배열에 정확히 1개. */
  isBlindSpot: boolean;
}

export interface SessionPersona {
  sessionId: string;
  personaId: string;
  isActive: boolean;
  joinedAt: string; // ISO
}

/**
 * 트랙 ③ — 카드별 감독 디렉션.
 * 회의록에 추가되지 않고, 다음 청크 생성 시 transcript 끝 시스템 지시로 1회 주입 후 비워진다.
 */
export type DirectionAction =
  /** 이 사람에게: 더 세게 말해줘 */
  | { kind: 'tighten'; targetMemberId: string; targetMessageId: string }
  /** 이 사람에게: 근거 더 구체적으로 */
  | { kind: 'specify'; targetMemberId: string; targetMessageId: string }
  /** 이 사람에게: 다른 각도에서 다시 */
  | { kind: 'reframe'; targetMemberId: string; targetMessageId: string }
  /** 다른 사람에게 반박시키기 */
  | { kind: 'rebut'; targetMemberId: string; targetMessageId: string; byMemberId: string }
  /** 이 사람이 사용자에게 질문하게 */
  | { kind: 'ask-user'; targetMemberId: string; targetMessageId: string };
