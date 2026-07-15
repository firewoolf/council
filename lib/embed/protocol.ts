/**
 * COUNCIL ↔ 호스트(insight-out) iframe 임베드 메시지 프로토콜.
 *
 * insight-out 대시보드가 COUNCIL 을 iframe 으로 임베드하고,
 * MI(마켓 인텔리전스) 컨텍스트를 postMessage 로 주입한다.
 * COUNCIL 은 토론 결론을 다시 호스트로 회신한다.
 *
 * 양쪽 레포가 각자 이 상수/타입의 사본을 유지한다 (별도 배포).
 * 프로토콜 버전 문자열이 일치해야만 메시지를 수신한다.
 */

export const COUNCIL_EMBED_PROTOCOL = 'council-embed/v1';

/** MI 근거 소스 (기사/리포트 링크 등) */
export interface EmbedSource {
  title: string;
  url?: string;
}

/** 호스트 → COUNCIL: 토론 컨텍스트 주입 */
export interface SetContextPayload {
  /** 토론 고민/주제 — /session/new 입력창에 프리필 */
  concern: string;
  /** MI 근거 소스 목록 (배너 표시용) */
  sources?: EmbedSource[];
  /** 부가 메모 (예: 관점 지시) */
  note?: string;
}

/** COUNCIL → 호스트: 토론 결론 회신 */
export interface ResultPayload {
  sessionId: string;
  title: string;
  concern: string;
  conclusion: unknown;
}

export type HostToCouncilMessage =
  | {
      protocol: typeof COUNCIL_EMBED_PROTOCOL;
      type: 'set-context';
      payload: SetContextPayload;
    }
  | {
      // 로그인 티켓 주입 — 서버키 프록시 게이트 통과용.
      protocol: typeof COUNCIL_EMBED_PROTOCOL;
      type: 'set-auth';
      payload: { ticket: string };
    };

export type CouncilToHostMessage =
  | { protocol: typeof COUNCIL_EMBED_PROTOCOL; type: 'ready' }
  | { protocol: typeof COUNCIL_EMBED_PROTOCOL; type: 'result'; payload: ResultPayload };

/** 주입된 컨텍스트를 임시 보관하는 sessionStorage 키 */
export const EMBED_SEED_KEY = 'council:embed-context';

/** iframe 안에서 실행 중인지 여부 */
export function isEmbedded(): boolean {
  return typeof window !== 'undefined' && window.parent !== window;
}

/**
 * 메시지를 신뢰할 부모(호스트) 오리진 화이트리스트.
 * NEXT_PUBLIC_EMBED_ALLOWED_ORIGINS 로 재정의 (공백/콤마 구분).
 */
export function allowedParentOrigins(): string[] {
  const raw =
    process.env.NEXT_PUBLIC_EMBED_ALLOWED_ORIGINS ??
    'https://insight-out-app.vercel.app http://localhost:3000 http://localhost:3001';
  return raw.split(/[\s,]+/).filter(Boolean);
}

// 마지막으로 유효한 메시지를 보낸 부모 오리진 — 결과 회신 시 타깃으로 재사용.
let lastParentOrigin: string | null = null;

export function rememberParentOrigin(origin: string): void {
  lastParentOrigin = origin;
}

export function getParentOrigin(): string {
  return lastParentOrigin ?? '*';
}

/** sessionStorage 에서 주입된 컨텍스트를 읽는다 (없으면 null) */
export function readEmbedSeed(): SetContextPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(EMBED_SEED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SetContextPayload;
    return typeof parsed?.concern === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/** 주입된 컨텍스트를 소비 후 삭제 (재진입 시 오염 방지) */
export function clearEmbedSeed(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(EMBED_SEED_KEY);
  } catch {
    /* noop */
  }
}

/** 토론 결론을 호스트로 회신 (임베드 상태에서만 동작) */
export function postEmbedResult(payload: ResultPayload): void {
  if (!isEmbedded()) return;
  const msg: CouncilToHostMessage = {
    protocol: COUNCIL_EMBED_PROTOCOL,
    type: 'result',
    payload,
  };
  try {
    window.parent.postMessage(msg, getParentOrigin());
  } catch {
    /* noop */
  }
}
