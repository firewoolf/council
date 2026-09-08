import assert from 'node:assert/strict';
import test from 'node:test';

// gate.ts 는 모듈 로드 시점에 process.env.COUNCIL_GATE_SECRET 을 읽는다.
// 정적 import 보다 먼저 값을 세팅해야 하므로, 각 테스트 안에서 동적 import 한다
// (top-level await 미지원 트랜스폼 환경 대응 — 모듈은 최초 1회만 평가되어 캐시된다).
process.env.COUNCIL_GATE_SECRET = 'test-secret-for-gate-test';

async function loadGate() {
  // @ts-expect-error Node's type-stripping test runner requires the .ts extension.
  return import('./gate.ts');
}

test('mode 없는 구 티켓(insight-out 하위 호환)은 paid 로 검증된다', async () => {
  const { mintTicket, verifyTicket } = await loadGate();
  // insight-out 이 이미 발급 중인 구 포맷 — mode 인자 없이 호출.
  const legacyTicket = mintTicket('user-123');
  const payload = verifyTicket(legacyTicket);
  assert.ok(payload, '유효한 서명인데 검증 실패');
  assert.equal(payload?.mode, 'paid');
});

test('mode: demo 로 발급한 티켓은 demo 로 검증된다', async () => {
  const { mintTicket, verifyTicket } = await loadGate();
  const demoTicket = mintTicket('demo-hong', 'demo', 3600);
  const payload = verifyTicket(demoTicket);
  assert.ok(payload);
  assert.equal(payload?.mode, 'demo');
});

test('mode: paid 로 명시 발급한 티켓도 paid 로 검증된다', async () => {
  const { mintTicket, verifyTicket } = await loadGate();
  const paidTicket = mintTicket('user-456', 'paid');
  const payload = verifyTicket(paidTicket);
  assert.ok(payload);
  assert.equal(payload?.mode, 'paid');
});

test('만료된 티켓은 null', async () => {
  const { mintTicket, verifyTicket } = await loadGate();
  const expired = mintTicket('user-789', 'demo', -10);
  assert.equal(verifyTicket(expired), null);
});

test('위조된 서명은 null', async () => {
  const { mintTicket, verifyTicket } = await loadGate();
  const ticket = mintTicket('user-abc', 'demo', 3600);
  const tampered = ticket.slice(0, -1) + (ticket.at(-1) === 'a' ? 'b' : 'a');
  assert.equal(verifyTicket(tampered), null);
});
