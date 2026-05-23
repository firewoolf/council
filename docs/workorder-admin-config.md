# 작업 의뢰서 — 토큰 수집 + 어드민 응답 설정

> 담당: Claude Code (Sonnet)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `../CLAUDE.md`, `roadmap.md`(어드민 후속 섹션)

---

## 0. 한 줄 목표

(1) LLM 호출의 토큰 사용량을 메시지에 기록하기 시작하고, (2) 흩어진 응답·토론 설정 상수를 `data/config.json` 한 곳으로 모아 `/admin`에서 편집 가능하게 한다.

---

## 1. 배경

- BYOK 구조상 서버는 토큰 사용량을 못 본다. 측정의 *유일한 토대*는 클라이언트가 호출 직후 `usage`를 기록하는 것 — 지금 그 값을 버리고 있다.
- temperature·토론 길이·턴 딜레이가 `client.ts` / `orchestrator.ts` / `useDebate.ts`에 상수로 흩어져 있다. 운영자가 코드를 안 만지고 조정할 수 있어야 한다.

---

## 2. 절대 원칙

1. CLAUDE.md ⓬ 준수 — `process.env` 직접 접근 금지(`@/env`), 테스트 코드 금지, Tailwind v3.
2. **CLAUDE.md ❷ 단순함 우선** — 설정 시스템을 과설계하지 말 것. `data/config.json` 한 파일 + 얇은 로더. 추상화 레이어 신설 금지.
3. **상수 이관 시 동작이 바뀌면 안 된다** — `config.json`의 초기값은 현재 하드코딩된 값과 *정확히 일치*해야 한다.
4. Phase 1·2는 필수, Phase 3은 권장, Phase 4는 선택. 페이즈마다 커밋 분리.

---

## 3. 작업 범위

### Phase 1 — 토큰 사용량 수집 (작고 독립적, 먼저)

AI SDK의 `generateObject`는 `{ object, usage }`를 반환한다. 현재 `lib/ai/client.ts`는 `object`만 쓰고 `usage`를 버린다.

- `generateSpeech` / `recommendPersonas` / `generateConclusion`의 반환 타입에 토큰 수를 포함.
  - 권장 형태: `Promise<{ value: T; usageTokens: number }>` (T = SpeechObject 등). `usage.totalTokens`를 쓰되 없으면 0.
- `runWithFallback`은 제네릭 `<T>`라 그대로 통과 — 호출자 시그니처만 따라 바뀐다.
- `useDebate`: `generateSpeech` 성공 후 새 `Message`에 `tokenCount: usageTokens` 기록.
  - `Message` 타입에 `tokenCount?` 이미 있음. Supabase `messages.token_count` 컬럼도 이미 있음.
- 추천/결론의 토큰도 어디든 기록할 곳이 있으면 기록 (없으면 Phase 1에선 발언만 — 세션 단위 집계는 후속).
- **UI는 만들지 않는다.** 이 페이즈는 데이터가 쌓이게 하는 것까지.

### Phase 2 — `data/config.json` + 로더 + 상수 이관

`data/config.json` 신설 (현재 값 그대로):
```json
{
  "temperature": { "speech": 0.9, "recommend": 0.45, "conclusion": 0.55 },
  "debate": {
    "softLimit": 20,
    "hardLimit": 30,
    "maxConsecutive": 2,
    "turnDelayMs": 900,
    "firstTurnDelayMs": 250
  },
  "generation": { "strategy": "realtime" }
}
```
- `generation.strategy`는 전방 호환용 — 지금은 `"realtime"`만 유효, `"batch"`는 roadmap 개선1에서 구현 예정(예약어).
- 로더 `lib/config.ts` 신설 — `lib/prompts/base.ts`가 `prompts.json`을 읽는 패턴 그대로. `export const CONFIG = configJson;` 수준으로 얇게.
- 하드코딩 상수를 CONFIG 참조로 교체:
  - `lib/ai/client.ts`의 `TEMPERATURE` → `CONFIG.temperature`
  - `lib/prompts/orchestrator.ts`의 `SOFT_LIMIT` / `HARD_LIMIT` / `MAX_CONSECUTIVE` → `CONFIG.debate.*`
  - `hooks/useDebate.ts`의 `TURN_DELAY_MS` / `FIRST_TURN_DELAY_MS` → `CONFIG.debate.*`
- 빌드 타임 import (json) — `prompts.json`·`personas.json`과 동일하게 번들된다. 런타임 변경 아님.

### Phase 3 — `/admin` 설정 편집 UI

- 기존 `/admin`이 `prompts.json`·`personas.json`을 GitHub 커밋으로 편집하는 흐름이 있다 (`lib/admin/github.ts`). **그 패턴을 그대로 재사용** — `config.json` 편집 카드 추가.
- 저장 시 Zod 검증: temperature 0~2, 각 limit 양의 정수, `softLimit < hardLimit`, strategy enum.
- `/admin/history`(B-3)가 personas/prompts 두 path의 커밋을 보여주는데, `config.json` path도 함께 포함되게 확장.

### Phase 4 — 개인 오버라이드 (선택)

- `store/api-key.ts`처럼 Zustand persist 스토어 신설 — 사용자가 덮어쓸 수 있는 *부분집합*만.
- 덮어쓰기 허용: 토론 길이 취향(짧게/보통/길게 → `hardLimit` 매핑), 생성 전략(개선1 구현 후).
- 해석 헬퍼: `resolveConfig()` = `config.json` 기본값 ← 개인 오버라이드 병합. 개인 설정이 없으면 기본값 그대로.
- **개인 설정이 없어도 전 기능이 동작해야 한다** — 오버라이드는 강제가 아닌 선택.

---

## 4. 손대지 말 것

- `data/prompts.json` / `data/personas.json` — 별개. 건드리지 말 것.
- 발언 길이 "200자"는 `prompts.json`·`speechSchema`에 있다. config로 끌어오면 ripple이 크니 **이번 범위 밖** — 그대로 둔다.
- 텔레메트리(클라이언트→Supabase 사용량 전송)·어드민 집계 대시보드 — STEP 7 종속, 이번 범위 아님.

---

## 5. 검증 기준

- [ ] `pnpm typecheck` / `pnpm build` 통과.
- [ ] Phase 1: 토론 1회 돌린 뒤 LocalStorage의 messages에 `tokenCount`가 0이 아닌 값으로 박혀 있는지 확인.
- [ ] Phase 2: config 이관 후 토론 동작이 *이전과 동일*한지 (턴 딜레이, 결론 트리거 시점 등 체감 변화 없어야 함).
- [ ] Phase 3: `/admin`에서 temperature를 바꿔 커밋 → 재배포 후 반영되는지.
- [ ] Phase 4 구현 시: 개인 설정 비운 상태로도 전 기능 정상.

---

## 6. 참고 — 현재 관련 파일

```
lib/ai/client.ts             # TEMPERATURE 상수, generateObject 호출 3곳
lib/ai/runWithFallback.ts    # 제네릭 래퍼 — 반환 타입 통과
lib/prompts/orchestrator.ts  # SOFT_LIMIT, HARD_LIMIT, MAX_CONSECUTIVE
hooks/useDebate.ts           # TURN_DELAY_MS, FIRST_TURN_DELAY_MS, 메시지 생성
lib/prompts/base.ts          # json 로더 패턴 참고
lib/admin/github.ts          # 커밋 함수 (Phase 3에서 재사용)
types/debate.ts              # Message.tokenCount (이미 있음)
```
