'use client';

import Link from 'next/link';
import { ArrowLeft, RotateCcw } from 'lucide-react';

import { estimateCostUsd, USD_TO_KRW } from '@/lib/ai/pricing';
import { PROVIDERS, type AiProvider } from '@/lib/ai/providers';
import { useHasMounted } from '@/hooks/useHasMounted';
import {
  useUsageStore,
  type SessionUsage,
  type UsageKind,
} from '@/store/usage';

const KIND_ORDER: UsageKind[] = [
  'chunk', 'conclusion', 'clarify', 'panel', 'recommend', 'topics', 'mirror', 'ping',
];
const ESTIMATES = [
  ['청크 in/회', 5380, 'chunkIn'],
  ['청크 out/회', 900, 'chunkOut'],
  ['세션 in', 42700, 'sessionIn'],
  ['세션 out', 7550, 'sessionOut'],
  ['세션당 청크 수', 6, 'chunks'],
] as const;

export function UsageDashboard() {
  const mounted = useHasMounted();
  const byKind = useUsageStore((s) => s.byKind);
  const bySession = useUsageStore((s) => s.bySession);
  const calls = useUsageStore((s) => s.calls);
  const reset = useUsageStore((s) => s.reset);

  if (!mounted) return null;

  const sessions = Object.entries(bySession).sort(
    ([, a], [, b]) => b.startedAt - a.startedAt,
  );
  const sessionCount = sessions.length;
  const sum = sessions.reduce(
    (acc, [, session]) => ({ inTok: acc.inTok + session.inTok, outTok: acc.outTok + session.outTok }),
    { inTok: 0, outTok: 0 },
  );
  const sessionCosts = sessions.map(([, session]) => sessionCost(session));
  const avgCost = sessionCosts.every((cost) => cost !== null) && sessionCount > 0
    ? sessionCosts.reduce<number>((total, cost) => total + (cost ?? 0), 0) / sessionCount
    : null;
  const chunk = byKind.chunk;
  const globalProviders = (Object.keys(calls) as AiProvider[]).filter(
    (provider) => (calls[provider] ?? 0) > 0,
  );
  const actuals = {
    chunkIn: chunk?.n ? chunk.inTok / chunk.n : null,
    chunkOut: chunk?.n ? chunk.outTok / chunk.n : null,
    sessionIn: sessionCount ? sum.inTok / sessionCount : null,
    sessionOut: sessionCount ? sum.outTok / sessionCount : null,
    chunks: sessionCount
      ? sessions.reduce((n, [, session]) => n + (session.byKind.chunk?.n ?? 0), 0) / sessionCount
      : null,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="mb-3 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text">
            <ArrowLeft className="size-3.5" /> 대시보드
          </Link>
          <h1 className="text-2xl font-bold text-text">토큰 사용량</h1>
          <p className="mt-1 text-sm text-text-muted">브라우저에 저장된 실측값 · 원화는 1 USD ≈ 1,400원 근사치</p>
        </div>
        <button type="button" onClick={() => reset()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-text-muted hover:bg-surface-2 hover:text-text">
          <RotateCcw className="size-3.5" /> 측정값 초기화
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="세션당 평균 입력" value={sessionCount ? formatNumber(sum.inTok / sessionCount) : '—'} />
        <MetricCard label="세션당 평균 출력" value={sessionCount ? formatNumber(sum.outTok / sessionCount) : '—'} />
        <MetricCard label="세션당 평균 원가" value={<CostValue usd={avgCost} />} />
      </section>

      <TableSection title="추정 대 실측">
        <thead><tr><Th>지표</Th><Th>추정(2026-08-01)</Th><Th>실측</Th><Th>오차</Th></tr></thead>
        <tbody>{ESTIMATES.map(([label, estimate, key]) => {
          const actual = actuals[key];
          return <tr key={label}><Td>{label}</Td><Td>{formatNumber(estimate)}</Td><Td>{actual === null ? '—' : formatNumber(actual)}</Td><Td>{actual === null ? '—' : `${(((actual - estimate) / estimate) * 100).toFixed(1)}%`}</Td></tr>;
        })}</tbody>
      </TableSection>

      <TableSection title="kind별 누적">
        <thead><tr><Th>kind</Th><Th>호출 수</Th><Th>평균 in</Th><Th>평균 out</Th><Th>캐시 적중</Th><Th>누적 원가</Th></tr></thead>
        <tbody>{KIND_ORDER.map((kind) => {
          const bucket = byKind[kind];
          const cost = bucket && globalProviders.length === 1
            ? estimateCostUsd(globalProviders[0]!, bucket)
            : null;
          return <tr key={kind}><Td>{kind}</Td><Td>{bucket?.n ?? 0}</Td><Td>{bucket?.n ? formatNumber(bucket.inTok / bucket.n) : '—'}</Td><Td>{bucket?.n ? formatNumber(bucket.outTok / bucket.n) : '—'}</Td><Td>{formatNumber(bucket?.cachedTok ?? 0)}</Td><Td>{bucket ? <CostValue usd={cost} /> : '—'}</Td></tr>;
        })}</tbody>
      </TableSection>

      <TableSection title="세션별">
        <thead><tr><Th>startedAt</Th><Th>청크 수</Th><Th>in</Th><Th>out</Th><Th>원가</Th><Th>공급사</Th></tr></thead>
        <tbody>{sessions.length === 0 ? <tr><Td colSpan={6}>측정된 세션이 없습니다.</Td></tr> : sessions.map(([id, session]) => (
          <tr key={id}><Td>{new Date(session.startedAt).toLocaleString('ko-KR')}</Td><Td>{session.byKind.chunk?.n ?? 0}</Td><Td>{formatNumber(session.inTok)}</Td><Td>{formatNumber(session.outTok)}</Td><Td><CostValue usd={sessionCost(session)} /></Td><Td>{providerNames(session)}</Td></tr>
        ))}</tbody>
      </TableSection>
      <p className="text-xs text-text-muted">단가 또는 공급사별 토큰 분해가 없는 집계는 <span className="rounded bg-surface-2 px-1.5 py-0.5">단가 미확인</span>으로 표시합니다.</p>
    </div>
  );
}

function sessionCost(session: SessionUsage): number | null {
  const providers = (Object.keys(session.providers) as AiProvider[]).filter((p) => (session.providers[p] ?? 0) > 0);
  return providers.length === 1 ? estimateCostUsd(providers[0]!, session) : null;
}

function providerNames(session: SessionUsage): string {
  return (Object.keys(session.providers) as AiProvider[])
    .filter((p) => (session.providers[p] ?? 0) > 0)
    .map((p) => `${PROVIDERS[p].displayName} ${session.providers[p]}회`)
    .join(', ') || '—';
}

function formatNumber(value: number): string { return Math.round(value).toLocaleString('ko-KR'); }
function CostValue({ usd }: { usd: number | null }) { return usd === null ? <span className="rounded bg-accent/10 px-1.5 py-0.5 text-accent">단가 미확인</span> : <>약 {Math.round(usd * USD_TO_KRW).toLocaleString('ko-KR')}원</>; }
function MetricCard({ label, value }: { label: string; value: React.ReactNode }) { return <div className="rounded-xl border border-border bg-surface p-5"><p className="text-xs text-text-muted">{label}</p><p className="mt-2 font-mono text-xl font-semibold text-text">{value}</p></div>; }
function TableSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="space-y-3"><h2 className="text-lg font-semibold text-text">{title}</h2><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[680px] text-left text-sm">{children}</table></div></section>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="border-b border-border bg-surface-2 px-4 py-3 text-xs font-medium text-text-muted">{children}</th>; }
function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) { return <td colSpan={colSpan} className="border-b border-border/70 px-4 py-3 font-mono text-xs text-text/80 last:border-b-0">{children}</td>; }
