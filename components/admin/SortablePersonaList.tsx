'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, GripVertical, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { PersonaOrb } from '@/components/persona/PersonaOrb';
import type { Archetype as Persona } from '@/types/persona';

interface Props {
  initial: readonly Persona[];
  /** 편집 활성화 여부 — false 면 드래그 핸들 숨김 */
  editable: boolean;
}

export function SortablePersonaList({ initial, editable }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Persona[]>([...initial]);
  const [saving, setSaving] = useState(false);

  // 초기 순서와 비교해 dirty 여부 판정 — id 시퀀스 비교
  const isDirty = items.some((p, i) => p.id !== initial[i]?.id);

  const sensors = useSensors(
    // 8px 이상 드래그해야 시작 — 클릭(=상세 진입)과 충돌 방지
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const oldIndex = current.findIndex((p) => p.id === active.id);
      const newIndex = current.findIndex((p) => p.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  function handleReset() {
    setItems([...initial]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/personas/order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: items.map((p) => p.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '저장 실패');
      toast.success('순서 변경 commit 완료. 1-2분 후 반영.');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-2">
            {items.map((p) => (
              <SortableItem key={p.id} persona={p} editable={editable} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {editable && isDirty && (
        <div className="sticky bottom-4 z-10 mt-4 flex items-center justify-end gap-2 rounded-xl border border-primary/40 bg-surface/95 p-3 shadow-lg backdrop-blur">
          <span className="mr-auto text-xs text-text-muted">
            순서가 변경됨 — 저장 시 GitHub commit + 재배포.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={saving}
          >
            <RotateCcw className="size-3.5" />
            되돌리기
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            {saving ? '저장 중...' : '순서 저장'}
          </Button>
        </div>
      )}
    </>
  );
}

function SortableItem({
  persona,
  editable,
}: {
  persona: Persona;
  editable: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: persona.id, disabled: !editable });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <li ref={setNodeRef} style={style}>
      <div className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-surface-2">
        {editable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="드래그하여 순서 변경"
            className="cursor-grab touch-none rounded p-1 text-text-muted hover:text-text active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <PersonaOrb persona={persona} size={40} glow="none" />
        <Link
          href={`/admin/personas/${persona.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text">{persona.name}</p>
            <p className="truncate text-xs text-text-muted">{persona.role}</p>
            <p className="mt-1 font-mono text-[10px] text-text-dim">
              {persona.id} · {persona.debateStyle} · {persona.temperament}
            </p>
          </div>
          <ArrowRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>
      </div>
    </li>
  );
}
