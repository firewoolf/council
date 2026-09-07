# 워크오더 T-1 — 토큰 실측 계측 (Token Metering)

발행: 2026-08-01 / 설계: Fable / 실행: Sonnet 단독 PR
브랜치: `feat/token-metering-T1`
선행 조건: 없음 (독립 트랙, LLM 호출 0건 추가)
후행: **P-C 프롬프트 캐시 정렬** — 이 계측이 P-C 전후 비교의 기준선이다.

---

## §0 배경 — 왜 계측이 먼저인가

"반응이 좋다 → 상용화 → 토큰 이슈"라는 물음에 답하려고 코드를 정적 분석했다.
결과는 아래인데, **전부 추정이다.** 휴리스틱 토크나이저(한글 1자≈1tok)로 프롬프트
문자열을 세고, 세션당 청크 6개·패널 4명·24턴을 가정했다.

### 정적 추정 (2026-08-01, 미검증)

| 호출 | 횟수/세션 | in/회 | out/회 | in 합 | out 합 |
|---|---|---|---|---|---|
| clarifyConcern | 2 | 1,080 | 250 | 2,160 | 500 |
| designPanel | 1 | 3,150 | 700 | 3,150 | 700 |
| **generateChunk** | **6** | **5,380** | **900** | **32,280** | **5,400** |
| generateConclusion | 1 | 4,600 | 700 | 4,600 | 700 |
| generateMirrorProfile | 1 | 500 | 250 | 500 | 250 |
| **합계** | | | | **~42,700** | **~7,550** |

세션당 약 5만 토큰. Gemini 2.5 Flash-Lite 기준 세션당 약 10원(1 USD≈1,400원).

### 청크 input 5,380의 내역 (추정)

| 구간 | tok | 성격 |
|---|---|---|
| `CHUNK_SYSTEM_PROMPT` | 1,423 | 완전 고정 |
| `chunkSchema` (JSON Schema) | ~560 | 완전 고정 |
| `buildChunkPrompt` 작업 지시 템플릿 | 1,194 | 완전 고정 |
| 고민 + 패널(voiceCard 4장) | ~770 | 세션 내 고정 |
| 소주제 + 트랜스크립트(tail 8 + ★3) | ~1,430 | 가변 |

**고정분 3,177(59%)이 청크마다 통째로 재전송된다.** 세션 전체 input의 45%.
그런데 `buildChunkPrompt`가 그 1,194 토큰 고정 블록을 프롬프트 *끝*에 둬서,
Gemini implicit caching(공통 접두사만 잡음)이 system+스키마 선에서 끊긴다.
→ 이걸 뒤집는 게 P-C인데, **추정 위에 최적화를 얹으면 도박이다.**

이 워크오더는 최적화가 아니다. **자를 먼저 만든다.**

---

## §A `store/usage.ts` — v2 확장

현행: `calls`(공급사별 호출 수) / `total` / `lastProvider` + `bump(provider)`.
`runWithFallback`(:72)이 성공 시 단일 지점에서 bump 한다. **이 구조를 보존하고 얹는다.**

### A-1 타입

```ts
/** 호출 종류 — client.ts 함수 1:1 대응. */
export type UsageKind =
  | 'chunk' | 'conclusion' | 'clarify' | 'panel'
  | 'recommend' | 'topics' | 'mirror' | 'ping';

export interface UsageBucket {
  /** 호출 수 */
  n: number;
  /** 프롬프트(입력) 토큰 누적 */
  inTok: number;
  /** 완성(출력) 토큰 누적 */
  outTok: number;
  /** 캐시 적중 입력 토큰 누적 — P-C 전후 비교의 핵심 지표. 미지원 공급사는 0. */
  cachedTok: number;
}

export interface SessionUsage extends UsageBucket {
  byKind: Partial<Record<UsageKind, UsageBucket>>;
  /** 이 세션에서 실제로 쓰인 공급사들 */
  providers: Partial<Record<AiProvider, number>>;
  /** 첫 호출 시각(ms) — 정렬·LRU 용 */
  startedAt: number;
}
```

### A-2 상태

기존 3필드는 **이름·의미 그대로 유지**(UsageIndicator 회귀 0). 아래를 추가:

```ts
currentSessionId: string | null;
byKind: Partial<Record<UsageKind, UsageBucket>>;   // 전체 누적
bySession: Record<string, SessionUsage>;

setSession: (sessionId: string | null) => void;
report: (args: {
  provider: AiProvider;
  kind: UsageKind;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
}) => void;
reset: () => void;   // 기존 — 새 필드도 함께 초기화
```

`bump(provider)`는 **삭제하지 않는다.** `runWithFallback`이 계속 호출한다
(호출 수 집계는 계측이 실패해도 남아야 한다 — 두 경로의 목적이 다르다).

### A-3 `report` 구현 규칙

- `promptTokens`/`completionTokens`가 `undefined`·`NaN`·음수면 **0으로 절삭**하고
  `n`만 1 올린다. OpenAI 호환 프록시(mistral/sambanova/nvidia/together/github)는
  usage 필드를 안 주는 경우가 있다 — 그래도 호출 수는 세야 한다.
- `currentSessionId`가 null이면 `bySession`은 건드리지 않고 전역 `byKind`만 올린다.
- 세션 버킷은 `startedAt`을 최초 1회만 기록한다.

### A-4 persist 마이그레이션 (회귀 0 — **필수**)

`name: 'council-usage'` 유지. 구 상태(3필드)가 이미 사용자 브라우저에 깔려 있다.

```ts
version: 2,
migrate: (persisted, from) => {
  const s = (persisted ?? {}) as Partial<UsageState>;
  return {
    calls: s.calls ?? {},
    total: s.total ?? 0,
    lastProvider: s.lastProvider ?? null,
    currentSessionId: null,   // 세션 포인터는 절대 복원하지 않는다
    byKind: s.byKind ?? {},
    bySession: s.bySession ?? {},
  };
},
```

`partialize`로 `currentSessionId`를 저장에서 제외한다 — 새로고침 후 죽은 세션에
토큰이 귀속되는 사고를 원천 차단.

### A-5 `bySession` 상한 (localStorage 보호)

`report` 안에서 **`bySession` 항목이 30개를 넘으면 `startedAt` 오름차순으로
초과분을 잘라낸다.** 상한 없이 두면 헤비 유저의 localStorage가 조용히 부푼다.
상한 상수는 모듈 최상단에 `const MAX_SESSIONS = 30;`으로 노출.

---

## §B `lib/ai/pricing.ts` — 신설 (단가표)

```ts
export interface ModelPrice {
  /** USD per 1M input tokens. null = 단가 미확인. */
  inPerM: number | null;
  /** USD per 1M output tokens. null = 단가 미확인. */
  outPerM: number | null;
  /** 캐시 적중 입력 단가. null = 미지원/미확인. */
  cachedInPerM?: number | null;
  /** 단가 확인 출처·일자 — 갱신 추적용 */
  source: string;
}
```

`PROVIDERS[p].modelId` 기준으로 키를 잡는다. **2026-08-01 확인분:**

| provider | modelId | in $/M | out $/M | cached in $/M |
|---|---|---|---|---|
| gemini | gemini-2.5-flash-lite | 0.10 | 0.40 | 0.01 |
| groq | llama-3.3-70b-versatile | 0.59 | 0.79 | null |
| claude | claude-sonnet-4-6 | 3.00 | 15.00 | null |
| openrouter | openrouter/free | 0 | 0 | null |
| cerebras | gpt-oss-120b | **null** | **null** | null |
| mistral / sambanova / nvidia / together / github | — | **null** | **null** | null |

> ⚠️ **null을 추측값으로 채우지 마라.** 틀린 단가는 없는 단가보다 나쁘다 —
> 원가를 오판해서 가격 정책이 틀어진다. UI는 null을 `—`로 렌더하고
> "단가 미확인" 배지를 단다. 확인되면 `source`와 함께 채운다.

환율은 상수 1개로 분리: `export const USD_TO_KRW = 1400;` (표시 전용, 근사치임을
UI에 명시). 헬퍼 `estimateCostUsd(provider, bucket): number | null` 제공 —
단가가 null이면 null 반환(0 아님).

---

## §C `lib/ai/client.ts` — 계측 주입 (8지점)

### C-1 원칙

**함수 시그니처·반환 타입을 바꾸지 않는다.** `{ chunk, usage }` 식으로 바꾸면
`useDebate` 호출부가 줄줄이 딸려온다 — 지금 트리는 이미 트랙 횡단으로 엉켜 있다
(`verify-commit-2026-06-14.md` 참조). 각 함수가 **자기 kind를 알고 직접 보고**한다.

모듈 상단에 로컬 헬퍼 1개:

```ts
import { useUsageStore } from '@/store/usage';
import type { UsageKind } from '@/store/usage';

/** 계측 보고 — 절대 throw 하지 않는다. 실패해도 토론은 흐른다. */
function meter(
  provider: AiProvider,
  kind: UsageKind,
  usage: { promptTokens?: number; completionTokens?: number } | undefined,
  providerMetadata?: unknown,
): void {
  try {
    useUsageStore.getState().report({
      provider,
      kind,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      cachedTokens: readCachedTokens(providerMetadata),
    });
  } catch {
    // 계측 실패는 메인 흐름과 무관 (runWithFallback bump 와 동일 정책).
  }
}
```

`readCachedTokens`는 Google 경로의
`providerMetadata?.google?.cachedContentTokenCount`를 안전하게 읽고,
없으면 `undefined`. 다른 공급사 필드는 확인되면 추가.

### C-2 주입 지점

`ai@4.x`의 `generateObject`는 `{ object, usage, providerMetadata }`를 반환한다
(v4 필드명은 `promptTokens` / `completionTokens` — v5의 `inputTokens`가 **아니다**).
현재 코드는 전부 `const { object } = await generateObject({...})`로 구조분해하고
있으니, `usage`·`providerMetadata`를 함께 받아 `meter()` 한 줄을 잇는다.

| # | 함수 | 위치(현행) | kind |
|---|---|---|---|
| 1 | `generateChunk` | client.ts:352 `generateObject` | `chunk` |
| 2 | `streamChunk` | client.ts:449 `streamObject` | `chunk` |
| 3 | `recommendPersonas` | :514 | `recommend` |
| 4 | `proposeTopics` | :538 | `topics` |
| 5 | `designPanel` | :564 | `panel` |
| 6 | `clarifyConcern` | :589 | `clarify` |
| 7 | `generateMirrorProfile` | :612 | `mirror` |
| 8 | `generateConclusion` | :670 | `conclusion` |

`testApiKey`(:172)는 **계측하지 않는다** — ping은 토론 원가가 아니다.

### C-3 `streamChunk` 특수 처리

`streamObject`의 usage는 **Promise**다. 스트림 완주 후에만 확정된다.
현행 코드는 `const final = await result.object;`(:491) 다음 `sanitizeChunk`로 간다.
그 직후, **`return chunk` 이전에** 다음을 넣는다:

```ts
try {
  const usage = await result.usage;
  const pm = await result.providerMetadata;
  meter(args.provider, 'chunk', usage, pm);
} catch {
  // abort·타임아웃이면 usage 가 안 온다. 무시 — 토론은 이미 완성됐다.
}
```

**`await result.usage`를 `result.object` 앞에 두지 마라.** 순서가 바뀌면
zod 검증 실패 시 폴백 경로가 한 박자 늦어진다.

---

## §D `hooks/useDebate.ts` — 세션 바인딩

토큰을 세션에 귀속시키려면 스토어가 "지금 어느 세션인지" 알아야 한다.
`useDebate(sessionId)` 안에서 마운트 시 1회:

```ts
useEffect(() => {
  useUsageStore.getState().setSession(sessionId);
  return () => useUsageStore.getState().setSession(null);
}, [sessionId]);
```

이게 **useDebate에 손대는 유일한 지점**이다. 다른 줄은 건드리지 않는다.

> R-2c 분기 프리페치로 청크가 동시에 두 개 뜰 수 있는데, 둘 다 같은 세션이라
> 귀속이 섞이지 않는다. 세션 페이지는 한 번에 하나만 열리므로 교차 귀속 없음.

---

## §E 표시

### E-1 `UsageIndicator` — 한 줄 추가 (기존 UI 보존)

펼침 영역 하단에 현재 세션 요약 한 줄:
`이번 회의 · 입력 42.7K / 출력 7.6K · 약 10원`
- 단가 미확인 공급사가 섞이면 금액 대신 `원가 미확인`.
- `total === 0`이면 렌더 안 하는 기존 가드 유지.
- 접힘 기본값 유지 — **펼치지 않은 사용자에게 숫자를 들이밀지 않는다.**

### E-2 `/admin/usage` 신설 (판단용 본체)

`app/admin/usage/page.tsx`. 어드민 레이아웃·인증은 기존 패턴 그대로.

표 1 — **kind별 누적**: kind / 호출 수 / 평균 in / 평균 out / 캐시 적중 / 누적 원가
표 2 — **세션별**: startedAt / 청크 수(`byKind.chunk.n`) / in / out / 원가 / 공급사
상단 카드 — **세션당 평균 in·out·원가** (= 상용화 판단에 실제로 쓰는 숫자)

§0 추정치를 같은 화면에 나란히 박아 **추정 대 실측**을 바로 대조하게 한다:

| 지표 | 추정(2026-08-01) | 실측 | 오차 |
|---|---|---|---|
| 청크 in/회 | 5,380 | — | — |
| 청크 out/회 | 900 | — | — |
| 세션 in | 42,700 | — | — |
| 세션 out | 7,550 | — | — |
| 세션당 청크 수 | 6 | — | — |

`reset()` 버튼도 둔다(측정 시작점 잡기용).

---

## §F 검증 프로토콜 (David 손)

1. `/admin/usage`에서 reset.
2. 실제 고민 1건으로 세션 **1회 완주** — 고민 다듬기 → 갈림길 3회 이상 선택 → 결론.
3. 대조표 5줄을 채운다.
4. 같은 고민으로 1회 더 — 청크 수 분산 확인.
5. 공급사를 Groq로 바꿔 1회 — usage 필드가 오는지 확인(안 오면 `n`만 오르고 tok 0).

**판정 기준:** 실측 세션 in이 추정의 ±40% 안이면 §0 전체를 신뢰하고 P-C로 간다.
크게 벗어나면 어긋난 항목(청크 수? voiceCard 길이? 트랜스크립트?)을 먼저 재계산한다.

---

## §G 하지 말 것

- **client.ts 함수 반환 타입 변경 금지.** 호출부 연쇄 수정 = 트랙 오염.
- **`buildChunkPrompt` / `buildConclusionPrompt` 손대지 말 것.** 박제 원문이고,
  순서 변경은 P-C에서 별도 판정으로 푼다. 이 PR은 프롬프트 1글자도 안 바꾼다.
- **`bump(provider)` 제거 금지.** 계측과 호출 수는 별개 목적이다.
- **단가 추측 금지.** 미확인은 null.
- **계측 실패가 토론을 끊는 코드 금지.** 전 지점 try/catch swallow.
- **Zustand 셀렉터 안에서 `?? []`·`.map`·객체 리터럴 금지** —
  `workorder-fix-maxdepth-pins-selector.md`의 무한루프가 그대로 재현된다.
  `byKind`/`bySession` 구독 시 모듈 상수 `EMPTY` 패턴을 쓸 것.

---

## §H 합격선

- [ ] 세션 1회 완주 후 `/admin/usage`에 kind별·세션별 토큰과 원가가 뜬다.
- [ ] 대조표 5줄이 실측으로 채워진다.
- [ ] 구 `council-usage` localStorage 상태에서 시작해도 크래시 0 (migrate 동작).
- [ ] `UsageIndicator` 기존 동작 회귀 0.
- [ ] usage 미제공 공급사에서 `n`만 오르고 tok는 0, 에러 0.
- [ ] 토론 흐름 회귀 0 — 첫 발언 지연·스트리밍·갈림길·결론 전부 이전과 동일.
- [ ] `pnpm build` + 타입체크 통과.

## §I 분담

- **Sonnet** — §A~§E 전부. 명세가 닫혀 있다.
- **Opus** — PR 검수. 특히 §A-4 마이그레이션, §C-3 await 순서, §G 셀렉터 함정.
- **David** — §F 실측.

---

## §J 후속 (이 워크오더 범위 밖 — 실측 후 판정)

1. **P-C 프롬프트 캐시 정렬** — 청크 프롬프트 블록 재배열로 안정 접두사
   1,983 → 3,950 tok. 박제 순서 잠금 해제 판정이 선행. 본 계측이 전후 비교 기준선.
2. **티어 라우팅** — `AiTaskRole`이 이미 `chunk`/`conclude`를 분리해 뒀다.
   청크=저가 모델, 결론=상급 모델. 추정상 세션 10원 → 44원에 결론 품질만 최상급.
3. **서버측 계측** — 상용화 단계에선 클라 계측은 위조 가능하다.
   `/api/ai/[provider]/[...path]` 프록시에서 응답 usage를 읽어 티켓 `sub`별로
   적재하는 게 정본. 어뷰즈·쿼터 방어와 한 묶음.
4. **무료키 라운드로빈 정리** — `serverKeys.ts`의 다중 키 곱하기는 ToS 회색지대이고
   확장도 안 된다. 유료 Tier 1 단일 계정 전환 + 사용자당 세션 쿼터.
