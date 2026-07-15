/**
 * 서버 등록 키 관리 — ⚠️ 서버 전용 (process.env 읽음).
 *
 * env 스키마 (공급사별):
 *   `${PREFIX}_API_KEYS = "k1,k2,k3"`  ← 콤마 목록 (같은 공급사 여러 키 = 무료한도 곱)
 *   `${PREFIX}_API_KEY  = "k1"`        ← 단일 키 (편의)
 * 둘 다 있으면 합쳐서 사용. 요청마다 라운드로빈으로 한 키를 고른다.
 *
 * ⚠️ 절대 NEXT_PUBLIC_ 접두 금지 — 브라우저 노출 시 키 유출.
 */

import { UPSTREAM } from './upstream';

// 공급사별 라운드로빈 커서 (프로세스 메모리 — 서버리스 인스턴스 단위면 충분).
const cursors: Record<string, number> = {};

/** 그 공급사에 등록된 키 목록 (없으면 빈 배열). */
export function getServerKeys(provider: string): string[] {
  const up = UPSTREAM[provider];
  if (!up) return [];
  const multi = process.env[`${up.envPrefix}_API_KEYS`] ?? '';
  const single = process.env[`${up.envPrefix}_API_KEY`] ?? '';
  const merged = [multi, single].filter(Boolean).join(',');
  return merged
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 라운드로빈 시작 인덱스를 하나 전진시켜 반환. */
export function nextCursor(provider: string, len: number): number {
  if (len <= 0) return 0;
  const i = (cursors[provider] ?? 0) % len;
  cursors[provider] = i + 1;
  return i;
}

/** 키가 1개 이상 등록된 공급사 목록 — 클라이언트에 노출할 서버 공급사. */
export function configuredServerProviders(): string[] {
  return Object.keys(UPSTREAM).filter((p) => getServerKeys(p).length > 0);
}
