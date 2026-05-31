'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  ListChecks,
  MessageSquare,
  TriangleAlert,
  Users,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { Button } from '@/components/ui/button';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useSessionsStore } from '@/store/sessions';
import type { Conclusion, DividedPoint } from '@/lib/prompts/orchestrator';
import type { CastMember } from '@/types/persona';

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
  const cast = useSessionsStore((s) => s.sessionCast?.[id] ?? []);

  const castMap = useMemo(
    () => new Map(cast.map((c) => [c.id, c])),
    [cast],
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

      {isV2 ? (
        <DecisionMapView conclusion={conclusion} castMap={castMap} />
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
}

/**
 * 트랙 ② v2 결정 지도 UI.
 *
 * 시각 가중치: divided (★) >> openQuestions > consensus
 *   divided:        border-2 border-accent/40, 큰 폰트, accent 톤
 *   openQuestions:  border primary/30, 중간 폰트
 *   consensus:      border-dashed, 작은 폰트, muted 톤
 */
function DecisionMapView({ conclusion, castMap }: DecisionMapViewProps) {
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
            <DividedCard key={i} point={point} castMap={castMap} />
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
}

/**
 * 갈림 지점 카드 — 부록 B.2 레이아웃 그대로.
 * 각 입장을 그리드 2열(데스크탑) / 세로 적재(모바일) 로 표시.
 * 입장마다 어느 멤버가 그쪽 편인지 PersonaOrb + 이름 칩.
 */
function DividedCard({ point, castMap }: DividedCardProps) {
  return (
    <section className="rounded-2xl border-2 border-accent/40 bg-accent/5 p-5">
      <h3 className="text-base font-bold text-text">{point.topic}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {point.positions.map((pos, j) => (
          <div
            key={j}
            className="rounded-xl border border-border bg-surface p-3"
          >
            <p className="text-sm font-semibold text-text">{pos.side}</p>
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
          </div>
        ))}
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
