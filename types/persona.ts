/**
 * 페르소나 도메인 타입.
 *
 * 트랙① Phase B 구분:
 *   - Archetype  : `data/personas.json` 의 재사용 템플릿 (고정 10명, 운영자 편집 가능)
 *   - CastMember : 한 세션에 출연하는 페르소나 인스턴스
 *                  (아키타입 복제 / 추천기가 즉석 설계한 generated / 사용자 custom)
 *
 * 굴복 금지 규칙은 BASE_PROMPT 가 모든 합성에 prepend 되므로 source 와 무관하게 유지.
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

/**
 * Phase B 신설 — 사용자 노출 분류 단일 축.
 *   advocate    : 추진/실행
 *   critic      : 비판/리스크
 *   analyst     : 데이터/구조
 *   provocateur : 도발/직설
 *   empath      : 사람/감정/지속가능성
 *
 * 각 temperament 의 토론 자세 지시 문구는 `data/prompts.json#temperamentDirectives` 에 분리.
 */
export type Temperament =
  | 'advocate'
  | 'critic'
  | 'analyst'
  | 'provocateur'
  | 'empath';

/**
 * 재사용 템플릿 — `data/personas.json` 의 10명.
 * 운영자 어드민에서 편집 가능, 빌드 시점에 클라이언트로 임베드.
 *
 * `debateStyle` 는 각 캐릭터 `systemPrompt` 본문이 텍스트로 품고 있어 잔존.
 * `temperament` 는 신규 사용자 노출 분류 — picker 뱃지/필터, 합성 지시에 사용.
 */
export interface Archetype {
  /** kebab-case slug, 안정적 PK */
  id: string;
  name: string;
  /** 한 줄 역할 */
  role: string;
  /** 핵심 가치관 */
  coreValue: string;
  debateStyle: DebateStyle;
  temperament: Temperament;
  /** 절대 양보 안 하는 것 */
  nonNegotiable: string;
  /** 약점 */
  weakness: string;
  /** 손으로 쓴 캐릭터 프롬프트 (BASE 미포함 — 합성 시 prepend) */
  systemPrompt: string;
  /** orb 그라디언트 시작 (hex) */
  colorFrom: string;
  /** orb 그라디언트 끝 (hex) */
  colorTo: string;
  /** 사용자에게 던질 수 있는 샘플 질문 — UX 힌트용 */
  userQuestions: string[];
}

/**
 * 한 세션에 출연하는 페르소나 인스턴스.
 *
 * id 규칙:
 *   - source==='archetype' 이면 id 는 archetypeId 와 동일 (옛 messages.speakerId 호환).
 *   - 그 외에는 crypto.randomUUID().
 *
 * characterPrompt 규칙:
 *   - 'archetype' : undefined — composePersonaPrompt 가 archetypeId 로 라이브 조회.
 *   - 'generated' / 'custom' : 생성 시점에 템플릿 합성한 스냅샷.
 */
export interface CastMember {
  id: string;
  source: 'archetype' | 'generated' | 'custom';
  archetypeId?: string;
  name: string;
  role: string;
  temperament: Temperament;
  /** 이 고민에 대한 입장(한 줄). 빈 문자열 = 중립. */
  stance: string;
  colorFrom: string;
  colorTo: string;
  characterPrompt?: string;
  /** 사회자 한 명은 자동 포함 — 발언 순번 결정 로직에서 분기. */
  isFacilitator?: boolean;
}
