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
  Volume2,
  VolumeX,
} from 'lucide-react';

import { DebateControls } from '@/components/debate/DebateControls';
import { DebateFeed } from '@/components/debate/DebateFeed';
import { PersonaDetailDrawer } from '@/components/debate/PersonaDetailDrawer';
import { SteeringPanel } from '@/components/debate/SteeringPanel';
import { WaitingMemoArea } from '@/components/debate/WaitingMemoArea';
import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { Button } from '@/components/ui/button';
import { useDebate } from '@/hooks/useDebate';
import { useHasMounted } from '@/hooks/useHasMounted';
import { isMuted, setMuted } from '@/lib/sound';
import { useSessionsStore } from '@/store/sessions';
import { cn } from '@/lib/utils';

/**
 * 트랙 ⑤-1 — 청크 재생 + 갈림길 회의실.
 *
 * 레이아웃:
 *   - 상단: 고민 collapsible 헤더
 *   - 본문: DebateFeed (revealedMessages)
 *   - phase==='steering': SteeringPanel 등장 (피드 아래)
 *   - 하단 sticky: DebateControls (재생 트랜스포트)
 */
export default function SessionRoomPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const mounted = useHasMounted();

  const session = useSessionsStore((s) => s.sessions[id]);
  const cast = useSessionsStore((s) => s.sessionCast?.[id] ?? []);
  const domain = useSessionsStore((s) => s.domains[id] ?? null);
  const conclusion = useSessionsStore((s) => s.conclusions[id] ?? null);
  const deleteSession = useSessionsStore((s) => s.deleteSession);

  const {
    phase,
    error,
    chunks,
    currentChunk,
    revealedMessages,
    isPaused,
    speed,
    progress,
    activeSpeakerId,
    thinkingMemberId,
    actions,
  } = useDebate(id);
  const [headerOpen, setHeaderOpen] = useState(false);
  // ⑤-5f-B — mute 토글 상태 (localStorage 에서 초기화, setMuted 와 동기화)
  const [soundMuted, setSoundMuted] = useState(() => isMuted());
  // 트랙 ⑤-2b — PersonaDetailDrawer 열림 대상
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  /** 드로어 대상 멤버 */
  const selectedMember = useMemo(
    () => (selectedMemberId ? (cast.find((m) => m.id === selectedMemberId) ?? null) : null),
    [selectedMemberId, cast],
  );

  /** 드로어에 표시할 해당 멤버의 발언만 (revealedMessages 기준) */
  const selectedMemberMessages = useMemo(
    () =>
      selectedMemberId
        ? revealedMessages.filter((m) => m.speakerId === selectedMemberId)
        : [],
    [selectedMemberId, revealedMessages],
  );

  useEffect(() => {
    if (mounted && !session) {
      toast.error('세션을 찾을 수 없습니다.');
      router.replace('/');
    }
  }, [mounted, session, router]);

  useEffect(() => {
    if (error) toast.error(`토론 진행 중 오류: ${error}`);
  }, [error]);

  if (!mounted || !session) {
    return <div className="min-h-[60vh]" aria-hidden />;
  }

  return (
    <div
      className="flex flex-col gap-4 pb-32 pt-2"
      style={{ backgroundImage: 'var(--stage-bg)' }}
    >
      {/* 상단 행 — 홈 링크 + mute 토글 */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text"
        >
          <ArrowLeft className="size-3.5" />
          홈으로
        </Link>
        {/* ⑤-5f-B — 사운드 mute 토글 */}
        <button
          type="button"
          onClick={() => {
            const next = !soundMuted;
            setMuted(next);
            setSoundMuted(next);
          }}
          aria-label={soundMuted ? '사운드 켜기' : '사운드 끄기'}
          className="flex size-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          {soundMuted ? (
            <VolumeX className="size-4" />
          ) : (
            <Volume2 className="size-4 text-text" />
          )}
        </button>
      </div>

      {/* 헤더 — 접힘 */}
      <header className="overflow-hidden rounded-xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => setHeaderOpen((v) => !v)}
          className="flex w-full items-start gap-3 p-4 text-left hover:bg-surface-2"
        >
          <div className="flex -space-x-1.5 shrink-0">
            {cast.slice(0, 4).map((m) => (
              <PersonaOrb
                key={m.id}
                persona={m}
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
              {cast.length}명 참여
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
              {cast.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-1 text-xs text-text/90"
                >
                  <PersonaOrb persona={m} size={16} glow="none" />
                  {m.name}
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
      {error && phase === 'error' && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-text">토론이 중단되었습니다</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{error}</p>
          </div>
        </div>
      )}

      {/* 피드 — revealedMessages 만 표시 (재생 진행 분) */}
      <DebateFeed
        messages={revealedMessages}
        cast={cast}
        chunks={chunks}
        activeSpeakerId={activeSpeakerId}
        thinkingMemberId={thinkingMemberId}
        onSelectMember={setSelectedMemberId}
        onDirect={actions.submitDirection}
        emptyHint={
          phase === 'idle'
            ? '"토론 시작"을 누르면 패널이 모입니다.'
            : phase === 'generating'
              ? '토론 준비중 — 패널이 첫 발언을 준비하고 있습니다.'
              : undefined
        }
      />

      {/* ⑤-1f-B 대기 시간 메모 — generating 중에만 노출 */}
      {phase === 'generating' && (
        <WaitingMemoArea onSubmit={actions.submitWaitingMemo} />
      )}

      {/* 갈림길 패널 */}
      {phase === 'steering' && currentChunk && (
        <SteeringPanel
          chunk={currentChunk}
          onChoose={actions.chooseTopic}
          onCustom={actions.submitCustomTopic}
          onConclude={actions.conclude}
        />
      )}

      {/* 재생 트랜스포트 (하단 sticky) */}
      <DebateControls
        phase={phase}
        isPaused={isPaused}
        speed={speed}
        progress={progress}
        onStart={actions.start}
        onPlay={actions.play}
        onPause={actions.pause}
        onSetSpeed={actions.setSpeed}
        onSkipTurn={actions.skipTurn}
      />

      {/* 트랙 ⑤-2b — 페르소나 발언 필터 드로어 */}
      {selectedMember && (
        <PersonaDetailDrawer
          member={selectedMember}
          messages={selectedMemberMessages}
          allMessages={revealedMessages}
          chunks={chunks}
          cast={cast}
          open={selectedMemberId !== null}
          onClose={() => setSelectedMemberId(null)}
        />
      )}
    </div>
  );
}
