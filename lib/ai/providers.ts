/**
 * AI 공급사 추상화.
 *
 * 1단계(클로즈 베타): Claude Sonnet — 서버 API Route
 * 2단계(오픈 베타) : Gemini 2.0 Flash / Groq Llama 3.3 — 브라우저 직접 호출
 * 3단계(유료)      : Claude Sonnet — 서버 (크레딧 차감)
 *
 * BYOK 흐름은 2단계 기준. Anthropic은 CORS 불가라 BYOK 불가능 → 서버 전용.
 */

export type AiProvider = 'gemini' | 'groq' | 'claude';

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
}

export const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  gemini: {
    id: 'gemini',
    displayName: 'Google Gemini',
    signupUrl: 'https://aistudio.google.com/apikey',
    signupGuide:
      'Google 계정 로그인 → "Create API key" 클릭 → 새 키 복사 (30초)',
    modelId: 'gemini-2.0-flash-exp',
    // AIzaSy로 시작하는 39자 키
    keyPattern: /^AIza[A-Za-z0-9_-]{35}$/,
    browserDirect: true,
    accent: { from: '#4285F4', to: '#34A853' },
    freeTier: '분당 15회 / 일 1500회 무료 (Gemini 2.0 Flash 기준)',
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

/** 사용자에게 보여줄 공급사 목록 — 브라우저 직접 호출 가능한 것만. */
export const BYOK_PROVIDERS: AiProvider[] = ['gemini', 'groq'];
