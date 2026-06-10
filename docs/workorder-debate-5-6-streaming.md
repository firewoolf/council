# 작업 의뢰서 — 트랙 ⑤-6 (R-2): 스트리밍 발화

> 담당: **Opus 직접 구현** (§3-A·B·C 코어 — useDebate 심장부, B-2 직접 구현 선례) / Sonnet (§3-D·E·F 폴리시)
> 작성: Fable (설계 + 부록 의사코드 박제)
> 검수: Opus 셀프 검수 후 운영자 라이브 검증 (공급사 3종)
> 대상 레포: `council/`
> 선행 문서: `meeting-2026-06-10-ui-replan.md` §2-C·§3 쟁점2, `plan-2026-06-10-role-split.md`
> 선행 상태: **R-1 합격 후 착수** (무대 단일화 전제 — 타이핑 reveal을 꽂을 자리가 1곳이어야 한다). P-B(moveType)와 같은 PR 금지.

---

## 0. 한 줄 목표

청크 생성과 재생을 직렬에서 병렬로 — 첫 턴이 확정되는 즉시 무대에서 말하기 시작한다. 체감 죽은 대기 수십 초 → 5초 이내. **원칙: API 호출은 방향 결정에 쓰고, 출력은 흘려받는다.**

## 1. 배경 — 진단

현재 `generateChunk`는 `generateObject` — 3~5턴 + nextTopics가 *전부* 완성될 때까지 아무것도 주지 않는다. 재생 엔진(`useDebate`)은 완성 배열을 timer로 드러내므로, 첫 글자가 보이는 시점 = 마지막 턴 생성 완료 이후. 모델이 첫 턴을 3초에 썼어도 사용자는 20초 뒤에 본다. WaitingMemoArea는 이 죽은 시간의 증상 치료였다.

전환: `streamObject`의 `partialObjectStream`으로 턴을 **확정되는 즉시** 재생 큐에 넣는다. 생성 속도 > 읽기 속도이므로 첫 턴 이후 재생은 보통 끊기지 않는다.

## 2. 절대 원칙

1. **스트림은 표시용, 저장은 완성본** — `appendMessage`/`addChunk`는 지금처럼 청크 완성 시 일괄. 스트림 중 새로고침하면 진행 중 청크는 사라진다(현행과 동일 — 회귀 아님). localStorage에 half-state를 만들지 않는다.
2. **턴 확정 규칙** — `turns[i]`는 ① `partial.turns[i+1]`이 나타나거나 ② 스트림이 종료(최종 객체 검증 통과)했을 때만 확정. 미확정 턴(메시지가 자라는 중)은 절대 재생하지 않는다.
3. **1차는 타이핑 연출** — 토큰을 화면에 직결하지 않는다. 확정된 턴을 글자 단위로 흘리는 *연출*이다. 페이싱은 모델 속도가 아니라 우리가 쥔다.
4. **폴백은 청크 단위** — 스트림 중 에러(미드스트림 포함)면 그 청크를 통째로 폐기하고 다음 공급사에서 처음부터 재생성. 표시됐던 턴도 함께 사라진다(저장 전이므로 무결성 영향 0). 이어붙이기 금지 — 단순함 우선.
5. **레거시 경로 보존** — `supportsStream: false` 공급사는 기존 `generateObject` 경로 그대로. 두 경로는 같은 턴→Message 변환 헬퍼를 공유한다.
6. **재생 자산 계승** — readingTime 페이싱, skipTurn(탭), speed(1x/2x), INTER_CHUNK_COOLDOWN, 사운드(soundFor), ⑤-5e 튜닝값은 그대로.

## 3. 작업 범위

### A. `streamChunk` — `lib/ai/client.ts` ★Opus

`streamObject` 기반 신규 함수. 시그니처는 콜백형:

```ts
export async function streamChunk(args: {
  provider: AiProvider;
  apiKey: string;
  concern: string;
  panel: PanelEntry[];          // P-A 이후 voiceCard 포함형
  topic: string;
  transcript: string;
  isFirst: boolean;
  signal?: AbortSignal;
  /** 턴이 확정될 때마다 — 검증·변환 전 raw turn */
  onTurn: (turn: ChunkTurn, index: number) => void;
}): Promise<Chunk>;              // 최종 sanitizeChunk 통과본
```

구현 골자 (부록 A 의사코드):

- `streamObject({ model, schema: chunkSchema, system, prompt, temperature, maxRetries: 0, abortSignal })`.
- `partialObjectStream` 순회: `turns[i+1]`의 *존재*가 감지되는 순간 `turns[i]`를 확정 → 가드(`speakerName`·`message` 존재) 통과 시 `onTurn(turns[i], i)`. 같은 인덱스 중복 확정 금지(`confirmedCount` 커서).
- 스트림 종료: `await result.object` (zod 최종 검증 — 실패 시 throw → 폴백 경로). 마지막 턴 확정 콜백 후 `sanitizeChunk` 통과본 반환.
- `maxRetries: 0` — 재시도는 `runWithFallback`이 공급사 전환으로 처리 (이중 재시도 금지).
- 전체 타임아웃 60초: `AbortSignal.timeout` 과 외부 signal 합성(`AbortSignal.any`).

### B. `runWithFallback` 스트림 호환 — `lib/ai/runWithFallback.ts` ★Opus

현행은 promise 1회 호출 래퍼라 그대로 쓸 수 있다 — **소비 루프 전체를 fn 안에 넣는다**: `runWithFallback('chunk', keys, (provider, key) => streamChunk({...provider, key, onTurn}))`. 단:

- 공급사 전환 시 이전 시도에서 `onTurn`으로 이미 흘러나간 턴이 있다 → 호출자(useDebate)가 **시도 단위 reset 콜백**을 받아야 한다. `onFallback(from, to)` 기존 훅에서 라이브 버퍼를 비우는 것으로 충분 — 신규 인자 불요.
- `supportsStream`이 false인 공급사로 폴백되면 fn 내부에서 `generateChunk` 경로로 분기 (이 경우 onTurn은 완성 후 일괄 호출 — 인터페이스 동일, 체감만 현행과 같음).

### C. `useDebate` 재생 엔진 전환 ★Opus

핵심 변경 — "완성 배열 timer 재생" → **"라이브 턴 큐 소비"**:

```ts
// 신규 ephemeral 상태 (persist 안 함 — 원칙 1)
liveTurnsRef: Message[]          // 확정 턴의 변환본 (이번 청크)
streamDoneRef: boolean           // 최종 객체 도착 여부
revealedTurnCount                // 현행 유지 — 이제 liveTurns 기준
```

- **변환 헬퍼 추출**: 현행 generating effect 안의 턴→Message 변환(이름→castId, 환각 드롭+toast, replyToIndex→replyTo 매핑, id 발급)을 `convertTurn(turn, index, ctx): Message | null`로 추출. `onTurn`마다 호출해 `liveTurnsRef`에 push. **여기서 발급한 Message id를 완성 시 저장에도 그대로 사용** — 표시본과 저장본이 동일 객체.
- **phase 전이**: `generating` → 첫 턴 확정 시 즉시 `playing`. 재생 effect는 `currentChunkTurns`(store) 대신 `liveTurnsRef` 소비. 큐 소진 + `!streamDone` → 화면상 'thinking' 상태(다음 화자 준비 연출 — §E)로 대기, 새 턴 확정 시 재개. 큐 소진 + `streamDone` → 쿨다운 후 `steering` (저장 완료 후).
- **저장 시점**: `streamChunk` resolve(최종 검증 통과) 직후 — `liveTurns` 일괄 `appendMessage` + `addChunk(chunkMeta)` (nextTopics는 이 시점에만 존재). 이후 `currentChunkIndex`를 새 청크로 — revealedMessages 파생은 현행 로직이 store 기준으로 이어받는다 (id 동일 → 깜빡임 없음, 부록 B 순서 준수).
- **에러/폴백**: `onFallback` → `liveTurnsRef = []`, `revealedTurnCount = 0`, toast "장면을 다시 연출합니다 (공급사 전환)". 전 공급사 소진 → 현행 error 처리.
- **steering 진입 조건**: 모든 턴 reveal 완료 **AND** 저장 완료 (nextTopics 없이 SteeringPanel 못 띄움).
- 새로고침 복원·concluded 동기화·결론 생성 effect는 무수정.

### D. `supportsStream` 플래그 — `lib/ai/providers.ts` (Sonnet)

- `ProviderConfig`에 `supportsStream: boolean` 추가.
- 초기값: groq `true` / cerebras `true` / gemini `true` / openrouter `false`(`openrouter/free`는 라우팅 모델 미상 — 보수적) / claude `false`(브라우저 경로 없음).
- 라이브 검증에서 깨지는 공급사는 플래그만 내리면 현행 경로로 복귀 — 점진 전환 장치.

### E. 무대 타이핑 reveal + 준비 연출 (Sonnet)

- `components/debate/` 에 `TypewriterText` 소형 컴포넌트: 확정 턴 본문을 글자 단위 표시. 속도 `28ms/char ÷ speed`, 완료 후 잔여 readingTime만큼 홀드(체감 페이싱 = 현행 readingTime 총량 유지). 탭 1회 = 즉시 완성, 탭 2회째 = 기존 skipTurn. `prefers-reduced-motion`이면 즉시 완성.
- DebateStage 대사 박스의 `line` 표시부를 TypewriterText로 교체 (R-1 §6 메모가 이 자리를 단순하게 남겨뒀다).
- 큐 공백 대기 연출: 무대 'thinking' 상태 재사용 — "다음 발언을 준비합니다" + orb 맥동. 신규 모션 금지(CSS 기존 자산).
- `DebateControls` progress: 스트림 열려 있는 동안 total 미정 — `revealed / confirmed+` 표기 (예: `2/3+`). 스트림 종료 후 현행 표기.

### F. WaitingMemoArea 노출 축소 (Sonnet)

- 노출 조건: `phase === 'generating'` **AND 확정 턴 0개** (첫 턴 도착 전 윈도우만). 첫 턴이 뜨면 자연 퇴장.
- 입력 중 첫 턴이 도착해도 입력값은 유지된 채 패널만 닫지 말 것 — 작성 중이면(`value.length > 0`) 전송/취소할 때까지 잔존.

## 4. 출하 단위 — PR 2개

- **R-2a (Opus)**: §A + §B + §C — 코어. 이 시점 대사 박스는 현행 통짜 표시(타이핑 없음)여도 출하 가능 — 첫 턴 조기 등장만으로 체감 대기가 풀린다.
- **R-2b (Sonnet)**: §D 플래그 노출 + §E + §F — 폴리시. (§D의 타입·플래그 자체는 R-2a에 포함)

## 5. 검증

### 합격 지표

| 지표 | 합격선 |
| --- | --- |
| 첫 발언 체감 대기 (시작/갈림길 선택 → 첫 글자) | 5초 이내 (Groq 기준) |
| 재생 중 큐 고갈로 인한 멈칫 | 청크당 1회 이하 (체감) |
| 데이터 무결성 | 스트림 중 새로고침 → 완성 청크만 잔존, half-state 0 |
| 폴백 | 키 고갈 공급사 강제 → 자동 전환 + 장면 재연출 + 무결성 유지 |
| 회귀 | 결론 생성·steering·디렉션·메모·skipTurn·speed 전부 현행 동작 |

### 라이브 검증 (운영자, 공급사 3종)

1. Groq → 첫 발언 5초 이내 + 타이핑 reveal + 턴 간 끊김 없음
2. Cerebras·Gemini → 동일 시나리오 1회씩
3. openrouter(스트림 off) → 현행 체감으로 정상 동작 (레거시 경로 확인)
4. 스트림 중 새로고침 → steering 복원이 마지막 *완성* 청크 기준
5. 비행기 모드로 미드스트림 차단 → 에러 배너 + 재시작 가능

### 기계 검증

- typecheck / lint / build. `generateChunk` 잔존 + 공용 변환 헬퍼 단일화 확인.

## 6. 리스크 메모

- **partialObjectStream의 배열 인덱스 점프** — 일부 SDK 버전에서 partial 배열이 한 번에 2개 늘 수 있다. 확정 커서는 `for (; confirmed < len - 1; confirmed++)` 루프로 — 인덱스 건너뜀 없이 순차 확정 (부록 A).
- **gemini 구조화 스트리밍 편차** — google provider의 partial JSON 안정성이 떨어지면 D의 플래그를 내리고 출하. 블로킹 아님.
- **P-B 선행 금지** — moveType 스키마가 들어오면 확정 가드가 달라진다. 본 트랙 출하 후 P-B에서 가드에 필드 1개 추가하는 게 순서다.

---

## 부록 A — streamChunk 소비 루프 의사코드 (박제)

```ts
const result = streamObject({
  model, schema: chunkSchema,
  system: CHUNK_SYSTEM_PROMPT, prompt: buildChunkPrompt(args),
  temperature: TEMPERATURE.speech, maxRetries: 0,
  abortSignal: AbortSignal.any([args.signal, AbortSignal.timeout(60_000)].filter(Boolean)),
});

let confirmed = 0;
for await (const partial of result.partialObjectStream) {
  const turns = partial.turns;
  if (!Array.isArray(turns)) continue;
  // turns[i+1] 의 존재 = turns[i] 확정. 순차 커서 — 점프 금지.
  while (confirmed < turns.length - 1) {
    const t = turns[confirmed];
    if (!t || typeof t.speakerName !== 'string' || typeof t.message !== 'string' || t.message.length === 0) {
      break; // 불완전 턴 — 커서를 전진시키지 않고 다음 partial 대기 (전진 시 영구 유실 — 검수 픽스 2026-06-10)
    }
    args.onTurn(normalizeTurn(t, confirmed), confirmed); // replyToIndex < confirmed 가드 포함
    confirmed++;
  }
}

const final = await result.object;            // zod 최종 검증 — 실패 시 throw
const { chunk } = sanitizeChunk(final);
// 마지막 턴 + (가드 실패로 건너뛴 턴) 확정 콜백
for (let i = confirmed; i < chunk.turns.length; i++) args.onTurn(chunk.turns[i], i);
return chunk;
```

주의: 가드 실패 시 커서를 멈추므로(break) 건너뛴 인덱스가 생기지 않는다 — 영구 불완전 턴(빈 message 등)이면 스트림 종료 후 복구 루프가 `confirmed`부터 순서대로 일괄 확정한다. `onTurn`은 (index 오름차순, 유실·중복 없음)을 계약으로 한다. useDebate의 소비부는 index 기준 멱등(`handled` Set)이어야 한다.

## 부록 B — 저장·표시 전환 순서 (박제)

```text
1. streamChunk resolve (sanitize 통과본 확보)
2. liveTurns → appendMessage 일괄 (id 는 convertTurn 발급분 그대로)
3. addChunk(chunkMeta — nextTopics 포함)
4. setCurrentChunkIndex(새 인덱스)   ← 이 시점부터 revealedMessages 가 store 기준
5. liveTurnsRef 비움 (streamDoneRef 리셋)
6. 모든 턴 reveal 완료 시 → INTER_CHUNK_COOLDOWN → setPhase('steering')
```

2~4와 재생 진행(revealedTurnCount)이 경합하지 않도록, revealedMessages 파생에서 "현재 청크" 소스는 `chunkMeta 등록 전 = liveTurns / 등록 후 = store 필터" 한 군데서만 분기한다. id가 동일하므로 React key 충돌·깜빡임 없음.

## 부록 C — 체감 타임라인 (목표)

```text
현재:  [선택] ──────────── 20s+ 죽은 대기 ──────────── [턴1][턴2][턴3]…
R-2a:  [선택] ── 3~5s ── [턴1 등장]…(생성은 배후 계속)…[턴N] ── 갈림길
R-2b:  [선택] ── 3~5s ── [턴1 타이핑▌]…                       ── 갈림길
```
