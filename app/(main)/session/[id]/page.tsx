'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

import { BackgroundPicker } from '@/components/debate/BackgroundPicker';
import { ChatInputBar } from '@/components/debate/ChatInputBar';
import { DebateControls } from '@/components/debate/DebateControls';
import { DebateFeed } from '@/components/debate/DebateFeed';
import { DirectorConsole } from '@/components/debate/DirectorConsole';
import { PersonaDetailDrawer } from '@/components/debate/PersonaDetailDrawer';
import { StagePanel } from '@/components/debate/StagePanel';
import { SteeringSheet } from '@/components/debate/SteeringSheet';
import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { Button } from '@/components/ui/button';
import { useDebate } from '@/hooks/useDebate';
import { useHasMounted } from '@/hooks/useHasMounted';
import { isMuted, setMuted } from '@/lib/sound';
import { SIGNATURE_LINES } from '@/lib/prompts/personas';
import { DEFAULT_BACKGROUND_ID } from '@/lib/stage/backgrounds';
import { useSessionUiStore } from '@/store/session-ui';
import { useSessionsStore } from '@/store/sessions';
import { useStageStore } from '@/store/stage';
import { cn } from '@/lib/utils';

/**
 * 트랙 ⑤-1 — 청크 재생 + 갈림길 회의실.
 *
 * 레이아웃 (트랙 R-1.5 — 대화 중심 반응형):
 *   - 모바일(lg 미만): GPT식 챗 — 피드 + 하단 ChatInputBar/컨트롤 + 갈림길 시트
 *   - 웹(lg+): full-bleed 패널 그리드 — 무대 · 라이브 피드(자체 스크롤) · 디렉터 콘솔
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
    isStreaming,
    activeSpeakerId,
    thinkingMemberId,
    actions,
  } = useDebate(id);
  const [headerOpen, setHeaderOpen] = useState(false);
  // ⑤-5f-B — mute 토글 상태 (localStorage 에서 초기화, setMuted 와 동기화)
  const [soundMuted, setSoundMuted] = useState(() => isMuted());
  const sheet = useSessionUiStore((s) => s.sheet);
  const selectedMemberId = useSessionUiStore((s) => s.selectedMemberId);
  const openMemberDrawer = useSessionUiStore((s) => s.openMemberDrawer);
  const openBgPicker = useSessionUiStore((s) => s.openBgPicker);
  const openSteeringSheet = useSessionUiStore((s) => s.openSteeringSheet);
  const closeSheet = useSessionUiStore((s) => s.closeSheet);
  const backgroundId = useStageStore((s) => s.backgroundBySession[id]) ?? DEFAULT_BACKGROUND_ID;

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

  // ⑤-5h — 무대 화자/모드/대사 파생
  const stageSpeaker =
    activeSpeakerId ? (cast.find((c) => c.id === activeSpeakerId) ?? null)
    : thinkingMemberId ? (cast.find((c) => c.id === thinkingMemberId) ?? null)
    : null;
  const stageMode: 'speaking' | 'thinking' | 'idle' | 'concluded' =
    phase === 'concluded'
      ? 'concluded'
      : activeSpeakerId
        ? 'speaking'
        : thinkingMemberId
          ? 'thinking'
          : 'idle';
  const stageSig =
    stageMode === 'speaking' && stageSpeaker?.source === 'archetype' && stageSpeaker.archetypeId
      ? SIGNATURE_LINES[stageSpeaker.archetypeId] : undefined;

  /** 웹 패널 모드 — 중앙 피드 자체 스크롤 컨테이너. */
  const feedScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mounted && !session) {
      toast.error('세션을 찾을 수 없습니다.');
      router.replace('/');
    }
  }, [mounted, session, router]);

  useEffect(() => {
    if (error) toast.error(`토론 진행 중 오류: ${error}`);
  }, [error]);

  const previousPhaseRef = useRef<typeof phase | null>(null);
  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = phase;
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;

    if (phase === 'steering' && previousPhase !== 'steering' && isMobile) {
      openSteeringSheet();
    } else if (
      previousPhase === 'steering' &&
      phase !== 'steering' &&
      sheet === 'steeringSheet'
    ) {
      closeSheet();
    }
  }, [phase, sheet, openSteeringSheet, closeSheet]);

  if (!mounted || !session) {
    return <div className="min-h-[60vh]" aria-hidden />;
  }

  return (
    <div
      className="flex flex-col gap-4 pb-52 pt-2 lg:pb-0"
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

      {/* 웹 패널 (lg+) — 부모 max-w-2xl 를 탈출한 full-bleed 3/2 패널 그리드.
          무대(인물) · 라이브 피드(텍스트, 자체 스크롤) · 디렉터 콘솔(조향)을
          한 시야에 두어 "보면서 동시에 조향"한다. */}
      <div
        className={cn(
          'hidden lg:grid lg:gap-4',
          'lg:grid-cols-[1fr_340px] xl:grid-cols-[300px_1fr_340px]',
          'lg:ml-[calc(50%-50vw)] lg:w-screen lg:px-4 xl:px-6',
          'lg:sticky lg:top-2 lg:h-[calc(100dvh-1rem)]',
        )}
      >
        {/* 무대 패널 — xl 전용 (full) */}
        <aside className="hidden min-h-0 xl:block">
          <StagePanel
            variant="full"
            cast={cast}
            speaker={stageSpeaker}
            mode={stageMode}
            signatureLine={stageSig}
            backgroundId={backgroundId}
            onSelectMember={openMemberDrawer}
            onOpenBackground={openBgPicker}
          />
        </aside>

        {/* 라이브 피드 (중앙) — 자체 스크롤 컨테이너 */}
        <div className="flex min-h-0 flex-col gap-3">
          {/* 2패널(lg)에서만 컴팩트 스피커 밴드 */}
          <div className="xl:hidden">
            <StagePanel
              variant="compact"
              cast={cast}
              speaker={stageSpeaker}
              mode={stageMode}
              signatureLine={stageSig}
              backgroundId={backgroundId}
              onSelectMember={openMemberDrawer}
              onOpenBackground={openBgPicker}
            />
          </div>
          <div
            ref={feedScrollRef}
            className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-surface/30 p-4"
          >
            <DebateFeed
              messages={revealedMessages}
              cast={cast}
              chunks={chunks}
              phase={phase}
              activeSpeakerId={activeSpeakerId}
              thinkingMemberId={thinkingMemberId}
              speed={speed}
              onAdvance={actions.skipTurn}
              onSelectMember={openMemberDrawer}
              onDirect={actions.submitDirection}
              scrollContainerRef={feedScrollRef}
              emptyHint={
                phase === 'idle'
                  ? '토론 시작을 누르면 이곳에 대화가 이어집니다.'
                  : undefined
              }
            />
          </div>
        </div>

        {/* 디렉터 콘솔 (우측) */}
        <aside className="min-h-0">
          <DirectorConsole
            phase={phase}
            currentChunk={currentChunk}
            isPaused={isPaused}
            speed={speed}
            progress={progress}
            isStreaming={isStreaming}
            onChooseTopic={actions.chooseTopic}
            onCustomTopic={actions.submitCustomTopic}
            onConclude={actions.conclude}
            onSubmitSpeech={actions.submitSpeech}
            onStart={actions.start}
            onPlay={actions.play}
            onPause={actions.pause}
            onSetSpeed={actions.setSpeed}
            onSkipTurn={actions.skipTurn}
          />
        </aside>
      </div>

      {/* 모바일 챗 피드 (lg 미만) */}
      <div className="lg:hidden">
        <DebateFeed
          messages={revealedMessages}
          cast={cast}
          chunks={chunks}
          phase={phase}
          activeSpeakerId={activeSpeakerId}
          thinkingMemberId={thinkingMemberId}
          speed={speed}
          onAdvance={actions.skipTurn}
          onSelectMember={openMemberDrawer}
          onDirect={actions.submitDirection}
          emptyHint={
            phase === 'idle'
              ? '토론 시작을 누르면 이곳에 대화가 이어집니다.'
              : undefined
          }
        />
      </div>

      {/* 모바일 하단 고정 — 컨트롤 + 챗 입력바 */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          <DebateControls
            embedded
            phase={phase}
            isPaused={isPaused}
            speed={speed}
            progress={progress}
            isStreaming={isStreaming}
            onStart={actions.start}
            onPlay={actions.play}
            onPause={actions.pause}
            onSetSpeed={actions.setSpeed}
            onSkipTurn={actions.skipTurn}
          />
          <ChatInputBar
            phase={phase}
            onSubmitSpeech={actions.submitSpeech}
            onSubmitCustomTopic={actions.submitCustomTopic}
            onOpenDirections={openSteeringSheet}
          />
        </div>
      </div>

      {phase === 'steering' && currentChunk && (
        <SteeringSheet
          chunk={currentChunk}
          open={sheet === 'steeringSheet'}
          onClose={closeSheet}
          onChoose={actions.chooseTopic}
          onConclude={actions.conclude}
        />
      )}

      {/* ⑤-5h — 배경 선택 시트 */}
      <BackgroundPicker
        sessionId={id}
        currentId={backgroundId}
        open={sheet === 'bgPicker'}
        onClose={closeSheet}
      />

      {/* 트랙 ⑤-2b — 페르소나 발언 필터 드로어 */}
      {selectedMember && (
        <PersonaDetailDrawer
          member={selectedMember}
          messages={selectedMemberMessages}
          allMessages={revealedMessages}
          chunks={chunks}
          cast={cast}
          open={sheet === 'memberDrawer'}
          onClose={closeSheet}
        />
      )}
    </div>
  );
}
