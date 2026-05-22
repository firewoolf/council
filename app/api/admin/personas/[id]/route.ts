/**
 * 개별 페르소나 수정 엔드포인트.
 * PUT body = PersonaInput
 *
 * 흐름:
 *   1. 어드민 인증 확인
 *   2. body Zod 검증
 *   3. 현재 personas.json 로딩 (서버에 import된 그것 — 직전 배포 시점)
 *   4. id 일치 항목 교체 (id 자체는 immutable — URL의 id 와 body.id 동일성 검증)
 *   5. GitHub commit
 *   6. 응답 (Vercel 재배포 진행 안내)
 */

import { NextResponse } from 'next/server';

import { isAuthenticated } from '@/lib/admin/auth';
import { commitFile, isEditEnabled } from '@/lib/admin/github';
import { personaSchema } from '@/lib/admin/schemas';
import currentPersonas from '@/data/personas.json';
import type { Persona } from '@/types/persona';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
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

  const parsed = personaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '검증 실패', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.id !== params.id) {
    return NextResponse.json(
      { error: 'URL의 id와 body.id가 일치하지 않습니다. id는 변경할 수 없습니다.' },
      { status: 400 },
    );
  }

  const personas = currentPersonas as Persona[];
  const idx = personas.findIndex((p) => p.id === params.id);
  if (idx < 0) {
    return NextResponse.json(
      { error: `id="${params.id}" 페르소나를 찾을 수 없습니다.` },
      { status: 404 },
    );
  }

  // 새 배열 만들고 JSON 직렬화 — 들여쓰기 2칸으로 git diff 가독성 유지
  const next = [...personas];
  next[idx] = parsed.data;
  const fileContent = JSON.stringify(next, null, 2) + '\n';

  try {
    const result = await commitFile(
      'data/personas.json',
      fileContent,
      `chore(admin): update persona "${parsed.data.name}" (${parsed.data.id})`,
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
