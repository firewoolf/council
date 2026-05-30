# 작업 의뢰서 — 트랙 ③: 카드별 디렉션 (감독 메타포의 진짜 실현)

> 담당: Claude Code (Sonnet)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `roadmap.md` 트랙 ③, `workorder-debate-5-1-followup-speed-waiting.md` (⑤-1f-C 출하 완료)
> 선행 상태: 트랙 ⑤-1·⑤-2·⑤-5a-1 출하, Phase E 출하. 사용자 *대기 메모* 와 *시그널/발언* 메커니즘이 작동 중. ⑤-1f-C 의 transcript 주입 패턴을 *타깃 명시 디렉션* 으로 확장한다.

---

## 0. 한 줄 목표

발언 카드를 누르면 **그 사람·그 발언·다른 사람·사용자 자신** 에게 *디렉션* 을 보낼 수 있게 한다. 사용자가 *채팅 참여자* 에서 **회의 감독** 으로 전환되는 시각·인터랙션 변화의 핵심.

---

## 1. 배경 — *결정 도구* 의 정수

`roadmap.md` 트랙 ③: *"개입을 글로벌 입력창 → 발언 카드별 디렉션으로. 카드 누르면 '이 사람에게: 더 세게 / 근거 대봐 / 저 사람한테 반박시켜 / 사용자에게 질문해'. *감독* 메타포(CLAUDE.md ❶)를 실제로 살림."*

2026-05-26 가상 토론에서 잡스가 강조: *"사용자의 역할이 '감독' 으로 바뀌어야 해요. 채팅을 보는 게 아니라 *연출* 을 보고 *다음 장면을 고르는* 사람이 돼야 합니다. ChatGPT 와의 차이가 거기에 있어요."*

⑤-1f-C 의 *시그널 메모* 는 *방향 시그널* 일 뿐 — 패널 *전체에게 던지는 가이드* 였다. 트랙 ③ 은 **그 시그널을 *특정 카드·특정 사람* 에게 박는다.** 사용자가 *누구* 의 *어떤 발언* 을 *어떻게 비틀고 싶은지* 명시.

---

## 2. 절대 원칙

1. **디렉션은 발언이 아니다** — 사용자 메시지로 회의록에 추가되지 않는다. 다음 청크 생성 시 `transcript` 끝에 **시스템 지시** 로 1회 주입되고 비워진다. ⑤-1f-C 의 *시그널 모드* 와 동일 채널, 다른 형태.
2. **굴복 금지 불변** — 디렉션도 페르소나에게 *압력* 일 뿐, 패널은 자기 입장을 *지킨다*. 페르소나가 디렉션을 받아 *굴복하면* 트랙 ① 의 본질이 깨진다 — `CHUNK_SYSTEM_PROMPT` 의 굴복 금지가 디렉션도 받아낸다.
3. **모바일 퍼스트** — 카드 long-press 또는 카드 우상단 ⋯ 메뉴 (둘 다 지원). 모바일에서 long-press 가 자연.
4. **디렉션 가독성** — 사용자가 *내가 무슨 디렉션을 보냈는지* 항상 알 수 있어야. 디렉션 카드 또는 토스트 + 다음 청크 생성 후 *이 디렉션이 반영됐는지* 시각적으로 확인 가능.
5. **자율 스크롤·재생·SteeringPanel·WaitingMemoArea 회귀 금지** — 트랙 ⑤-1/⑤-2 출하분 그대로 작동.

---

## 3. 작업 범위 — A~E

### A. 신규 컴포넌트 — `DirectionMenu`

`components/debate/DirectionMenu.tsx` 신규.

```tsx
export type DirectionAction =
  // 이 사람에게
  | { kind: 'tighten'; targetMemberId: string; targetMessageId: string }      // 더 세게 말해줘
  | { kind: 'specify'; targetMemberId: string; targetMessageId: string }      // 근거 더 구체적
  | { kind: 'reframe'; targetMemberId: string; targetMessageId: string }      // 다른 각도에서 다시
  // 다른 사람에게 반박시켜
  | { kind: 'rebut';   targetMemberId: string; targetMessageId: string; byMemberId: string }
  // 사용자에게 질문하게
  | { kind: 'ask-user'; targetMemberId: string; targetMessageId: string };

interface DirectionMenuProps {
  /** 이 디렉션의 대상 발언 (= 클릭된 카드) */
  message: Message;
  /** 그 발언의 화자. 사용자 발언이면 null (이 경우 메뉴 비활성). */
  speaker: CastMember | null;
  /** 패널 전원 — 'rebut' 의 byMember 선택용. */
  cast: readonly CastMember[];
  /** 메뉴 위치 — 카드 우상단 anchor 기준 absolute 배치. */
  open: boolean;
  onClose: () => void;
  onSubmit: (action: DirectionAction) => void;
}
```

레이아웃:
- 모바일: 카드 위로 띄우는 *floating panel* (anchor + portal 불필요, position absolute z-30).
- 데스크탑: 같은 floating panel.
- 외부 클릭·ESC 닫기.

내부 구조:

```
┌─────────────────────────────────────┐
│   ➜ 이 사람에게                      │
│     · 더 세게 말해줘                  │  → onSubmit({ kind:'tighten', ... })
│     · 근거 더 구체적으로              │
│     · 다른 각도에서 다시              │
│   ──────────────────                 │
│   ➜ 누군가에게 반박시켜               │  → byMember 선택 후 'rebut'
│     [▼ 멤버 선택 드롭다운]            │
│   ──────────────────                 │
│   ➜ 사용자에게 질문하게               │  → 'ask-user'
└─────────────────────────────────────┘
```

각 항목은 `<button>`. 'rebut' 만 byMember 선택 단계 추가 (인라인 expand 또는 sub-menu).

### B. `MessageCard` 통합

`components/debate/MessageCard.tsx` 갱신:

- 페르소나 발언 카드 (사용자/메타지시 제외) 에 **long-press 핸들러** + **카드 우상단 작은 `⋯` 버튼** 둘 다 추가.
- 클릭 → `setMenuOpen(true)`. 메뉴는 `<DirectionMenu />` 로 렌더.
- 사용자 발언 카드·메타지시 카드는 디렉션 메뉴 없음.

long-press 구현: `useLongPress` 훅 신규 (`hooks/useLongPress.ts`). 500ms 누름 → 콜백. 모바일 / 데스크탑 둘 다 작동 (mouse + touch events).

### C. 디렉션 시각 시그널 — 카드에 누적 표시

같은 카드에 디렉션이 이미 보내져 있으면 카드 우상단에 **작은 배지** (예: ✦ 또는 작은 점) + 디렉션 수 표시. 사용자가 *내가 뭘 보냈는지* 확인.

`MessageCard` props 에 `directionCount?: number` 추가. `DebateFeed` 또는 부모가 `useDebate` 의 `pendingDirections` 로부터 메시지별 카운트 계산해 전달.

### D. `useDebate.submitDirection` 액션

`hooks/useDebate.ts` 갱신:

```tsx
// pendingDirections — generating 직전까지 누적, 다음 청크 생성 시 transcript 에 주입 후 비움.
const pendingDirectionsRef = useRef<DirectionAction[]>([]);

const submitDirection = useCallback((action: DirectionAction) => {
  pendingDirectionsRef.current = [...pendingDirectionsRef.current, action];
  // 시각 피드백
  toast.success(getDirectionLabel(action));
}, []);
```

청크 생성 useEffect 안 (현재 `pendingMemoRef` 처리하는 곳 옆에) 추가:

```tsx
const directions = pendingDirectionsRef.current;
pendingDirectionsRef.current = [];
const directionBlock = directions.length > 0
  ? `\n[감독의 디렉션 — 다음 장면에 반영]\n${directions.map(formatDirection).join('\n')}`
  : '';
const transcript = baseTranscript + memoBlock + directionBlock;
```

`formatDirection` 헬퍼 (별도 함수, lib/prompts/orchestrator.ts 또는 useDebate 안):

```tsx
function formatDirection(action: DirectionAction, cast: CastMember[]): string {
  const target = cast.find(c => c.id === action.targetMemberId)?.name ?? '???';
  switch (action.kind) {
    case 'tighten':  return `- ${target} 에게: 다음 발언을 *더 세게* — 에두르지 말고 직설적으로.`;
    case 'specify':  return `- ${target} 에게: 근거를 *더 구체적* 으로 — 숫자·사례·시나리오 필수.`;
    case 'reframe':  return `- ${target} 에게: 같은 입장이지만 *다른 각도* 에서 다시 — 새 프레임.`;
    case 'rebut': {
      const by = cast.find(c => c.id === action.byMemberId)?.name ?? '???';
      return `- ${by} 가 ${target} 의 위 발언에 *정면 반박* 하도록 — 가장 약한 지점을 찌른다.`;
    }
    case 'ask-user': return `- ${target} 가 사용자에게 *날카로운 질문* 을 던지도록 — 사용자가 못 본 가정을 흔든다.`;
  }
}
```

### E. UI 노출 — DebateFeed 배선

`components/debate/DebateFeed.tsx` 갱신:

- `useDebate` 의 `pendingDirections` 도 노출 → DebateFeed 가 메시지별 `directionCount` 계산 → MessageCard 에 전달.
- `MessageCard` 안에서 `DirectionMenu` 마운트는 카드 내부 state (`menuOpen`) 로 관리.
- `onSubmit` 콜백은 `useDebate.actions.submitDirection`. DebateFeed 가 prop 으로 받아 MessageCard 에 전달.

---

## 4. 영향 파일 맵

```
신규:
  components/debate/DirectionMenu.tsx
  hooks/useLongPress.ts
  (선택) lib/prompts/directions.ts          formatDirection 헬퍼

갱신:
  hooks/useDebate.ts                         pendingDirectionsRef, submitDirection 액션,
                                              transcript 주입 (memo 옆)
  components/debate/MessageCard.tsx          long-press + ⋯ 버튼 + DirectionMenu 마운트 +
                                              directionCount 배지
  components/debate/DebateFeed.tsx           pendingDirections → directionCountByMessage 계산,
                                              MessageCard 에 onDirect / count prop drilling
  app/(main)/session/[id]/page.tsx           actions.submitDirection 을 DebateFeed 에 전달
  types/debate.ts                            (선택) DirectionAction 타입 — 또는 DirectionMenu 안 export
```

총 6~7개 파일 (신규 2~3 + 갱신 4).

---

## 5. 손대지 말 것

- `lib/prompts/*` 의 `CHUNK_SYSTEM_PROMPT`·`buildChunkPrompt`·directive 본문 — 그대로. 디렉션은 *transcript 안 시스템 지시* 로만 들어감. 시스템 프롬프트 자체는 변경 X.
- `BASE_PROMPT`·`OUTPUT_HINT`·8 directive — 절대 금지.
- 자율 스크롤 (`NEAR_BOTTOM_PX`, `unreadCount`) — 유지.
- SteeringPanel / WaitingMemoArea / PersonaStageStrip / PersonaDetailDrawer — 회귀 없도록.
- `sanitizeChunk` 의 ✦ 보정 — 무관.
- generated/custom 멤버 처리 — 디렉션 대상 가능 (cast.id 기반이라 자연 동작).
- 어드민 / data — 무관.

---

## 6. 검증 기준

### 6.1 자동 검증

- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` 통과.
- [ ] 옛 LocalStorage 세션 회귀 — `pendingDirectionsRef` 가 ephemeral 이라 새로고침 시 초기화. 데이터 모델 변경 0.

### 6.2 사람 검증

- [ ] 페르소나 발언 카드 long-press (or ⋯ 클릭) → DirectionMenu 등장. 사용자 카드·메타지시 카드는 메뉴 없음.
- [ ] *더 세게* / *근거 더 구체적* / *다른 각도* / *반박시켜* / *질문하게* 5개 액션 모두 전송 가능.
- [ ] 디렉션 전송 시 토스트 + 카드 우상단 카운트 배지 (✦×N 또는 작은 점).
- [ ] 다음 청크 생성 시 transcript 끝에 `[감독의 디렉션]` 블록 주입 — 패널이 *그 디렉션을 반영* 한 발언을 함 (확인: tighten 보내면 다음 발언이 직설적, specify 보내면 숫자 등장).
- [ ] 디렉션 전송 후 generating → playing 전환되면 pendingDirections 비워짐 (다음 청크는 깨끗).
- [ ] **굴복 금지 유지** — tighten/rebut 같은 압력 디렉션을 보내도 패널이 *자기 입장* 을 지킴. 사용자에게 *맞춰주는* 발언이 나오면 트랙 ① 본질 깨짐 → 즉시 보고.
- [ ] ESC / 외부 클릭으로 DirectionMenu 닫힘.

---

## 7. 출하 단위 — 두 묶음

### ③-a. DirectionMenu + transcript 주입 (블로킹, 핵심)

§3-A + §3-B (long-press 제외 ⋯ 메뉴만 1차) + §3-D + §3-E. 가장 가벼움. *카드 클릭 → 디렉션 → 다음 청크 반영* 흐름이 작동하면 출하.

### ③-b. long-press + 카드 카운트 배지 (UX 완성)

§3-B (long-press 추가) + §3-C (배지). 모바일 UX 폴리시.

---

## 8. 완료 후

- `backlog.md` Active 의 트랙 ③ 줄 → Done.
- 다음 트랙 결정: ② 결정 지도형 결론 / ④ 거울 / ⑤-5b 인트로 컷신 / ⑤-5a-2 ★ 게이지.

---

## 부록 A — formatDirection 본문 (Opus 박제 — 임의 작성 금지)

`lib/prompts/directions.ts` 또는 `useDebate` 안:

```ts
export function formatDirection(
  action: DirectionAction,
  cast: readonly CastMember[],
): string {
  const find = (id: string) => cast.find((c) => c.id === id)?.name ?? '???';
  const target = find(action.targetMemberId);
  switch (action.kind) {
    case 'tighten':
      return `- "${target}" 에게: 다음 발언을 *더 세게* 만들 것. 에두르지 말고 직설적으로 — 핵심 단언 하나를 박아라.`;
    case 'specify':
      return `- "${target}" 에게: 근거를 *더 구체적* 으로 — 추정치라도 숫자·사례·시나리오 중 최소 하나를 박을 것.`;
    case 'reframe':
      return `- "${target}" 에게: 같은 입장을 *다른 각도* 에서 다시 — 새 프레임으로 같은 결론을 재구성하라.`;
    case 'rebut': {
      const by = find(action.byMemberId);
      return `- "${by}" 가 "${target}" 의 위 발언에 *정면 반박* 하도록 — 가장 약한 지점을 찌른다. 'rebut' 의 본질은 *논리의 공격* 이지 인신공격이 아니다.`;
    }
    case 'ask-user':
      return `- "${target}" 가 사용자에게 *날카로운 질문* 을 던지도록 — 사용자가 못 보았던 가정을 흔드는 한 줄.`;
  }
}
```

이 본문 그대로 박제. Sonnet 임의 수정 금지. 굴복 금지 가드("인신공격이 아니다" 등) 가 본문 안에 포함돼 있어 페르소나가 디렉션을 받아도 *자기 입장* 을 지킨다.

---

## 부록 B — `DirectionMenu` UI 디테일

- 액션 라벨 한국어:
  - tighten = "더 세게 말해줘"
  - specify = "근거 더 구체적으로"
  - reframe = "다른 각도에서 다시"
  - rebut   = "반박시키기"
  - ask-user= "사용자에게 질문"
- 그룹 헤더: "이 사람에게" / "누군가에게 반박시켜" / "사용자에게 질문하게"
- 아이콘 (lucide-react):
  - tighten: `Flame`
  - specify: `Hash`
  - reframe: `RotateCcw`
  - rebut: `Swords`
  - ask-user: `HelpCircle`
- rebut 의 byMember 선택은 *인라인 expand* — 같은 메뉴 안에 멤버 칩 가로 스크롤.
