import type { Conclusion } from '@/lib/prompts/orchestrator';
import type { ChunkMeta } from '@/types/debate';

export interface MirrorStats {
  sessionCount: number;
  blindSpotOffered: number;
  blindSpotTaken: number;
  avoidanceRate: number | null;
  recurringOpenQuestions: string[];
}

export const MIRROR_AVOIDANCE_THRESHOLD = 0.5;

function normalizeQuestion(question: string): string {
  return question
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[\p{P}\p{S}\s]+/gu, '');
}

export function computeMirrorStats(
  chunksBySession: Record<string, ChunkMeta[]>,
  conclusionsBySession: Record<string, Conclusion>,
): MirrorStats {
  let blindSpotOffered = 0;
  let blindSpotTaken = 0;

  for (const chunks of Object.values(chunksBySession)) {
    for (const chunk of chunks ?? []) {
      for (const topic of chunk.nextTopics) {
        if (!topic.isBlindSpot) continue;
        blindSpotOffered++;
        if (chunk.chosenNextLabel === topic.label) blindSpotTaken++;
      }
    }
  }

  const questionCounts = new Map<
    string,
    { count: number; original: string }
  >();
  for (const conclusion of Object.values(conclusionsBySession)) {
    for (const rawQuestion of conclusion?.openQuestions ?? []) {
      const original = rawQuestion.trim();
      const normalized = normalizeQuestion(original);
      if (!normalized) continue;
      const current = questionCounts.get(normalized);
      questionCounts.set(normalized, {
        count: (current?.count ?? 0) + 1,
        original: current?.original ?? original,
      });
    }
  }

  return {
    sessionCount: Object.keys(conclusionsBySession).length,
    blindSpotOffered,
    blindSpotTaken,
    avoidanceRate:
      blindSpotOffered > 0
        ? 1 - blindSpotTaken / blindSpotOffered
        : null,
    recurringOpenQuestions: [...questionCounts.values()]
      .filter(({ count }) => count >= 2)
      .map(({ original }) => original),
  };
}

export function buildMirrorContext(
  stats: MirrorStats,
  observedPatterns: readonly string[],
): string | undefined {
  if (
    stats.sessionCount < 2 ||
    stats.avoidanceRate === null ||
    stats.avoidanceRate < MIRROR_AVOIDANCE_THRESHOLD
  ) {
    return undefined;
  }

  const avoided = stats.blindSpotOffered - stats.blindSpotTaken;
  const pattern = observedPatterns.find((item) => item.trim())?.trim();
  const base =
    `지난 ${stats.sessionCount}세션에서 패널이 띄운 '못 본 각도(✦)'를 ` +
    `${avoided}번 피했습니다.`;
  return pattern ? `${base} 반복 맹점: ${pattern}` : base;
}

export function hasRecurringMirrorSignal(
  stats: MirrorStats,
  chunksBySession: Record<string, ChunkMeta[]>,
): boolean {
  const sessionsWithAvoidance = Object.values(chunksBySession).filter((chunks) =>
    chunks.some((chunk) =>
      chunk.nextTopics.some(
        (topic) =>
          topic.isBlindSpot && chunk.chosenNextLabel !== topic.label,
      ),
    ),
  ).length;
  return sessionsWithAvoidance >= 2 || stats.recurringOpenQuestions.length > 0;
}
