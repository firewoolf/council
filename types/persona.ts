/**
 * 페르소나 타입 정의.
 * Supabase 도입 후에는 Database['public']['Tables']['personas']['Row'] 로 대체.
 */

export type DebateStyle =
  | 'data'         // 데이터형
  | 'cynical'      // 냉소형
  | 'emotion'      // 감정형
  | 'experience'   // 경험형
  | 'structural'   // 구조형
  | 'sensory'      // 감성형
  | 'question'     // 질문형
  | 'data-tactical'// 데이터+실전
  | 'industry'     // 업계 현실형
  | 'facilitator'; // 중재 + 날카로운 질문

export interface Persona {
  /** kebab-case slug, primary key */
  id: string;
  /** 화면 표기 이름 */
  name: string;
  /** 한 줄 역할 */
  role: string;
  /** 핵심 가치관 */
  coreValue: string;
  /** 반박 스타일 */
  debateStyle: DebateStyle;
  /** 절대 양보 안 하는 것 */
  nonNegotiable: string;
  /** 약점 */
  weakness: string;
  /** AI에 전달되는 시스템 프롬프트 (base 포함 X — base는 합성 시점에 prepend) */
  systemPrompt: string;
  /** orb 그라디언트 시작 (hex) */
  colorFrom: string;
  /** orb 그라디언트 끝 (hex) */
  colorTo: string;
  /** 사용자에게 던질 수 있는 샘플 질문 — UX 힌트용 */
  userQuestions: string[];
  /** 동적 생성 여부 (#9 도메인 전문가 등) */
  dynamic?: boolean;
}
