/**
 * GitHub Contents API client — 어드민 편집 → 레포 commit 어댑터.
 *
 * 작동:
 *   1. GET /repos/{owner}/{repo}/contents/{path}  → 현재 파일 sha 획득
 *   2. PUT 같은 경로  → 새 base64 content + sha + commit message
 *   3. Vercel webhook 이 push 감지 → 자동 재배포
 *
 * 한계:
 *   - 동시 편집 시 sha mismatch → 409 (단일 어드민이라 무시)
 *   - PAT 권한: Contents Read & Write (해당 레포만)
 *
 * 환경변수:
 *   - GITHUB_TOKEN : PAT (필수)
 *   - GITHUB_REPO  : "owner/repo" (필수)
 *   - GITHUB_BRANCH: 기본 "main"
 */

import { env } from '@/env';

const API_BASE = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

/** GITHUB_TOKEN + GITHUB_REPO 둘 다 설정됐는지. 편집 UI 노출 조건. */
export function isEditEnabled(): boolean {
  return !!env.GITHUB_TOKEN && !!env.GITHUB_REPO;
}

function getRepoConfig(): { owner: string; repo: string; branch: string } {
  const repo = env.GITHUB_REPO;
  if (!repo) {
    throw new GitHubError('GITHUB_REPO 환경변수가 설정되지 않았습니다.');
  }
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new GitHubError(`GITHUB_REPO 형식이 잘못됨: "${repo}" (owner/repo 형식이어야 함)`);
  }
  return {
    owner,
    repo: name,
    branch: process.env.GITHUB_BRANCH ?? 'main',
  };
}

function getAuthHeaders(): Record<string, string> {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    throw new GitHubError('GITHUB_TOKEN 환경변수가 설정되지 않았습니다.');
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** 파일 현재 sha 조회. 존재하지 않으면 null. */
async function getFileSha(path: string): Promise<string | null> {
  const { owner, repo, branch } = getRepoConfig();
  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;

  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new GitHubError(`파일 조회 실패 (${res.status}): ${body.slice(0, 200)}`, res.status);
  }

  const data = (await res.json()) as { sha: string };
  return data.sha;
}

/**
 * 레포의 파일을 새 내용으로 덮어쓰고 commit.
 * @param path     레포 루트 기준 경로 (예: "data/personas.json")
 * @param content  새 파일 내용 (raw string)
 * @param message  commit 메시지
 */
export async function commitFile(
  path: string,
  content: string,
  message: string,
): Promise<{ commitSha: string; commitUrl: string }> {
  const { owner, repo, branch } = getRepoConfig();
  const sha = await getFileSha(path);

  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new GitHubError(
      `commit 실패 (${res.status}): ${text.slice(0, 300)}`,
      res.status,
    );
  }

  const json = (await res.json()) as {
    commit: { sha: string; html_url: string };
  };

  return {
    commitSha: json.commit.sha,
    commitUrl: json.commit.html_url,
  };
}
