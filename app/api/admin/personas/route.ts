/**
 * 페르소나 생성 엔드포인트.
 * POST body = PersonaInput
 *
 * 흐름:
 *   1. 인증 + 편집 가능 여부 확인
 *   2. Zod 검증
 *   3. id 중복 체크 (기존 배열과 충돌 X)
 *   4. 배열 끝에 append → JSON 직렬화 → GitHub commit
 */

import { NextResponse } from 'next/server';

import { isAuthenticated } from '@/lib/admin/auth';
import { commitFile, isEditEnabled } from '@/lib/admin/github';
import { personaSchema } from '@/lib/admin/schemas';
import currentPersonas from '@/data/personas.json';
import type { Archetype as Persona } from '@/types/persona';

export async function POST(request: Request) {
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

  const personas = currentPersonas as Persona[];
  if (personas.some((p) => p.id === parsed.data.id)) {
    return NextResponse.json(
      { error: `id="${parsed.data.id}" 페르소나가 이미 존재합니다. 다른 id를 사용하세요.` },
      { status: 409 },
    );
  }

  const next = [...personas, parsed.data];
  const fileContent = JSON.stringify(next, null, 2) + '\n';

  try {
    const result = await commitFile(
      'data/personas.json',
      fileContent,
      `feat(admin): add persona "${parsed.data.name}" (${parsed.data.id})`,
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
