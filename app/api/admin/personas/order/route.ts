/**
 * 페르소나 순서 변경 엔드포인트.
 * PUT body = { ids: string[] }
 *
 * 검증:
 *   - body.ids 길이 = 현재 personas 길이 (추가/삭제 없음)
 *   - body.ids 집합 = 현재 personas의 id 집합 (다른 id 섞이지 않음)
 *
 * 안전성:
 *   - reorder 와 create/delete 가 같은 파일을 동시 수정하면 sha mismatch 가능 →
 *     단일 어드민 운영 가정이라 별도 락 X
 */

import { NextResponse } from 'next/server';

import { isAuthenticated } from '@/lib/admin/auth';
import { commitFile, isEditEnabled } from '@/lib/admin/github';
import currentPersonas from '@/data/personas.json';
import type { Persona } from '@/types/persona';

export async function PUT(request: Request) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  if (!isEditEnabled()) {
    return NextResponse.json(
      { error: '편집 기능이 비활성화되어 있습니다.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 });
  }

  const ids =
    typeof body === 'object' && body !== null && 'ids' in body
      ? (body as { ids: unknown }).ids
      : null;

  if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) {
    return NextResponse.json(
      { error: 'body.ids 는 문자열 배열이어야 합니다.' },
      { status: 400 },
    );
  }

  const personas = currentPersonas as Persona[];
  if (ids.length !== personas.length) {
    return NextResponse.json(
      {
        error: `ids 길이 불일치: ids=${ids.length}, current=${personas.length}. reorder 중 create/delete가 발생했을 수 있습니다. 새로고침 후 다시 시도하세요.`,
      },
      { status: 409 },
    );
  }

  const currentSet = new Set(personas.map((p) => p.id));
  const incomingSet = new Set(ids);
  if (incomingSet.size !== ids.length) {
    return NextResponse.json(
      { error: 'ids 에 중복이 있습니다.' },
      { status: 400 },
    );
  }
  for (const id of ids) {
    if (!currentSet.has(id)) {
      return NextResponse.json(
        { error: `존재하지 않는 id: "${id}"` },
        { status: 400 },
      );
    }
  }

  // id → persona 맵으로 재정렬
  const byId = new Map(personas.map((p) => [p.id, p]));
  const reordered = ids.map((id) => byId.get(id)!).filter(Boolean);

  const fileContent = JSON.stringify(reordered, null, 2) + '\n';

  try {
    const result = await commitFile(
      'data/personas.json',
      fileContent,
      'chore(admin): reorder personas',
    );
    return NextResponse.json({
      ok: true,
      commitSha: result.commitSha,
      commitUrl: result.commitUrl,
      note: '약 1~2분 후 Vercel 재배포가 완료되면 반영됩니다.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'commit 실패';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
