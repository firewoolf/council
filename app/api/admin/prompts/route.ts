/**
 * 공통 프롬프트 (BASE_PROMPT + OUTPUT_HINT) 수정 엔드포인트.
 * PUT body = PromptsInput
 */

import { NextResponse } from 'next/server';

import { isAuthenticated } from '@/lib/admin/auth';
import { commitFile, isEditEnabled } from '@/lib/admin/github';
import { promptsSchema } from '@/lib/admin/schemas';

export async function PUT(request: Request) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  if (!isEditEnabled()) {
    return NextResponse.json(
      { error: '편집 기능이 비활성화되어 있습니다. GITHUB_TOKEN, GITHUB_REPO 환경변수를 설정하세요.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 });
  }

  const parsed = promptsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '검증 실패', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const fileContent = JSON.stringify(parsed.data, null, 2) + '\n';

  try {
    const result = await commitFile(
      'data/prompts.json',
      fileContent,
      'chore(admin): update common prompts (BASE/OUTPUT)',
    );
    return NextResponse.json({
      ok: true,
      commitSha: result.commitSha,
      commitUrl: result.commitUrl,
      note: '약 1~2분 후 Vercel 재배포가 완료되면 변경사항이 반영됩니다.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'commit 실패';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
