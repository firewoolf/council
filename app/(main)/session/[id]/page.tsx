'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Flag,
  Trash2,
} from 'lucide-react';

import { DebateControls } from '@/components/debate/DebateControls';
import { DebateFeed } from '@/components/debate/DebateFeed';
import { UserInput } from '@/components/debate/UserInput';
import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { Button } from '@/components/ui/button';
import { useDebate } from '@/hooks/useDebate';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useSessionsStore } from '@/store/sessions';
import { PERSONA_MAP } from '@/lib/prompts/personas';
import { cn } from '@/lib/utils';
import type { Persona } from '@/types/persona';

/**
 * 실시간 자동 토론 회의실.
 *
 * 레이아웃:
 *   - 상단: 고민 collapsible 헤더 (orb 미리보기 + 펼치면 전체 텍스트)
 *   - 본문: DebateFeed (메시지 + thinkingPersona)
 *   - 하단 sticky: DebateControls
 */
export default function SessionRoomPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const mounted = useHasMounted();

  const session = useSessionsStore((s) => s.sessions[id]);
  const messages = useSessionsStore((s) => s.messages[id] ?? []);
  const personaIds = useSessionsStore((s) => s.sessionPersonas[id] ?? []);
  const domain = useSessionsStore((s) => s.domains[id] ?? null);
  const conclusion = useSessionsStore((s) => s.conclusions[id] ?? null);
  const deleteSession = useSessionsStore((s) => s.deleteSession);

  const personas = useMemo<Persona[]>(
    () =>
      personaIds
        .map((pid) => PERSONA_MAP[pid])
        .filter((p): p is Persona => Boolean(p)),
    [personaIds],
  );

  const { status, thinkingPersona, error, actions } = useDebate(id);
  const [headerOpen, setHeaderOpen] = useState(false);

  // 마운트 후 세션 없으면 → 홈
  useEffect(() => {
    if (mounted && !session) {
      toast.error('세션을 찾을 수 없습니다.');
      router.replace('/');
    }
  }, [mounted, session, router]);

  // 에러 토스트
  useEffect(() => {
    if (error) toast.error(`토론 진행 중 오류: ${error}`);
  }, [error]);

  if (!mounted || !session) {
    return <div className="min-h-[60vh]" aria-hidden />;
  }

  return (
    <div className="flex flex-col gap-4 pb-32 pt-2">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        홈으로
      </Link>

      {/* 헤더 — 접힘 */}
      <header className="overflow-hidden rounded-xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => setHeaderOpen((v) => !v)}
          className="flex w-full items-start gap-3 p-4 text-left hover:bg-surface-2"
        >
          <div className="flex -space-x-1.5 shrink-0">
            {personas.slice(0, 4).map((p) => (
              <PersonaOrb
                key={p.id}
                persona={p}
                size={28}
                glow="none"
                className="ring-2 ring-surface"
              />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                'text-sm font-semibold leading-snug text-text',
                !headerOpen && 'truncate',
              )}
            >
              {session.title}
            </h1>
            <p className="mt-0.5 font-mono text-[11px] text-text-muted">
              {personas.length}명 참여
              {domain && ` · ${domain}`}
              {conclusion && ' · 결론 완료'}
            </p>
          </div>
          {headerOpen ? (
            <ChevronUp className="size-4 text-text-muted" />
          ) : (
            <ChevronDown className="size-4 text-text-muted" />
          )}
        </button>

        {headerOpen && (
          <div className="space-y-3 border-t border-border bg-background/40 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text/90">
              {session.concern}
            </p>
            <div className="flex flex-wrap gap-2">
              {personas.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-1 text-xs text-text/90"
                >
                  <PersonaOrb persona={p} size={16} glow="none" />
                  {p.dynamic && domain ? `${p.name} (${domain})` : p.name}
                </span>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm('이 세션을 삭제할까요? 되돌릴 수 없습니다.')) {
                    deleteSession(id);
                    toast.success('세션이 삭제되었습니다.');
                    router.replace('/');
                  }
                }}
              >
                <Trash2 className="size-3.5 text-destructive" />
                <span className="text-destructive">삭제</span>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* 결론 완료 시 summary 링크 배너 */}
      {conclusion && (
        <Link
          href={`/session/${id}/summary`}
          className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 transition-colors hover:bg-primary/15"
        >
          <div className="flex items-start gap-3">
            <Flag className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-text">
                결론이 정리되었습니다
              </p>
              <p className="text-xs text-text-muted">
                핵심 결론·리스크·추천 액션 보기
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-primary">결론 보기 →</span>
        </Link>
      )}

      {/* 에러 배너 */}
      {error && status === 'error' && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-text">토론이 중단되었습니다</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{error}</p>
          </div>
        </div>
      )}

      {/* 피드 */}
      <DebateFeed
        messages={messages}
        thinkingPersona={thinkingPersona}
        emptyHint={
          status === 'idle'
            ? '"토론 시작"을 누르면 페르소나들이 첫 발언을 시작합니다.'
            : undefined
        }
      />

      {/* 사용자 개입 — 결론 완료/진행중에는 숨김 */}
      {status !== 'concluded' && status !== 'concluding' && (
        <UserInput
          activePersonaIds={personaIds}
          domain={domain}
          disabled={status === 'error'}
          onSpeak={actions.injectUserMessage}
          onInstruct={actions.injectInstruction}
          onAddPersona={actions.addPersona}
        />
      )}

      {/* 컨트롤 */}
      <DebateControls
        status={status}
        messageCount={messages.length}
        onStart={actions.start}
        onPause={actions.pause}
        onResume={actions.resume}
        onConclude={actions.conclude}
      />
    </div>
  );
}
