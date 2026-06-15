import assert from 'node:assert/strict';
import test from 'node:test';

import type { Conclusion } from '@/lib/prompts/orchestrator';
import type { ChunkMeta } from '@/types/debate';
// @ts-expect-error Node's type-stripping test runner requires the .ts extension.
import { buildMirrorContext, computeMirrorStats, hasRecurringMirrorSignal } from './stats.ts';
// @ts-expect-error Node's type-stripping test runner requires the .ts extension.
import { buildClarifyPrompt } from '../prompts/concern-shaping.ts';

function chunk(
  id: string,
  isBlindSpot: boolean,
  chosenNextLabel?: string,
): ChunkMeta {
  return {
    id,
    sessionId: 'session',
    topic: 'topic',
    nextTopics: [
      { label: '일반 경로', hook: 'hook', isBlindSpot: false },
      { label: '✦ 못 본 각도', hook: 'hook', isBlindSpot },
    ],
    chosenNextLabel,
    createdAt: '2026-06-15T00:00:00.000Z',
  };
}

test('returns null avoidance when no blind spot was offered', () => {
  const stats = computeMirrorStats(
    { a: [chunk('a', false)] },
    { a: { openQuestions: ['질문 하나'] } },
  );
  assert.equal(stats.blindSpotOffered, 0);
  assert.equal(stats.blindSpotTaken, 0);
  assert.equal(stats.avoidanceRate, null);
});

test('counts all offered and taken blind spots', () => {
  const stats = computeMirrorStats(
    {
      a: [chunk('a', true, '✦ 못 본 각도')],
      b: [chunk('b', true, '✦ 못 본 각도')],
    },
    { a: {}, b: {} },
  );
  assert.equal(stats.blindSpotOffered, 2);
  assert.equal(stats.blindSpotTaken, 2);
  assert.equal(stats.avoidanceRate, 0);
  assert.equal(buildMirrorContext(stats, []), undefined);
});

test('reports full avoidance and normalized recurring questions', () => {
  const conclusions: Record<string, Conclusion> = {
    a: { openQuestions: ['검증은 언제 합니까?'] },
    b: { openQuestions: ['검증은 언제 합니까!'] },
  };
  const stats = computeMirrorStats(
    {
      a: [chunk('a', true, '일반 경로')],
      b: [chunk('b', true)],
    },
    conclusions,
  );
  assert.equal(stats.avoidanceRate, 1);
  assert.deepEqual(stats.recurringOpenQuestions, ['검증은 언제 합니까?']);
  assert.equal(
    buildMirrorContext(stats, ['검증을 반복적으로 건너뜀']),
    "지난 2세션에서 패널이 띄운 '못 본 각도(✦)'를 2번 피했습니다. 반복 맹점: 검증을 반복적으로 건너뜀",
  );
});

test('keeps the clarify prompt unchanged when mirror is undefined', () => {
  const concern = '유료 전환을 할지 고민';
  assert.equal(
    buildClarifyPrompt(concern),
    buildClarifyPrompt(concern, undefined),
  );
  assert.doesNotMatch(buildClarifyPrompt(concern), /\[거울 —/);
  assert.match(
    buildClarifyPrompt(concern, '지난 2세션에서 2번 피했습니다.'),
    /\[거울 — 이 사람의 누적 패턴\]/,
  );
});

test('requires avoidance across sessions for the semantic merge signal', () => {
  const oneSessionChunks = {
    a: [
      chunk('a-1', true, '일반 경로'),
      chunk('a-2', true, '일반 경로'),
    ],
  };
  const oneSessionStats = computeMirrorStats(oneSessionChunks, {
    a: {},
    b: {},
    c: {},
  });
  assert.equal(
    hasRecurringMirrorSignal(oneSessionStats, oneSessionChunks),
    false,
  );

  const twoSessionChunks = {
    ...oneSessionChunks,
    b: [chunk('b-1', true, '일반 경로')],
  };
  const twoSessionStats = computeMirrorStats(twoSessionChunks, {
    a: {},
    b: {},
    c: {},
  });
  assert.equal(
    hasRecurringMirrorSignal(twoSessionStats, twoSessionChunks),
    true,
  );
});
