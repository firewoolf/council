import assert from 'node:assert/strict';
import test from 'node:test';

import type { AiErrorKind } from './errors';
// @ts-expect-error Node's type-stripping test runner requires the .ts extension.
import { classifyAiError } from './errors.ts';

const CASES: Array<[message: string, expected: AiErrorKind]> = [
  ['This model is currently experiencing high demand.', 'overloaded'],
  ['503 Service Unavailable', 'overloaded'],
  ['Rate limit exceeded', 'quota'],
  ['429 Too Many Requests', 'quota'],
  ['Invalid API key provided', 'invalid_key'],
  ['invalid JSON response from model', 'unknown'],
  ['Daily limit reached', 'quota'],
  ['Resource has been exhausted (e.g. check quota)', 'quota'],
];

test('classifyAiError kind 분류', () => {
  for (const [message, expected] of CASES) {
    const err = classifyAiError('gemini', new Error(message));
    assert.equal(
      err.kind,
      expected,
      `"${message}" → expected ${expected}, got ${err.kind}`,
    );
  }
});

test('classifyAiError 숫자 부분 매치 방지 — 토큰 수가 상태 코드로 오분류되지 않는다', () => {
  const err = classifyAiError(
    'gemini',
    new Error(
      "This model's maximum context length is 8192 tokens, however your messages resulted in 8503 tokens.",
    ),
  );
  assert.notEqual(err.kind, 'overloaded');
});
