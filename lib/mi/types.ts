/**
 * MI(마켓 인텔리전스) 데이터 타입 — insight-out `/api/council` 응답 형태.
 *
 * COUNCIL 은 이 데이터를 (1) 페르소나 패널 설계와 (2) 토론 근거 주입에 쓴다.
 */

export interface MiContent {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  author: string | null;
  url: string | null;
  publishedAt: string | null;
  tags: string[];
  importance: number | null;
}

export interface MiIssue {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  keywords: string[];
}

export interface MiEntity {
  id: string;
  name: string;
  type: string;
  description: string | null;
  isCompetitor: boolean;
  mentionCount: number;
}

/** 핵심 인사이트 (insight-out daily_insights) */
export interface MiInsight {
  headline: string;
  summary: string | null;
}

/** AI 리포트 / 경쟁사 주간 리포트 (제목+요약 공통 형태) */
export interface MiReport {
  title: string;
  summary: string | null;
}

/** 키워드 분석 결과 */
export interface MiKeyword {
  name: string;
  /** 상승/하락 등 추세 표기(있으면) */
  trend?: string | null;
}

/** 페르소나 설계·토론 근거·주제 역제안에 쓰는 MI 번들 */
export interface MiBundle {
  query: string | null;
  contents: MiContent[];
  issues: MiIssue[];
  entities: MiEntity[];
  /** 확장 소스 — 브릿지 미지원 시 빈 배열(전방호환) */
  insights: MiInsight[];
  reports: MiReport[];
  competitorReports: MiReport[];
  keywords: MiKeyword[];
}

export const EMPTY_MI_BUNDLE: MiBundle = {
  query: null,
  contents: [],
  issues: [],
  entities: [],
  insights: [],
  reports: [],
  competitorReports: [],
  keywords: [],
};

export function isMiBundleEmpty(b: MiBundle): boolean {
  return (
    b.contents.length === 0 &&
    b.issues.length === 0 &&
    b.entities.length === 0 &&
    b.insights.length === 0 &&
    b.reports.length === 0 &&
    b.competitorReports.length === 0 &&
    b.keywords.length === 0
  );
}
