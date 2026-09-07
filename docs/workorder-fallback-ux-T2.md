# 워크오더 T-2 — 폴백 분류 수정 + 결론 CTA 재배치 + BYOK 우선순위

설계: Fable / 판정: David / 기준: origin/main = 7b9a397 (T-1 병합 후)

T-1 실측을 프로덕션에서 돌리다 **세션이 두 번 죽었다.** 원인 셋이 나왔고,
§A는 무료 키 전략 전체를 무력화하는 결함이다. 계정·쿼터(§8-1)보다 먼저 막는다.

---

## §A 폴백 분류 수정 (최우선)

### 관측된 실패

OpenRouter 무료 모델이 뱉은 문구:

```
This model is currently experiencing high demand.
Spikes in demand are usually temporary. Please try again later.
```

`classifyAiError` 정규식 셋 중 어디에도 안 걸려 `unknown` 으로 떨어졌다.
`runWithFallback` 은 `kind !== 'quota'` 면 즉시 throw 한다 →
**Gemini 키가 멀쩡히 등록돼 있는데 폴백하지 않고 토론이 중단됐다.**

`providers.ts` 주석이 내건 "같은 공급사 여러 키 = 무료한도 곱" 전략이
공급사 에러 문구 하나로 통째로 무력화된다.

### A-1 `lib/ai/errors.ts` — kind 추가 + 분류 순서 교정

`AiErrorKind` 에 `'overloaded'` 를 추가한다 (일시적 과부하. 키·한도와 무관).

`classifyAiError` 의 **검사 순서를 아래로 바꾼다.** 현행은 `invalid_key` 가
맨 앞이라 오분류를 만든다.

```
1) overloaded : /high demand|overload|capacity|503|temporarily unavailable|try again later|busy/i
2) quota      : /quota|rate.?limit|429|exceed|too many requests/i
3) invalid_key: /invalid[ _-]?(api[ _-]?key|token|auth)|api[ _-]?key|unauthor|401|403/i
4) network    : /network|fetch failed|cors|timeout|ECONN/i
5) unknown
```

**invalid_key 패턴을 반드시 좁힐 것.** 현행 `/…|invalid|…/` 는 `invalid` 단독을
잡아서, 구조화 출력(zod) 검증 실패의 "invalid JSON" 류 메시지까지
"API 키가 유효하지 않습니다" 로 오안내한다. 위 패턴처럼 key/token/auth 와
붙은 형태만 잡는다.

`overloaded` 사용자 메시지: `${providerName} 서버가 혼잡합니다. 다른 공급사로 전환합니다.`

### A-2 `lib/ai/runWithFallback.ts` — 폴백 조건 확장

```ts
// 현행
if (!(err instanceof AiCallError) || err.kind !== 'quota') throw err;
```

`quota` 와 `overloaded` 둘 다 폴백 대상으로 바꾼다.
`errors.ts` 에 `isRetryable(kind: AiErrorKind): boolean` 을 export 하고 그걸 쓴다.

**`network` 와 `unknown` 은 폴백 대상이 아니다.** 진짜 결함을 숨긴다.
이 경계를 넓히지 말 것.

### A-3 `lib/ai/errors.ts` 상단 주석 갱신

kind 목록에 `overloaded` 한 줄 추가.

---

## §B `components/debate/DebateControls.tsx` — 결론 CTA 하단 배치

### 문제

결론 완료 시 클릭 가능한 CTA 는 `app/(main)/session/[id]/page.tsx:248~266`
상단 배너 하나뿐이다. 하단은 죽은 텍스트다:

- `DebateControls` (`phase === 'concluded'`) → "결론이 정리되었습니다." 텍스트만
- `ChatInputBar` → 비활성 placeholder "토론이 종결되었습니다"

사용자 시선은 마지막 발언이 있는 **하단**에 있는데 행동은 스크롤 위에서 해야 한다.
David 실사용에서 걸린 지점이다.

### 수정

`DebateControls` 의 `phase === 'concluded'` 분기를 텍스트에서 **CTA 로** 바꾼다.

- `next/link` 로 `/session/${sessionId}/summary` 이동
- 문구 "결론 보기 →", `Flag` 아이콘 유지
- 상단 배너는 **그대로 둔다** (중복 무해, 스크롤 위에서도 눌러야 함)
- `sessionId` 가 props 에 없으면 추가한다. 호출부 전부 갱신.
- 자동 스크롤은 넣지 말 것 — 사용자가 위를 읽는 중일 때 시점을 뺏는다.

`embedded` 모드에서도 동일하게 동작해야 한다.

---

## §C `lib/ai/providers.ts` — BYOK_PROVIDERS 재정렬

### 문제

```ts
export const BYOK_PROVIDERS: AiProvider[] = ['groq', 'openrouter', 'cerebras', 'gemini'];
// 주석: "추천 순서는 무료 한도 큰 것부터 (Groq > OpenRouter > Cerebras > Gemini)"
```

설정 화면이 스스로 표시하는 실제 무료 한도:

| 공급사 | 한도 | 현재 순위 |
|---|---|---|
| Groq | 일 14,400회 | 1 |
| **OpenRouter** | **일 50회** | **2** ← 오정렬 |
| Cerebras | 일 100만 토큰 | 3 |
| Gemini | 일 1,000회 | 4 |

OpenRouter 가 압도적으로 제일 작은데 2순위다. `openrouter.roles` 에 `chunk` 가
있어서, Groq 키가 없으면 청크 6콜이 전부 OpenRouter 로 간다 → **하루 8세션이면 소진.**

### 수정

실제 한도 순으로 재정렬하고 **OpenRouter 를 마지막으로 내린다.**

```ts
export const BYOK_PROVIDERS: AiProvider[] = ['groq', 'cerebras', 'gemini', 'openrouter'];
```

주석의 정렬 근거를 실제 한도 표로 교체한다. 각 공급사의 `freeTier` 문자열이
근거임을 명시할 것.

`SERVER_PROVIDERS` 는 **건드리지 않는다** (서버키는 별도 한도 체계).

---

## §D 하지 말 것

- `lib/prompts/*` 무수정.
- `store/usage.ts` · `lib/ai/pricing.ts` · `lib/ai/client.ts` 의 계측 코드 무수정 (T-1 완료분).
- 새 공급사 추가·모델 변경 금지.
- 자동 스크롤·토스트 추가 금지.
- 단가를 추측해서 `MODEL_PRICES` 에 채우지 말 것.

## §E 합격선

1. `pnpm typecheck` · `pnpm build` 통과.
2. `classifyAiError` 단위 테스트 신설 — 아래 6개 문구가 기대 kind 로 분류될 것.
   - "This model is currently experiencing high demand." → `overloaded`
   - "503 Service Unavailable" → `overloaded`
   - "Rate limit exceeded" → `quota`
   - "429 Too Many Requests" → `quota`
   - "Invalid API key provided" → `invalid_key`
   - "invalid JSON response from model" → **`invalid_key` 가 아닐 것** (unknown 허용)
3. 결론 완료 후 하단 컨트롤에서 결론 페이지로 이동 가능.
4. `BYOK_PROVIDERS` 마지막 원소가 `openrouter`.

## §F 검증 (David 손)

프로덕션 배포 후 OpenRouter + Gemini 두 키를 등록한 상태로 세션 1회.
OpenRouter 가 한도/혼잡으로 실패해도 **Gemini 로 넘어가 토론이 이어지는지** 본다.
`/admin/usage` 세션별 표에 두 공급사가 찍히면 폴백이 실제로 돈 것이다.
