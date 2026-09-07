# 작업 의뢰서 — 🔴 크래시 픽스: 신규 세션 "Maximum update depth"

> 담당: **Sonnet** (셀렉터 패치, 저위험). 작성: Fable. 검수: 운영자 라이브 + Opus.
> 대상 레포: `council/`. 우선순위: **긴급** (신규 회의가 시작 불가).
> 영향: 베이스 버그 — main·`codex/track4-mirror` 둘 다 고쳐짐.

---

## 0. 증상

회의 시작 → 페르소나 선택 직후 회의실 진입 시:
`Error: Maximum update depth exceeded` (무한 setState 루프) → 화면 크래시.

## 1. 원인 (확정)

신규 세션은 핀이 없어 `store/sessions.ts`의 `pins[id]`가 **undefined**다(`createSession`은 `sessionCast[id]`만 세팅, `pins[id]`는 첫 핀 때 생성).

`app/(main)/session/[id]/page.tsx:56`:
```ts
const rawPins = useSessionsStore((s) => s.pins?.[id] ?? []);
```
`pins[id]`가 undefined면 이 셀렉터가 **매 호출마다 새 `[]`를 반환**한다. Zustand는 `useSyncExternalStore` 기반이라 getSnapshot이 매번 다른 참조(`Object.is` false)를 주면 React가 무한 재렌더 → "Maximum update depth". React 공식: *getSnapshot 결과는 캐시돼야 하며, 매번 새 값이면 무한 루프*.

→ 회의실(page.tsx)이 마운트되는 시점에 핀이 0개라 **항상** 발동. 같은 패턴이 summary 페이지에도 4곳 잠복(핀·메시지·청크 없는 세션에서 동일 크래시).

## 2. 수정 — `?? []`을 셀렉터 *밖*으로

원칙: 셀렉터는 **undefined(안정 원시값)**를 반환하게 두고, 기본값은 컴포넌트 본문에서 한 번 적용한다. 안정 참조 상수를 모듈 레벨에 둔다.

### 2-A. `app/(main)/session/[id]/page.tsx`

컴포넌트 함수 **바깥**(파일 상단, import 아래)에 추가:
```ts
const EMPTY: never[] = [];
```
셀렉터 수정 (`?? []` → 셀렉터 밖 `?? EMPTY`):
```ts
// :52
const cast = useSessionsStore((s) => s.sessionCast?.[id]) ?? EMPTY;
// :56
const rawPins = useSessionsStore((s) => s.pins?.[id]) ?? EMPTY;
```

### 2-B. `app/(main)/session/[id]/summary/page.tsx`

동일하게 모듈 레벨 `const EMPTY: never[] = [];` 추가 후:
```ts
// :46~49
const cast     = useSessionsStore((s) => s.sessionCast?.[id])   ?? EMPTY;
const messages = useSessionsStore((s) => s.messages[id])        ?? EMPTY;
const pins     = useSessionsStore((s) => s.pins?.[id])          ?? EMPTY;
const chunks   = useSessionsStore((s) => s.sessionChunks?.[id]) ?? EMPTY;
```

## 3. 무수정 / 주의

- `?? null` 셀렉터(page.tsx:53 domain, :54 conclusion / summary:45 conclusion)는 **그대로 둔다** — null은 원시값이라 안정.
- `EMPTY`는 **절대 mutate 금지**(읽기 전용처럼 취급). 정렬·push 필요하면 복사본을 만들 것(현 코드는 이 배열을 변형하지 않음 — 확인).
- 같은 함정(셀렉터 안 `?? []`·`?? {}`·`.map`·`.filter`·객체 리터럴)이 다른 컴포넌트에도 생기지 않게 — 전역 grep으로 추가 발생 0 확인.
- store 로직·스키마 변경 0. 순수 셀렉터 표현만 수정.

## 4. 합격선

| 지표 | 합격선 |
| --- | --- |
| 신규 회의 시작 → 페르소나 선택 → 회의실 진입 | 크래시 0 (정상 진입) |
| 핀 0개 세션의 summary 진입 | 크래시 0 |
| 핀/디렉션/결론 동작 | 회귀 0 |
| `grep "?? \[\]" 셀렉터` 잔존 | 0건 |
| typecheck/lint/build | 통과 |

## 5. 검증

- **라이브(운영자)**: dev에서 신규 회의 풀 플로우(시작→페르소나→회의실→갈림길→결론→summary) 크래시 없이 완주.
- **기계**: `tsc --noEmit` (EMPTY: never[] 타입 호환 — `T[] | undefined ?? never[]` = `T[]` 만족), build.

## 6. 출하

`fix/maxdepth-pins-selector` 단독 PR. 베이스 픽스라 거울 브랜치 머지 전/후 무관하게 먼저 적용 권장.
