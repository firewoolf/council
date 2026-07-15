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

/** 페르소나 설계·토론 근거에 함께 쓰는 MI 번들 */
export interface MiBundle {
  query: string | null;
  contents: MiContent[];
  issues: MiIssue[];
  entities: MiEntity[];
}

export const EMPTY_MI_BUNDLE: MiBundle = {
  query: null,
  contents: [],
  issues: [],
  entities: [],
};

export function isMiBundleEmpty(b: MiBundle): boolean {
  return (
    b.contents.length === 0 && b.issues.length === 0 && b.entities.length === 0
  );
}
