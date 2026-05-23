/**
 * AI 공급사 추상화.
 *
 * 1단계(클로즈 베타): Claude Sonnet — 서버 API Route
 * 2단계(오픈 베타) : Gemini 2.0 Flash / Groq Llama 3.3 — 브라우저 직접 호출
 * 3단계(유료)      : Claude Sonnet — 서버 (크레딧 차감)
 *
 * BYOK 흐름은 2단계 기준. Anthropic은 CORS 불가라 BYOK 불가능 → 서버 전용.
 */

export type AiProvider =
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'cerebras'
  | 'claude';

/**
 * LLM 호출 작업 종류 — provider 라우팅에 사용.
 * - recommend : 페르소나 추천 (세션당 1회, 복잡한 enum 스키마, 품질 우선)
 * - debate    : 토론 발언 생성 (턴당 1회 × 20-30회, 속도·RPM 우선)
 * - conclude  : 결론 생성 (세션당 1회, 4섹션 구조화 출력, 품질 우선)
 */
export type AiTaskRole = 'recommend' | 'debate' | 'conclude';

export interface ProviderConfig {
  id: AiProvider;
  displayName: string;
  /** 키 발급 페이지 */
  signupUrl: string;
  /** 키 발급 30초 가이드 */
  signupGuide: string;
  /** 모델 식별자 */
  modelId: string;
  /** 키 형식 검증 정규식 (UX 즉시 피드백용) */
  keyPattern: RegExp;
  /** 브라우저 직접 호출 가능 여부 (CORS) */
  browserDirect: boolean;
  /** orb 색상 — 설정 카드에서 사용 */
  accent: { from: string; to: string };
  /** 무료 한도 한 줄 요약 */
  freeTier: string;
  /**
   * 이 provider 가 적합한 작업 목록.
   * - 명시 시 해당 role에서만 우선 선택됨.
   * - 비우면(undefined) "모든 작업 가능한 폴백 범용"으로 취급.
   * 사용자가 키를 1개만 넣은 경우 라우팅은 무시되고 그 1개로 모두 처리.
   */
  roles?: AiTaskRole[];
}

export const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  gemini: {
    id: 'gemini',
    displayName: 'Google Gemini',
    signupUrl: 'https://aistudio.google.com/apikey',
    signupGuide:
      'Google 계정 로그인 → "Create API key" 클릭 → 새 키 복사 (30초)',
    // gemini-2.0-flash-exp 는 무료 한도가 매우 박함 (RPM ~10, RPD ~250).
    // gemini-2.5-flash-lite 는 stable + 한국어 품질 OK + RPD 여유 (~1000).
    modelId: 'gemini-2.5-flash-lite',
    // AIzaSy로 시작하는 39자 키
    keyPattern: /^AIza[A-Za-z0-9_-]{35}$/,
    browserDirect: true,
    accent: { from: '#4285F4', to: '#34A853' },
    freeTier: '분당 15회 / 일 1000회 무료 (Gemini 2.5 Flash-Lite 기준)',
    // Gemini: 한국어·구조화 출력 안정 → 추천 + 결론에 강점
    roles: ['recommend', 'conclude'],
  },
  groq: {
    id: 'groq',
    displayName: 'Groq (Llama 3.3)',
    signupUrl: 'https://console.groq.com/keys',
    signupGuide:
      'Groq 콘솔 가입 → "Create API Key" → 키 복사 (30초). GitHub/Google 로그인 가능.',
    modelId: 'llama-3.3-70b-versatile',
    // gsk_로 시작
    keyPattern: /^gsk_[A-Za-z0-9]{40,}$/,
    browserDirect: true,
    accent: { from: '#F55036', to: '#FF8A65' },
    freeTier: '분당 30회 / 일 14400회 무료 (Llama 3.3 70B 기준)',
    // Groq: 초고속 + RPM 30 → 턴당 1회 호출되는 토론 발언에 최적
    roles: ['debate'],
  },
  openrouter: {
    id: 'openrouter',
    displayName: 'OpenRouter (무료 모델)',
    signupUrl: 'https://openrouter.ai/keys',
    signupGuide:
      'OpenRouter 가입 → Keys → "Create Key" (GitHub/Google 로그인). 키 복사 후 입력 (30초).',
    // 무료 모델은 자주 바뀐다 — https://openrouter.ai/models?fmt=cards&q=:free 에서 최신 확인.
    // 현재 시점 안정적 후보: Llama 3.3 70B Instruct (:free) — 한국어 OK, JSON schema 준수도 양호.
    modelId: 'meta-llama/llama-3.3-70b-instruct:free',
    // sk-or-v1- 접두사 + 64자 hex 정도
    keyPattern: /^sk-or-v1-[A-Za-z0-9]{40,}$/,
    browserDirect: true,
    accent: { from: '#6E40C9', to: '#A5A5FF' },
    freeTier: '무료 모델 일 50회 (크레딧 충전 시 1000회) / 분당 20회',
    // OpenRouter: 폴백 범용 — roles 비워서 모든 작업 가능
    // (다른 공급사가 한도 초과 시 어디든 받아주는 보조 풀)
  },
  cerebras: {
    id: 'cerebras',
    displayName: 'Cerebras (초고속)',
    signupUrl: 'https://cloud.cerebras.ai',
    signupGuide:
      'Cerebras Cloud 가입 → API Keys → "Create Key" → 복사 (30초). 무료 계정 즉시 발급.',
    // Cerebras 공식 docs 기준 stable 모델. 한국어/구조화 출력 모두 양호.
    modelId: 'llama-3.3-70b',
    // csk- 접두사 추정. 실제 키 형식이 다르면 빌드 후 §6 검증 단계에서 정정.
    keyPattern: /^csk-[A-Za-z0-9]{20,}$/,
    // 워크오더 §6: CORS 실측 필요. SDK docs 기준 브라우저 호출 지원으로 표기하지만,
    // 실제 배포 후 네트워크 탭에서 확인 후 false 로 토글할 수 있음.
    browserDirect: true,
    accent: { from: '#0F766E', to: '#5EEAD4' },
    freeTier: '분당 6만 토큰 / 일 약 1700회 (Llama 3.3 70B 기준)',
    // Cerebras: 초고속 추론 → 토론 발언 (대안 debate provider)
    roles: ['debate'],
  },
  claude: {
    id: 'claude',
    displayName: 'Anthropic Claude (서버 전용)',
    signupUrl: 'https://console.anthropic.com/settings/keys',
    signupGuide:
      'Anthropic 콘솔 가입 → "Create Key" → 결제 정보 등록 필요. (BYOK 불가 — 서버 모드)',
    modelId: 'claude-sonnet-4-6',
    keyPattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    browserDirect: false,
    accent: { from: '#D97757', to: '#F4A887' },
    freeTier: '무료 한도 없음. 사용량 과금.',
  },
};

/** 키 형식 1차 검증 (정규식만 — 실제 유효성은 ping API로 확인) */
export function validateKeyFormat(provider: AiProvider, key: string): boolean {
  return PROVIDERS[provider].keyPattern.test(key.trim());
}

/**
 * store/api-key.ts 의 keys 객체 → 키가 등록된 BYOK 공급사 배열.
 * - BYOK_PROVIDERS 순서를 보존 (= 추천 순서).
 * - claude 는 BYOK가 아니므로 자동 제외.
 */
export function listAvailableProviders(
  keys: Partial<Record<AiProvider, string>>,
): AiProvider[] {
  return BYOK_PROVIDERS.filter((p) => !!keys[p]);
}

/**
 * 작업 종류 + 사용 가능한 공급사 목록 → 적합한 공급사 1개 선택.
 *
 * 우선순위:
 *   1) roles 에 명시적으로 매치되는 공급사 (전문 풀)
 *   2) roles 가 undefined 인 폴백 범용 공급사 (예: openrouter)
 *   3) 그래도 없으면 첫 번째 사용 가능 공급사 (= 라우팅 무시)
 *
 * 사용자가 키를 1개만 넣어도 그 1개로 모두 동작 — 라우팅은
 * "여러 키가 있을 때의 최적화"일 뿐 강제가 아니다.
 *
 * @returns 선택된 공급사. available 이 비어있으면 null.
 */
export function pickProvider(
  role: AiTaskRole,
  available: readonly AiProvider[],
): AiProvider | null {
  if (available.length === 0) return null;

  // 1순위: roles 매치
  const specialist = available.find((p) =>
    PROVIDERS[p].roles?.includes(role),
  );
  if (specialist) return specialist;

  // 2순위: 폴백 범용 (roles undefined)
  const generalist = available.find((p) => !PROVIDERS[p].roles);
  if (generalist) return generalist;

  // 3순위: 그냥 첫 번째
  return available[0] ?? null;
}

/**
 * 사용자에게 보여줄 공급사 목록 — 브라우저 직접 호출 가능한 것만.
 * 추천 순서는 무료 한도 큰 것부터 (Groq > OpenRouter > Cerebras > Gemini).
 *
 * Cerebras 는 워크오더 §6 CORS 실측 후 막히면 이 배열에서 제외하고
 * PROVIDERS 의 browserDirect 를 false 로 토글한다.
 */
export const BYOK_PROVIDERS: AiProvider[] = [
  'groq',
  'openrouter',
  'cerebras',
  'gemini',
];
