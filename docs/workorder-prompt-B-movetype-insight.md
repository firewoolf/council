# 작업 의뢰서 — P-B′: moveType (인사이트 재프레임)

> 작성: Fable (재프레임 + 프롬프트 본문 박제). 담당: Sonnet(스키마·배관·프롬프트 주입) + Opus(streamChunk 확정 가드 1줄). 검수: Opus PR + 운영자.
> 선행: R-2 스트리밍 출하됨(확정 가드 존재), I-3 결정 지도(buildConclusionPrompt) 출하됨.
> 갈음 대상: `meeting-2026-06-10-game-loop-prompts.md` §2(P-B moveType, *보여주기* 버전). 콘텐츠 피벗으로 동결됐던 것을 **인사이트 정렬로 되살림**.

---

## 0. 재프레임 한 줄

**moveType은 무대 연출이 아니라 결정 지도의 입력이다.** 각 턴의 수(手)가 결론의 세 버킷에 그대로 매핑된다:

```
counter · concede  ──▶ divided        (끝내 갈린 것 — 정면 충돌 지점)
probe              ──▶ openQuestions   (사용자에게 되돌린 질문)
strike (도전 안 받음) ──▶ consensus 후보  (반박 없이 선 주장)
escalate           ──▶ divided 입장의 memberIds 가중 (같은 편 보강)
```

구 P-B는 moveType을 *반격 펄스·크리티컬 발광·질문 비네트*(보여주기)에 썼다. 그건 동결 유지. **재프레임은 같은 데이터를 결론 정밀도에 쓴다** — "충돌은 데이터다"(원칙 4)를 "충돌 데이터가 결정 지도를 만든다"로 격상.

## 1. 왜 지금 값이 있나 — 기존 신호의 한계

`chunkTurnSchema`(client.ts:146)에 이미 `replyToIndex`(반박 대상)·`isKeyPoint`(크리티컬)가 있다. 그러나:
- `replyToIndex`는 "앞 턴에 응답함"만 안다 — 그게 **반격(counter)인지, 부분인정(concede)인지, 같은편 보강(escalate)인지** 구분 못 한다. 이 구분이 divided의 질을 가른다(concede는 미묘한 분기, escalate는 입장 지지도).
- `probe`(사용자/패널에게 되돌린 날카로운 질문)는 현재 분류가 없다 — 그런데 그게 정확히 `openQuestions`의 씨앗이다.

→ moveType은 토론 턴을 **결론 구조에 직접 사상(寫像)하는 다리**다. 결론이 토론에서 빌드된다.

## 2. 작업 범위

### §A. 스키마 — `lib/ai/client.ts` chunkTurnSchema (Sonnet)

`chunkTurnSchema`(client.ts:146)에 필드 추가:

```ts
moveType: z.enum(['strike', 'counter', 'concede', 'escalate', 'probe'])
  .describe(
    'strike=새 논점 선공 / counter=앞 턴 반박(replyToIndex 필수) / ' +
    'concede=부분 인정 후 재공격(replyToIndex 필수) / escalate=같은 편 보강(replyToIndex 필수) / ' +
    'probe=사용자나 패널에게 되돌리는 날카로운 질문'
  ),
```

- `ChunkTurn` 타입·`Message`에 `moveType` 전파(types/debate.ts). 옵셔널 전파로 옛 청크 회귀 0(`moveType?`).
- maxTokens 소폭 상향(턴당 토큰 몇 개) — 재산정.

### §B. sanitize 보정 — `lib/ai/client.ts` sanitizeChunk (Sonnet) / 확정 가드 (Opus)

- `sanitizeChunk`(client.ts:243 인근): **counter·concede·escalate인데 replyToIndex가 null → strike로 강등**(무료 모델 오분류 방어, 기존 P-B 계획 계승). probe·strike는 replyToIndex 무관.
- streamChunk 확정 가드(R-2 부록 A, client.ts normalizeTurn): 가드는 `speakerName·message`만 보므로 **moveType 누락 시 'strike' 기본값**만 채우면 됨(가드 로직 무변, 필드 1개 디폴트). team note "P-B에서 가드에 필드 1개 추가" 그대로.

### §C. 프롬프트 — 청크 선언 + 결론 빌드 ★Fable 박제 / Sonnet 주입

**C-1. buildChunkPrompt**(orchestrator.ts:119): 매 턴 moveType 선언 강제 + 장면 비트와 연결. 작은 모델엔 자연어 규칙보다 스키마 강제가 잘 먹힌다. 박제 텍스트:

```
[수(手) 선언 — moveType]
모든 턴은 moveType 을 단다. 이 장면이 '치고받기'가 되려면 strike 만 나열하지 말 것:
- 입장이 갈리면 한 명이 counter(앞 발언의 *구체적 표현*을 집어 반박)로 받아쳐라.
- 일부 인정 후 다시 가르려면 concede.
- 같은 편을 더 미는 escalate.
- 사용자/패널에게 날카롭게 되묻는 한 수는 probe.
counter·concede·escalate 는 replyToIndex 로 대상 턴을 가리켜라.
```

**C-2. buildConclusionPrompt**(orchestrator.ts:211) — 재프레임의 심장:

- 트랜스크립트 라인에 moveType 주석: `[이름 (id:…) <counter→3>] 본문`.
- 지시 추가(박제):
```
[수(手)로 결론 빌드 — moveType 활용]
- divided(끝내 갈린 것): counter·concede 가 몰린 지점이 진짜 분기다. 각 position 의
  evidenceMessageIds 는 그 입장을 *방어/반격한 counter·concede 턴*을 우선 채워라.
- openQuestions: probe 턴이 던진 질문을 최우선 후보로 삼아라(있으면).
- consensus: 누구의 counter 도 받지 않은 strike(선 주장)가 합의 후보다.
- escalate 가 한쪽에 몰리면 그 입장의 memberIds 에 보강 멤버를 포함하라.
```
- 효과: divided가 정면 충돌(counter)에 근거 → 근거칩이 "진짜 부딪힌 발언"을 가리킨다. openQuestions가 실제 probe에서 나옴.

### §D. 인사이트 가시화 — 절제 (Sonnet, 선택)

보여주기 동결선을 지킨다. **무대 펄스·크리티컬 발광·질문 비네트 = 동결 유지.** 허용되는 건 *인사이트를 전달하는* 조용한 신호뿐:

- 결정 지도 divided 카드에 **"정면 충돌 N회"** 같은 작은 메타(counter 수) — 어느 분기가 가장 격렬했는지 인사이트. 애니메이션 금지, 텍스트 칩.
- (선택) 피드에서 counter 카드에 기존 "↩ ○○에 반박" 라벨(이미 있음, MessageCard replyTarget)을 moveType으로 *정확화*만 — 신규 연출 0.

## 3. 합격선 (인사이트 지향)

| 지표 | 합격선 |
| --- | --- |
| counter 턴의 직전 발언 *구체 표현* 인용률 | 80% 이상 (기존 P-B 합격선 계승) |
| divided position 의 evidenceMessageIds 가 counter·concede 턴을 포함하는 비율 | 향상 (전후 비교, 동일 고민 3개) |
| probe 턴 → openQuestions 매핑 | probe 있으면 최소 1개 반영 |
| moveType 분포 | strike 일색 아님 (한 청크에 counter/probe 최소 1) |
| 회귀 | 옛 청크(moveType 없음) 결론·재생 정상 / 무대 연출 추가 0 |

## 4. 출하 / 순서

- R-2 스트리밍 PR과 **같은 PR 금지**(team note — 스키마 변경이 확정 가드와 겹침). R-2 머지·검증 후 착수.
- PR 1개: §A+§B+§C(스키마·sanitize·프롬프트). §D는 후속 분리.
- 분담: Sonnet(§A·§B·§C 주입·§D), Opus(확정 가드 디폴트 1줄 + PR 검수), Fable(C-1·C-2 박제 — 본 문서), 운영자(전후 결론 비교).

## 5. 비범위

- 무대 연출 3종(반격 펄스·크리티컬·질문 비네트) — 보여주기, 동결 유지.
- moveType 기반 게임 점수·게이지 — ⑤-5와 함께 동결.
- 핀 자동추천(counter/probe → 핀 힌트)은 매력적이나 별도 — I-2 후속으로 분리.
