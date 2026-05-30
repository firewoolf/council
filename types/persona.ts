/**
 * 페르소나 도메인 타입.
 *
 * 트랙① Phase B 구분:
 *   - Archetype  : `data/personas.json` 의 재사용 템플릿 (고정 10명, 운영자 편집 가능)
 *   - CastMember : 한 세션에 출연하는 페르소나 인스턴스
 *                  (아키타입 복제 / 추천기가 즉석 설계한 generated / 사용자 custom)
 *
 * 굴복 금지 규칙은 BASE_PROMPT 가 모든 합성에 prepend 되므로 source 와 무관하게 유지.
 *
 * Phase E: 단일 Temperament enum → 3축 Trait 객체로 재설계.
 *   - StanceAxis : 이 고민에서의 기본 입장 분류
 *   - Lens       : 인지 양식 (어떻게 사안을 보는가)
 *   - Expression : 표현 방식 (어떻게 말하는가)
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
 * Phase E 신설 — stance 축.
 * 이 패널 멤버가 *이 고민* 에 취하는 기본 입장 분류.
 *   advocate : 추진/찬성: "X 해야 한다"
 *   critic   : 비판/반대: "X 하지 말라, Y 가 먼저다"
 *   agnostic : 전제 의심/중립: "X 라는 질문 자체가 틀렸다"
 */
export type StanceAxis =
  | 'advocate'
  | 'critic'
  | 'agnostic';

/**
 * Phase E 신설 — lens 축.
 * 어떤 *인지 양식* 으로 사안을 보는가.
 *   analyst    : 데이터·구조·숫자 (감정 배제)
 *   empath     : 사람·감정·심리·지속가능성
 *   pragmatist : 실전·경험·업계 현실
 */
export type Lens =
  | 'analyst'
  | 'empath'
  | 'pragmatist';

/**
 * Phase E 신설 — expression 축.
 * 어떤 *표현 방식* 으로 말하는가.
 *   provocateur : 도발·직설·불편한 직언
 *   measured    : 측정된·정중한·구조적
 */
export type Expression =
  | 'provocateur'
  | 'measured';

/**
 * Phase E 신설 — 3축 trait 묶음.
 * Phase B 의 단일 Temperament enum 을 대체한다.
 */
export interface Trait {
  stanceAxis: StanceAxis;
  lens: Lens;
  expression: Expression;
}

/**
 * 재사용 템플릿 — `data/personas.json` 의 10명.
 * 운영자 어드민에서 편집 가능, 빌드 시점에 클라이언트로 임베드.
 *
 * `debateStyle` 는 각 캐릭터 `systemPrompt` 본문이 텍스트로 품고 있어 잔존.
 * `trait`  는 Phase E 신설 3축 분류 — picker 뱃지/필터, 합성 지시에 사용.
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
  trait: Trait;
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
  trait: Trait;
  /** 이 고민에 대한 입장(한 줄). 빈 문자열 = 중립. */
  stance: string;
  colorFrom: string;
  colorTo: string;
  characterPrompt?: string;
  /** 사회자 한 명은 자동 포함 — 발언 순번 결정 로직에서 분기. */
  isFacilitator?: boolean;
}
