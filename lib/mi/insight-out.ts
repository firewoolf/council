/**
 * insight-out MI 데이터 서버 페처 — ⚠️ 서버 전용.
 *
 * COUNCIL 서버(/api/mi)만 이 모듈을 쓴다. insight-out 읽기 전용 토큰은
 * INSIGHT_OUT_READ_TOKEN(비-NEXT_PUBLIC)으로 서버에만 보관 — 브라우저 노출 금지.
 *
 * 미설정(URL/토큰 없음) 시 빈 번들을 돌려주어 MI 없이도 COUNCIL 이 정상 동작한다.
 *
 * ⚠️ 서버 전용: /api/mi 라우트에서만 import 할 것. 비-NEXT_PUBLIC 토큰을 읽으므로
 * 클라이언트 컴포넌트에서 import 하면 안 된다(번들·유출 위험).
 */

import {
  EMPTY_MI_BUNDLE,
  type MiBundle,
  type MiContent,
  type MiEntity,
  type MiInsight,
  type MiIssue,
  type MiKeyword,
  type MiReport,
} from '@/lib/mi/types';

const BASE_URL = process.env.INSIGHT_OUT_API_URL ?? '';
const TOKEN = process.env.INSIGHT_OUT_READ_TOKEN ?? '';

export function isMiConfigured(): boolean {
  return Boolean(BASE_URL && TOKEN);
}

async function call<T>(
  resource: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<T | null> {
  if (!isMiConfigured()) return null;

  const url = new URL('/api/council', BASE_URL);
  url.searchParams.set('resource', resource);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${TOKEN}` },
      // MI 는 준실시간이면 충분 — 60초 캐시로 insight-out 부하 절감.
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function searchContents(opts: {
  query?: string;
  group?: string;
  category?: string;
  days?: number;
  limit?: number;
}): Promise<MiContent[]> {
  const data = await call<{ items: MiContent[] }>('search', {
    q: opts.query,
    group: opts.group,
    category: opts.category,
    days: opts.days,
    limit: opts.limit,
  });
  return data?.items ?? [];
}

export async function listIssues(opts: {
  query?: string;
  status?: string;
  limit?: number;
}): Promise<MiIssue[]> {
  const data = await call<{ items: MiIssue[] }>('issues', {
    q: opts.query,
    status: opts.status,
    limit: opts.limit,
  });
  return data?.items ?? [];
}

export async function listEntities(opts: {
  query?: string;
  competitorOnly?: boolean;
  limit?: number;
}): Promise<MiEntity[]> {
  const data = await call<{ items: MiEntity[] }>('entities', {
    q: opts.query,
    competitor_only: opts.competitorOnly,
    limit: opts.limit,
  });
  return data?.items ?? [];
}

// ── 확장 소스 (브릿지 미지원 시 빈 배열 — 전방호환) ──────────────
export async function listInsights(opts: {
  query?: string;
  limit?: number;
}): Promise<MiInsight[]> {
  const data = await call<{ items: MiInsight[] }>('insights', {
    q: opts.query,
    limit: opts.limit,
  });
  return data?.items ?? [];
}

export async function listReports(opts: {
  query?: string;
  limit?: number;
}): Promise<MiReport[]> {
  const data = await call<{ items: MiReport[] }>('reports', {
    q: opts.query,
    limit: opts.limit,
  });
  return data?.items ?? [];
}

export async function listCompetitorReports(opts: {
  limit?: number;
}): Promise<MiReport[]> {
  const data = await call<{ items: MiReport[] }>('competitor', {
    limit: opts.limit,
  });
  return data?.items ?? [];
}

export async function listKeywords(opts: {
  limit?: number;
}): Promise<MiKeyword[]> {
  const data = await call<{ items: MiKeyword[] }>('keywords', {
    limit: opts.limit,
  });
  return data?.items ?? [];
}

/**
 * 페르소나 설계·토론 근거·주제 역제안용 MI 번들 조회.
 * 콘텐츠·이슈·경쟁사에 더해 핵심 인사이트·AI 리포트·경쟁사 주간·키워드까지 병렬 조회.
 * (확장 소스는 브릿지 미지원 시 빈 배열 — 기존 소스만으로도 정상 동작.)
 */
export async function fetchMiBundle(query?: string): Promise<MiBundle> {
  if (!isMiConfigured()) return { ...EMPTY_MI_BUNDLE, query: query ?? null };

  const [
    contents,
    issues,
    entities,
    insights,
    reports,
    competitorReports,
    keywords,
  ] = await Promise.all([
    searchContents({ query, days: 60, limit: 8 }),
    listIssues({ query, status: 'published', limit: 6 }),
    listEntities({ competitorOnly: true, limit: 8 }),
    listInsights({ query, limit: 6 }),
    listReports({ query, limit: 5 }),
    listCompetitorReports({ limit: 4 }),
    listKeywords({ limit: 12 }),
  ]);

  return {
    query: query ?? null,
    contents,
    issues,
    entities,
    insights,
    reports,
    competitorReports,
    keywords,
  };
}
