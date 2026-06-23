'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  HelpCircle,
  ListChecks,
  MessageSquare,
  Pin,
  TriangleAlert,
  Users,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { Button } from '@/components/ui/button';
import { useHasMounted } from '@/hooks/useHasMounted';
import { playSound } from '@/lib/sound';
import { useSessionsStore } from '@/store/sessions';
import type { Conclusion, DividedPoint } from '@/lib/prompts/orchestrator';
import type { ChunkMeta, Message } from '@/types/debate';
import type { CastMember } from '@/types/persona';

const EMPTY: never[] = [];

/**
 * 결론 화면 — 트랙 ② 결정 지도형 결론.
 *
 * v1/v2 분기:
 *   conclusion.consensus !== undefined → v2 (결정 지도 3카드)
 *   그 외                              → v1 (옛 4섹션 — LegacyConclusionView)
 *
 * 옛 세션 호환 — v1 conclusion 은 LegacyConclusionView 가 그대로 렌더.
 */
export default function SessionSummaryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const mounted = useHasMounted();

  const session = useSessionsStore((s) => s.sessions[id]);
  const conclusion = useSessionsStore((s) => s.conclusions[id]);
  const cast     = useSessionsStore((s) => s.sessionCast?.[id])   ?? EMPTY;
  const messages = useSessionsStore((s) => s.messages[id])        ?? EMPTY;
  const pins     = useSessionsStore((s) => s.pins?.[id])          ?? EMPTY;
  const chunks   = useSessionsStore((s) => s.sessionChunks?.[id]) ?? EMPTY;

  const castMap = useMemo(
    () => new Map(cast.map((c) => [c.id, c])),
    [cast],
  );
  const messageMap = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages],
  );
  const pinnedMessageIds = useMemo(
    () => new Set(pins.map((p) => p.messageId)),
    [pins],
  );

  useEffect(() => {
    if (!mounted) return;
    if (!session) {
      toast.error('세션을 찾을 수 없습니다.');
      router.replace('/');
      return;
    }
    if (!conclusion) {
      toast.info('아직 결론이 정리되지 않았습니다.');
      router.replace(`/session/${id}`);
    }
  }, [mounted, session, conclusion, id, router]);

  // ⑤-5f-B — summary 화면 진입 fanfare (마운트 1회)
  useEffect(() => {
    if (!mounted || !conclusion) return;
    playSound('conclude');
  }, [mounted, conclusion]);

  if (!mounted || !session || !conclusion) {
    return <div className="min-h-[60vh]" aria-hidden />;
  }

  const isV2 = conclusion.consensus !== undefined;

  return (
    <div className="flex flex-col gap-8 pt-2">
      <div className="space-y-3">
        <Link
          href={`/session/${id}`}
          className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text"
        >
          <ArrowLeft className="size-3.5" />
          회의실로
        </Link>
        <p className="font-mono text-[11px] uppercase tracking-wider text-primary">
          {isV2 ? '결정 지도' : '최종 결론'}
        </p>
        <h1 className="font-sans text-3xl font-black leading-tight tracking-tight text-text sm:text-4xl">
          {session.title}
        </h1>
      </div>

      <RouteView chunks={chunks} concernTitle={session.title} />

      {isV2 ? (
        <DecisionMapView
          conclusion={conclusion}
          castMap={castMap}
          messageMap={messageMap}
          pinnedMessageIds={pinnedMessageIds}
        />
      ) : (
        <LegacyConclusionView conclusion={conclusion} castMap={castMap} />
      )}

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between pt-4">
        <Button asChild variant="outline">
          <Link href={`/session/${id}`}>
            <MessageSquare className="size-4" />
            토론 다시 보기
          </Link>
        </Button>
        <Button asChild>
          <Link href="/session/new">새 회의 시작</Link>
        </Button>
      </div>
    </div>
  );
}

// ─── v2: 결정 지도 3카드 ──────────────────────────────────────────────────────

interface DecisionMapViewProps {
  conclusion: Conclusion;
  castMap: Map<string, CastMember>;
  messageMap: Map<string, Message>;
  pinnedMessageIds: Set<string>;
}

/**
 * 트랙 ② v2 결정 지도 UI.
 *
 * 시각 가중치: divided (★) >> openQuestions > consensus
 *   divided:        border-2 border-accent/40, 큰 폰트, accent 톤
 *   openQuestions:  border primary/30, 중간 폰트
 *   consensus:      border-dashed, 작은 폰트, muted 톤
 */
function DecisionMapView({ conclusion, castMap, messageMap, pinnedMessageIds }: DecisionMapViewProps) {
  const consensus = conclusion.consensus ?? [];
  const divided = conclusion.divided ?? [];
  const openQuestions = conclusion.openQuestions ?? [];

  return (
    <div className="flex flex-col gap-8">
      {/* ── 합의된 것 ── 가벼운 톤 ────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
            합의된 것
          </h2>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] text-primary">
            {consensus.length}개
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {consensus.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3"
            >
              <span className="mt-0.5 text-primary">✓</span>
              <p className="text-sm leading-relaxed text-text/90">{item}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 끝내 갈린 것 ── ★ 가장 큰 시각 가중치 ─────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-accent" />
          <h2 className="text-base font-bold uppercase tracking-wider text-accent">
            끝내 갈린 것
          </h2>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] text-accent">
            {divided.length}개 분기
          </span>
        </div>
        <p className="text-xs text-text-muted">
          패널이 마지막까지 합의하지 못한 지점 — 당신이 직접 결정해야 할 재료.
        </p>
        <div className="flex flex-col gap-4">
          {divided.map((point, i) => (
            <DividedCard
              key={i}
              point={point}
              castMap={castMap}
              messageMap={messageMap}
              pinnedMessageIds={pinnedMessageIds}
            />
          ))}
        </div>
      </section>

      {/* ── 당신이 답해야 할 질문 ── 중간 톤 ────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-5 text-text" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            당신이 답해야 할 질문
          </h2>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-muted">
            {openQuestions.length}개
          </span>
        </div>
        <p className="text-xs text-text-muted">
          답에 따라 결론이 바뀌는 분기 조건 — 이 고민에만 들어맞는 질문들.
        </p>
        <ol className="flex flex-col gap-2">
          {openQuestions.map((q, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-xs font-bold text-text-muted">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-text">{q}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

interface DividedCardProps {
  point: DividedPoint;
  castMap: Map<string, CastMember>;
  messageMap: Map<string, Message>;
  pinnedMessageIds: Set<string>;
}

/**
 * 갈림 지점 카드 — 부록 B.2 레이아웃 그대로.
 * v2.1: 각 입장 하단에 evidenceMessageIds 근거 칩 렌더. 핀된 발언은 핀 아이콘 표시.
 */
function DividedCard({ point, castMap, messageMap, pinnedMessageIds }: DividedCardProps) {
  return (
    <section className="rounded-2xl border-2 border-accent/40 bg-accent/5 p-5">
      <h3 className="text-base font-bold text-text">{point.topic}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {point.positions.map((pos, j) => {
          const evidenceIds = pos.evidenceMessageIds ?? [];
          const evidenceMsgs = evidenceIds
            .map((eid) => messageMap.get(eid))
            .filter((m): m is Message => m !== undefined && m.speakerId !== null);

          return (
            <div
              key={j}
              className="rounded-xl border border-border bg-surface p-3"
            >
              <p className="text-sm font-semibold text-text">{pos.side}</p>
              {/* 멤버 칩 */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pos.memberIds.map((memberId) => {
                  const m = castMap.get(memberId);
                  if (!m) return null;
                  return (
                    <span
                      key={memberId}
                      className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text/90"
                      style={{ borderLeft: `3px solid ${m.colorTo}` }}
                    >
                      <PersonaOrb persona={m} size={14} glow="none" />
                      {m.name}
                    </span>
                  );
                })}
                {pos.memberIds.length === 0 && (
                  <span className="text-[10px] text-text-muted">멤버 미지정</span>
                )}
              </div>
              {/* I-3 v2.1 — 근거 칩 */}
              {evidenceMsgs.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted/70">
                    근거
                  </p>
                  {evidenceMsgs.map((m) => {
                    const speaker = m.speakerId ? castMap.get(m.speakerId) : null;
                    const isPinned = pinnedMessageIds.has(m.id);
                    const preview =
                      m.content.length > 40
                        ? `${m.content.slice(0, 38)}…`
                        : m.content;
                    return (
                      <div
                        key={m.id}
                        className="flex items-start gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2 py-1.5"
                      >
                        {speaker && (
                          <PersonaOrb persona={speaker} size={16} glow="none" className="mt-0.5 shrink-0" />
                        )}
                        <p className="min-w-0 flex-1 text-[11px] leading-snug text-text/80">
                          {preview}
                        </p>
                        {isPinned && (
                          <Pin className="size-3 shrink-0 text-accent" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── R-3': 항로 뷰 ────────────────────────────────────────────────────────────

function topicLabel(topic: string): string {
  if (topic === '_first') return '오프닝';
  return topic.length > 24 ? `${topic.slice(0, 22)}…` : topic;
}

interface RouteViewProps {
  chunks: readonly ChunkMeta[];
  concernTitle: string;
}

function RouteView({ chunks, concernTitle }: RouteViewProps) {
  if (chunks.length === 0) return null;

  const sorted = [...chunks].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
  const last = sorted[sorted.length - 1];
  const lastHasChoice = last?.chosenNextLabel !== undefined;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch className="size-5 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
          내가 항해한 길
        </h2>
      </div>
      <p className="text-xs text-text-muted">이번 회의에서 당신이 고른 갈림길들.</p>

      <div className="flex flex-col">
        {/* 고민 루트 */}
        <div className="flex items-center gap-2.5">
          <div className="flex w-5 shrink-0 justify-center">
            <div className="size-2.5 rounded-full bg-text-muted/40" />
          </div>
          <span className="text-xs text-text-muted">{concernTitle}</span>
        </div>

        {sorted.map((chunk, i) => {
          const isLast = i === sorted.length - 1;
          const chosen = chunk.chosenNextLabel;
          const isDirectInput =
            chosen !== undefined &&
            !chunk.nextTopics.some((t) => t.label === chosen);

          return (
            <div key={chunk.id}>
              {/* 연결선 */}
              <div className="flex">
                <div className="flex w-5 justify-center py-1">
                  <div className="w-px flex-1 bg-border" />
                </div>
              </div>

              {/* 장면 노드 */}
              <div className="flex items-start gap-2.5">
                <div className="flex w-5 shrink-0 flex-col items-center pt-0.5">
                  <div className="size-2.5 rounded-full bg-primary/70 ring-2 ring-primary/20" />
                </div>
                <div className="flex-1 pb-0.5">
                  <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {topicLabel(chunk.topic)}
                  </span>

                  {/* 갈림길 후보 목록 */}
                  {chunk.nextTopics.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1 pl-2 border-l border-border/60 ml-1">
                      {chunk.nextTopics.map((t, j) => {
                        const isChosen = t.label === chosen;
                        const isBlindSpot = t.isBlindSpot;

                        if (isChosen) {
                          return (
                            <li key={j} className="flex items-start gap-1.5">
                              <span className="mt-0.5 shrink-0 text-xs text-primary">▶</span>
                              <div>
                                <span className="text-sm font-semibold text-primary">
                                  {isBlindSpot && (
                                    <span className="mr-1 text-accent">✦</span>
                                  )}
                                  {t.label}
                                </span>
                                {isBlindSpot && (
                                  <span className="ml-1.5 text-[11px] text-accent">
                                    못 본 각도를 택함
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        }

                        // 안 고른 후보
                        return (
                          <li key={j} className="flex items-start gap-1.5 text-text-muted/50">
                            <span className="mt-0.5 shrink-0 text-xs">─</span>
                            <div>
                              {isBlindSpot ? (
                                <>
                                  <span className="text-xs">
                                    <span className="mr-1 text-accent/40">✦</span>
                                    안 가본 각도: {t.label}
                                  </span>
                                  <p className="mt-0.5 text-[11px] text-text-muted/40 italic">
                                    {t.hook}
                                  </p>
                                </>
                              ) : (
                                <span className="text-xs">안 가본 길: {t.label}</span>
                              )}
                            </div>
                          </li>
                        );
                      })}

                      {/* 직접 입력 선택 */}
                      {isDirectInput && chosen && (
                        <li className="flex items-start gap-1.5">
                          <span className="mt-0.5 shrink-0 text-xs text-primary">▶</span>
                          <div>
                            <span className="text-sm font-semibold text-primary">{chosen}</span>
                            <span className="ml-1.5 text-[11px] text-text-muted">직접 입력한 길</span>
                          </div>
                        </li>
                      )}
                    </ul>
                  )}

                  {/* 마지막 청크 + 선택 없음 → 결론 인라인 마킹 */}
                  {isLast && !chosen && (
                    <p className="mt-1.5 text-[11px] italic text-text-muted/70">
                      → 여기서 결론
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* 마지막 청크가 선택까지 있으면 결론 마감 노드 */}
        {lastHasChoice && (
          <>
            <div className="flex">
              <div className="flex w-5 justify-center py-1">
                <div className="w-px flex-1 bg-border" />
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex w-5 shrink-0 justify-center">
                <div className="size-2.5 rounded-full bg-accent/60 ring-2 ring-accent/20" />
              </div>
              <span className="text-xs font-medium text-text-muted">결론</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ─── v1 레거시: 옛 4섹션 UI ──────────────────────────────────────────────────

interface LegacyConclusionViewProps {
  conclusion: Conclusion;
  castMap: Map<string, CastMember>;
}

/**
 * v1 결론 4섹션 UI — 옛 세션 호환. 코드 그대로 유지.
 * 새 결론은 DecisionMapView 로만 생성됨.
 */
function LegacyConclusionView({ conclusion, castMap }: LegacyConclusionViewProps) {
  const positionEntries = useMemo(() => {
    const arr = conclusion.personaPositions ?? [];
    return arr
      .map((entry) => {
        const member = castMap.get(entry.personaId);
        return member ? { member, position: entry.position } : null;
      })
      .filter((e): e is { member: CastMember; position: string } => e !== null);
  }, [conclusion, castMap]);

  return (
    <div className="flex flex-col gap-8">
      {/* 1. 핵심 결론 */}
      <section className="rounded-xl border border-primary/40 bg-primary/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="size-5 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
            핵심 결론
          </h2>
        </div>
        <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-text">
          {conclusion.keyConclusion}
        </p>
      </section>

      {/* 2. 주요 리스크 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            주요 리스크
          </h2>
        </div>
        <ol className="flex flex-col gap-2">
          {(conclusion.risks ?? []).map((risk, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/20 font-mono text-xs font-bold text-accent">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-text">{risk}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. 페르소나별 최종 입장 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-text" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            페르소나별 입장
          </h2>
        </div>
        <ul className="flex flex-col gap-2">
          {positionEntries.map(({ member, position }) => (
            <li
              key={member.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4"
              style={{ borderLeftWidth: 4, borderLeftColor: member.colorTo }}
            >
              <PersonaOrb persona={member} size={36} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">{member.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-text/90">
                  {position}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. 추천 액션 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="size-5 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            추천 액션
          </h2>
        </div>
        <ol className="flex flex-col gap-2">
          {(conclusion.recommendedActions ?? []).map((action, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-primary/30 bg-surface p-4"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-xs font-bold text-primary">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-text">{action}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
