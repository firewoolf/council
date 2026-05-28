#!/usr/bin/env node
/**
 * §5-0 — chunkSchema 구조화 출력 안정성 스모크 테스트.
 *
 * 워크오더 트랙 ⑤-1 §5-0 의 "착수 전 검증" 단계.
 * Groq · Gemini 각각에 청크 스키마로 generateObject 를 시험 호출 →
 * 중첩 배열(turns + nextTopics + isBlindSpot) 을 안정적으로 채우는지 확인.
 *
 * 사용:
 *   GROQ_API_KEY=gsk_... GEMINI_API_KEY=AIza... \
 *     node scripts/check-chunk-schema.mjs
 *
 * 한쪽 키만 있으면 그쪽만 검증한다.
 * 결과 — 각 공급사별로 5회 반복해서 성공/실패 카운트.
 *
 * 키 자체는 출력에 노출되지 않는다.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { generateObject } from 'ai';
import { z } from 'zod';

const TRIALS = 5;

const chunkTurnSchema = z.object({
  speakerName: z.string().describe('패널 명단의 이름과 정확히 일치'),
  message: z
    .string()
    .max(300)
    .describe('발언 본문 — 한국어 200자 이내. 원론·양비론 금지, 구체적인 한 방.'),
  replyToIndex: z
    .number()
    .int()
    .nullable()
    .describe('이 청크 안에서 앞선 turn 인덱스(0부터)에 반박할 때만. 새 논점이면 null'),
  isKeyPoint: z
    .boolean()
    .describe('이 청크에서 가장 날카로운 1~2개 라인이면 true, 아니면 false'),
});

const nextTopicSchema = z.object({
  label: z
    .string()
    .describe('다음에 파고들 소주제 — 짧은 제목(15자 내외). "✦ " 마커는 못 본 각도 후보에만.'),
  hook: z
    .string()
    .describe('왜 지금 이걸 파야 하는지 한 줄'),
  isBlindSpot: z
    .boolean()
    .describe('*못 본 각도* 후보면 true. 배열에 정확히 1개만 true.'),
});

const chunkSchema = z.object({
  turns: z.array(chunkTurnSchema).min(3).max(5),
  nextTopics: z.array(nextTopicSchema).min(2).max(4),
});

const SYSTEM = `당신은 COUNCIL의 토론 장면을 연출하는 작가입니다.
한 번의 호출로 전문가 패널 3명이 벌이는 3~5턴짜리 토론 미니 장면을 완성합니다.
패널 전원의 목소리를 당신이 씁니다 — 각자 자기 캐릭터에 충실하게.

[연출 원칙]
1. 진짜 충돌 — 뒤 턴은 앞 턴의 표현을 집어서 받아친다.
2. 한 방 — 발언은 200자 이내, 두세 문장.
3. 입장 견지 — 각 패널은 자기 입장을 장면 내내 지킨다.
4. 굴복 금지 — "맞습니다, 좋은 지적입니다" 같은 표현 금지.
5. 벙벙함 금지 — 구체적 주장·근거·반례 중 하나는 있어야.

[핵심 라인]
가장 날카로운 1~2개에만 isKeyPoint: true.

[다음 갈림길]
nextTopics 후보 중 정확히 1개는 isBlindSpot: true — 패널 발언에서 함의되었지만 명시되지 않은 결론.`;

const PROMPT = `[고민]
스타트업 CEO 가 유료 전환 시점을 고민 중이다. 무료 사용자 5000명, 한 달 운영비 부담 큼.

[패널]
- 잡스 (제품 비전가) — 입장: 지금 전환하면 사용자를 잃는다
- CEO (스타트업 운영자) — 입장: 한 달이라도 빨리 전환해야 데이터 쌓인다
- UI/UX (사용자 경험 전문가) — 입장: 가격이 아니라 가치 전달이 문제

[이번 장면의 소주제]
이 고민의 핵심 결정 그 자체 — 패널이 처음으로 정면 충돌하는 장면.

[작업]
위 소주제로 3~5턴짜리 토론 장면을 연출하고, 다음에 파고들 후보(nextTopics) 2~4개를 제안한다.
직전 턴에 반박하면 replyToIndex 에 그 인덱스를 넣는다. 새 논점이면 null.
가장 날카로운 1~2개 발언에 isKeyPoint: true.
nextTopics 중 정확히 1개는 isBlindSpot: true (✦ 마커 박제).`;

function validateChunk(chunk, name) {
  const errors = [];
  if (!chunk.turns || chunk.turns.length < 3 || chunk.turns.length > 5) {
    errors.push(`turns 길이 위반: ${chunk.turns?.length}`);
  }
  if (!chunk.nextTopics || chunk.nextTopics.length < 2 || chunk.nextTopics.length > 4) {
    errors.push(`nextTopics 길이 위반: ${chunk.nextTopics?.length}`);
  }
  const blindSpotCount = (chunk.nextTopics ?? []).filter((t) => t.isBlindSpot === true).length;
  if (blindSpotCount !== 1) {
    errors.push(`isBlindSpot true 개수: ${blindSpotCount} (정확히 1이어야 함)`);
  }
  const keyPointCount = (chunk.turns ?? []).filter((t) => t.isKeyPoint === true).length;
  if (keyPointCount < 1 || keyPointCount > 2) {
    errors.push(`isKeyPoint true 개수: ${keyPointCount} (1~2 권장)`);
  }
  // turns 의 replyToIndex 유효성
  for (let i = 0; i < (chunk.turns ?? []).length; i++) {
    const r = chunk.turns[i].replyToIndex;
    if (r !== null && (r < 0 || r >= i)) {
      errors.push(`turn ${i}.replyToIndex=${r} 이 자기 자신 이후 인덱스 (현재 i=${i})`);
    }
  }
  return errors;
}

async function runTrial(provider, name) {
  const start = Date.now();
  try {
    const { object } = await generateObject({
      model: provider,
      schema: chunkSchema,
      system: SYSTEM,
      prompt: PROMPT,
      temperature: 0.9,
      maxRetries: 1,
    });
    const elapsed = Date.now() - start;
    const errors = validateChunk(object, name);
    if (errors.length > 0) {
      return { ok: false, kind: 'semantic', elapsed, errors };
    }
    return { ok: true, elapsed, turns: object.turns.length, nextTopics: object.nextTopics.length };
  } catch (err) {
    const elapsed = Date.now() - start;
    return {
      ok: false,
      kind: 'schema-or-network',
      elapsed,
      errors: [err?.message ?? String(err)],
    };
  }
}

async function runProvider(name, factory) {
  console.log(`\n━━━ ${name} ━━━`);
  const results = [];
  for (let i = 0; i < TRIALS; i++) {
    process.stdout.write(`  trial ${i + 1}/${TRIALS}… `);
    const r = await runTrial(factory, name);
    results.push(r);
    if (r.ok) {
      console.log(`OK (${r.elapsed}ms, turns=${r.turns}, nextTopics=${r.nextTopics})`);
    } else {
      console.log(`FAIL (${r.kind}, ${r.elapsed}ms)`);
      for (const e of r.errors) console.log(`    · ${e}`);
    }
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n  → ${name}: ${passed}/${TRIALS} 통과`);
  return { name, passed, total: TRIALS, results };
}

async function main() {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!groqKey && !geminiKey) {
    console.log('❌ GROQ_API_KEY 또는 GEMINI_API_KEY 환경변수 없음.');
    console.log('   사용: GROQ_API_KEY=... GEMINI_API_KEY=... node scripts/check-chunk-schema.mjs');
    process.exit(1);
  }

  const summary = [];

  if (groqKey) {
    const groq = createGroq({ apiKey: groqKey })('llama-3.3-70b-versatile');
    summary.push(await runProvider('Groq (llama-3.3-70b-versatile)', groq));
  } else {
    console.log('\n⚠️  GROQ_API_KEY 없음 — Groq 검증 스킵');
  }

  if (geminiKey) {
    const gemini = createGoogleGenerativeAI({ apiKey: geminiKey })('gemini-2.5-flash-lite');
    summary.push(await runProvider('Gemini (gemini-2.5-flash-lite)', gemini));
  } else {
    console.log('\n⚠️  GEMINI_API_KEY 없음 — Gemini 검증 스킵');
  }

  console.log('\n\n━━━ 요약 ━━━');
  for (const s of summary) {
    const pct = Math.round((s.passed / s.total) * 100);
    console.log(`  ${s.name}: ${s.passed}/${s.total} (${pct}%)`);
  }
  console.log('\n결정 기준 (워크오더 §5-0):');
  console.log('  - 4/5 이상: 안정 — generateChunk 라우팅에 포함');
  console.log('  - 3/5 이하: 불안정 — generateChunk 는 Gemini 고정 권장\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
