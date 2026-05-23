'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

interface Props {
  personaId: string;
  personaName: string;
}

export function DeletePersonaButton({ personaId, personaName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    const ok = window.confirm(
      `"${personaName}" 페르소나를 삭제합니다.\n\nGitHub 레포의 data/personas.json 에서 영구 제거되고 (commit 이력으로만 추적 가능), 약 1~2분 후 배포에 반영됩니다.\n\n진행하시겠습니까?`,
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/personas/${personaId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '삭제 실패');
      toast.success(`"${personaName}" 삭제 commit 완료. 1-2분 후 반영.`);
      router.push('/admin/personas');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={busy}
      className="border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      삭제
    </Button>
  );
}
