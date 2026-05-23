import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, GripVertical, Lock, Plus } from 'lucide-react';

import { SortablePersonaList } from '@/components/admin/SortablePersonaList';
import { isAdminEnabled, isAuthenticated } from '@/lib/admin/auth';
import { isEditEnabled } from '@/lib/admin/github';
import { PERSONAS } from '@/lib/prompts/personas';

export const dynamic = 'force-dynamic';

/**
 * 페르소나 목록.
 *   - 편집 활성: 드래그로 순서 변경 + 새 페르소나 버튼
 *   - 편집 비활성: 읽기 전용 (드래그 핸들 숨김)
 *
 * 순서는 data/personas.json 배열 순서가 단일 진실. 저장 시
 * PUT /api/admin/personas/order 로 새 순서 commit.
 */
export default function AdminPersonasPage() {
  if (!isAdminEnabled()) redirect('/admin');
  if (!isAuthenticated()) redirect('/admin/login');

  const editable = isEditEnabled();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin"
          className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text"
        >
          <ArrowLeft className="size-3.5" />
          대시보드
        </Link>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-text">페르소나 ({PERSONAS.length})</h1>
          {editable ? (
            <Link
              href="/admin/personas/new"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <Plus className="size-3.5" />
              새 페르소나
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-text-muted">
              <Lock className="size-3" /> 읽기 전용
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted">
          {editable ? (
            <>
              <GripVertical className="mr-0.5 inline size-3 align-text-bottom" />
              핸들을 드래그해 순서를 바꾸거나, 항목을 눌러 상세/편집.
            </>
          ) : (
            'GITHUB_TOKEN, GITHUB_REPO 환경변수가 설정되면 편집이 활성화됩니다.'
          )}
        </p>
      </div>

      <SortablePersonaList initial={PERSONAS} editable={editable} />
    </div>
  );
}
