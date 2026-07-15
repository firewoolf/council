/**
 * 서버키 프록시 업스트림 레지스트리 — 공급사별 실제 엔드포인트 + 인증 방식.
 *
 * 프록시(/api/ai/[provider]/[...path])는 이 레지스트리로 요청을 실제 공급사에 포워드한다.
 * 대부분 OpenAI 호환(Bearer). Gemini만 Google 방식(x-goog-api-key 헤더).
 *
 * "무료 API 몽땅" — 여기 한 줄 추가 + env 키만 넣으면 새 공급사가 켜진다.
 * (키가 없으면 configuredServerProviders 에서 자동 제외되어 노출 안 됨.)
 */

export type UpstreamAuth = 'bearer' | 'google';

export interface Upstream {
  /** 실제 공급사 API base (경로·쿼리는 프록시가 그대로 이어붙임) */
  baseURL: string;
  /** 키 주입 방식 */
  auth: UpstreamAuth;
  /** env 접두 — `${envPrefix}_API_KEY(S)` 로 키를 읽는다 */
  envPrefix: string;
}

export const UPSTREAM: Record<string, Upstream> = {
  // ── 기존 4개 ──────────────────────────────────────────────
  groq:       { baseURL: 'https://api.groq.com/openai/v1',                auth: 'bearer', envPrefix: 'GROQ' },
  gemini:     { baseURL: 'https://generativelanguage.googleapis.com/v1beta', auth: 'google', envPrefix: 'GEMINI' },
  cerebras:   { baseURL: 'https://api.cerebras.ai/v1',                    auth: 'bearer', envPrefix: 'CEREBRAS' },
  openrouter: { baseURL: 'https://openrouter.ai/api/v1',                  auth: 'bearer', envPrefix: 'OPENROUTER' },

  // ── 추가 무료/무료체험 공급사 (OpenAI 호환) ────────────────
  mistral:    { baseURL: 'https://api.mistral.ai/v1',                     auth: 'bearer', envPrefix: 'MISTRAL' },
  sambanova:  { baseURL: 'https://api.sambanova.ai/v1',                   auth: 'bearer', envPrefix: 'SAMBANOVA' },
  nvidia:     { baseURL: 'https://integrate.api.nvidia.com/v1',          auth: 'bearer', envPrefix: 'NVIDIA' },
  together:   { baseURL: 'https://api.together.xyz/v1',                   auth: 'bearer', envPrefix: 'TOGETHER' },
  github:     { baseURL: 'https://models.inference.ai.azure.com',        auth: 'bearer', envPrefix: 'GITHUB_MODELS' },
};

export function isKnownUpstream(provider: string): provider is keyof typeof UPSTREAM {
  return Object.prototype.hasOwnProperty.call(UPSTREAM, provider);
}
