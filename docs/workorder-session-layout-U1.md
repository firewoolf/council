# 워크오더 U-1 — 회의 화면 웹(lg+) 레이아웃 정리

설계: Fable / 판정: David / 기준: origin/main = 134880e

David 실사용 지적 — 1024px 이상 웹 2단 레이아웃이 덜 다듬어져 있다.
"토론 시작 버튼 배치, 채팅창 위아래 정렬, 1024 기준 반응형."

**lg 미만(모바일 챗) 레이아웃은 건드리지 않는다.** 그쪽은 잘 동작한다.

---

## §0 현행 구조의 문제 3개 (실측)

`app/(main)/session/[id]/page.tsx`

```tsx
<div className="flex flex-col gap-4 pb-52 pt-2 lg:pb-0">   // 최상위: 일반 문서 흐름
  [상단 바] [UsageIndicator] [헤더 카드] [에러 배너]        // ← 부모의 좁은 중앙 폭
  <div className={cn(
    'hidden lg:grid lg:grid-cols-[1fr_360px]',
    'lg:ml-[calc(50%-50vw)] lg:w-screen lg:px-4',          // ← full-bleed, 화면 전체 폭
    'lg:sticky lg:top-2 lg:h-[calc(100dvh-1rem)]',         // ← sticky + 뷰포트 높이
  )}>
```

**① 폭이 어긋난다.** 상단 블록들은 중앙 좁은 컬럼, 2단 그리드만 `w-screen` full-bleed.
좌우 정렬선이 두 개가 되어 화면이 어긋나 보인다. David 가 지적한 "위아래 정렬".

**② 페이지에 불필요한 세로 스크롤이 생긴다.**
2단 그리드가 `h-[calc(100dvh-1rem)]` 로 뷰포트 높이를 통째로 쓰는데,
그 **위에** 상단 바·사용량·헤더 카드가 문서 흐름으로 쌓여 있다.
→ 문서 전체 높이 = 상단 높이 + 100dvh → 첫 화면에서 2단의 아래쪽이 잘린다.
`sticky` 는 스크롤 후 붙게 할 뿐 이 초과분을 없애지 못한다.

**③ 토론 시작 버튼이 화면 밖에 있다.**
`DirectorConsole` 맨 아래(`border-t pt-3` 블록)의 `DebateControls` 안에 있는데,
②때문에 초기 화면에서 스크롤해야 보인다. 정작 사용자의 시선은
"토론 시작을 누르면 이곳에 대화가 이어집니다" 라는 **빈 피드 중앙**에 있다.

---

## §A 앱 셸로 전환 — 페이지 스크롤 제거

`sticky` + `100dvh` 조합을 걷어내고, **lg 이상 세션 룸에서 공통 셸부터 화면
전체를 세로 flex 셸**로 만든다. 세션 페이지는 `MainChrome` 안에 있으므로 페이지
자체에 `100dvh`를 주면 공통 헤더·푸터 높이만큼 문서가 넘친다.

```
lg 이상:
  MainChrome 최상위   h-screen
  MainChrome main     flex flex-1 min-h-0 flex-col pb-0
  세션 페이지         flex flex-1 min-h-0 flex-col overflow-hidden
  상단 블록들         shrink-0            (상단 바 · 사용량 · 헤더 카드 · 에러 배너)
  2단 그리드          flex-1 min-h-0      (남은 높이 전부)
```

- `MainChrome`의 셸 변경은 정확히 `/session/[id]` 세션 룸에만 적용한다.
  `/session/new`와 `/session/[id]/summary`는 제외한다.
- 페이지 자체는 스크롤되지 않는다. 스크롤은 **좌측 피드 컨테이너 안에서만** 일어난다
  (이미 `overflow-y-auto` 가 있다).
- `lg:sticky lg:top-2 lg:h-[calc(100dvh-1rem)]` 는 제거한다.
- **lg 미만은 현행 그대로** — `pb-52 pt-2` 와 문서 흐름 스크롤을 유지한다.
  최상위 클래스는 `lg:` 접두로만 바꿔라.

## §B 폭 정렬 — 하나의 정렬선으로

`lg:ml-[calc(50%-50vw)] lg:w-screen` full-bleed 를 **걷어낸다.**
2단 그리드가 상단 블록들과 같은 컨테이너 폭을 쓰게 한다.

넓은 화면에서 너무 늘어지지 않도록 세션 룸의 `MainChrome` 셸에
`lg:max-w-[1600px]` 상한을 둔다. 기존 `mx-auto`는 유지한다. 세션 페이지는
공통 셸의 폭을 그대로 쓰며, 로고 헤더·상단 블록·2단 그리드가 **같은 좌우
정렬선**을 갖는 것이 이 항목의 합격 조건이다.

## §C 토론 시작 CTA — 시선이 있는 곳으로

`phase === 'idle'` 일 때 **빈 피드 중앙에 기본 CTA 를 둔다.**

- `DebateFeed` 의 `emptyHint` 자리에 문구와 함께 "토론 시작" 버튼을 배치한다.
  문구는 유지하고 그 아래 버튼을 놓는다.
- `DirectorConsole` 하단의 기존 `DebateControls` 는 **그대로 둔다** — 중복이 아니라
  §A 이후 항상 보이는 자리이며, 재생·속도 등 다른 컨트롤이 함께 있다.
- 자동 스크롤은 넣지 마라.
- `idle` 이 아닌 상태에서는 이 CTA 를 렌더하지 않는다.

T-2 §B(결론 CTA 하단 배치)와 같은 원칙이다 — 시선이 머무는 곳에 행동을 둔다.

---

## §D 하지 말 것

- **lg 미만(모바일 챗) 레이아웃 무수정.** 브레이크포인트 값 1024(`lg`)도 바꾸지 마라.
- `lib/prompts/*` · `store/usage.ts` · `lib/ai/*` 무수정 (T-1·T-2·T-3 완료분).
- `components/access/*` · `components/embed/EmbedBridge.tsx` 무수정.
- `DebateFeed` 의 메시지 렌더링 로직·핀·타이핑 연출 무수정. `emptyHint` 주변만 손댄다.
- 색·타이포·간격 등 디자인 토큰 변경 금지. 이 워크오더는 **배치**만 다룬다.
- 새 의존성 추가 금지.

## §E 합격선

1. `pnpm typecheck` · `pnpm build` 통과.
2. 1024px 이상: **페이지 세로 스크롤이 없다.** 스크롤은 좌측 피드 안에서만.
3. 1024px 이상: 상단 블록과 2단 그리드의 좌우 정렬선이 일치한다.
4. 1024px 이상 `idle` 상태: **스크롤 없이 토론 시작 버튼이 보인다** (피드 중앙 + 우측 콘솔 둘 다).
5. 1023px 이하: 현행과 픽셀 단위로 동일하다 (하단 입력바·문서 스크롤 유지).
6. 브라우저 창을 1024 경계로 넘나들 때 레이아웃이 깨지지 않는다.
7. 홈(`/`)·설정(`/settings`)·요약(`/session/[id]/summary`)이 현행과 동일하다.

## §F 검증 (David 손)

Chrome 창을 넓게(1440 이상) 두고 세션 진입 → 스크롤 없이 토론 시작이 보이는지,
상단과 아래 패널의 좌우 끝이 맞는지. 그다음 창을 1024 아래로 좁혀
그저께 쓰던 모바일 챗 화면이 그대로 나오는지 회귀 확인.
