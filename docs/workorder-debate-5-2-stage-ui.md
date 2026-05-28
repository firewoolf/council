# 작업 의뢰서 — 트랙 ⑤ Phase ⑤-2: 스테이지 UI + 페르소나 필터 + 회의실 백그라운드

> 담당: Claude Code (Sonnet)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `workorder-debate-5-1-chunk-engine.md` (출하 후), `roadmap.md` 트랙 ③ Phase 1 + 트랙 ⑤-2
> 선행 상태: 트랙 ⑤-1 청크 엔진 출하 완료. 청크 재생은 작동하지만 *시각적 연극감*·*화자 식별*·*몰입감* 부족.

---

## 0. 한 줄 목표

채팅 메타포 위에 **회의실 메타포** 의 시각 레이어를 얹는다. 사용자는 *지금 누가 말하는지* 한 점 (orb) 으로 알아보고, 한 페르소나의 발언만 따로 모아 볼 수 있고, 회의실에 *앉아있는 느낌* 을 받는다.

---

## 1. 배경 — 트랙 ⑤-1 출하 후 사용자 피드백 (2026-05-26)

> "각 페르소나별로 대화하는것이 잘 보이지 않고, 헷갈린다."
> "페르소나 프로필을 이모티콘같은 형태나 이미지 형태로 만들어서, 사람들이 대화를 하는 것처럼, 실제 회의실에서 얘기하는 백그라운드를 보여줘서 몰입감을 높이고 시각적인 효과를 주면 좋겠다."
> "각 페르소나별로 아이콘을 누르거나 했을때 각 페르소나별 발언 내용을 모아서 보여주는 것을 만들어보자."

세 개의 피드백이 *같은 한 가지* 를 가리킨다 — **"회의실 메타포" 를 화면에 시각화** 하라. 트랙 ⑤-1 이 *토론의 단위* 를 청크로 격상했다면, 트랙 ⑤-2 는 *토론의 표현* 을 채팅에서 *연극 무대* 로 격상한다.

본 워크오더는 `roadmap.md` 트랙 ⑤-2 (시인성·화자 식별) 본체 + 트랙 ③ Phase 1 (살아있는 스테이지 UI — 편입 명시) + 신규 *페르소나별 필터* + 신규 *회의실 백그라운드* 를 통합한다.

---

## 2. 절대 원칙

1. **모바일 퍼스트 유지** — 스테이지 UI 는 *데스크탑 전용 원형 테이블* 이 아니다. 모바일에서도 작동해야 한다. sticky orb 줄은 가로 스크롤 가능, 백그라운드는 *세로 흐름* 을 깨지 않는다.
2. **자율 스크롤 유지** — 트랙 ⑤-1 의 `DebateFeed` 자율 스크롤(NEAR_BOTTOM_PX, unreadCount 배지) 은 *그대로 작동* 해야 한다. 스테이지 UI 가 자동 점프를 다시 들이지 말 것.
3. **굴복 금지 불변** — 시각 변화이지 프롬프트 변화 아님. `BASE_PROMPT`·`CHUNK_SYSTEM_PROMPT` 손대지 말 것.
4. **시각 효과는 *이해를 도와야* 한다** — 스펙터클이 목적이 아님 (`roadmap.md` 트랙 ③ 원칙). orb 가 살아나는 건 *지금 그 사람이 말하고 있다* 는 정보를 전달하는 것이지 화려함을 위함이 아니다.
5. **퍼포먼스** — `useDebate` 의 재생 엔진은 이미 setTimeout 기반. 추가 애니메이션은 *CSS 만으로* (Tailwind animate 또는 keyframes). JS 애니메이션 라이브러리 도입 금지 — `motion`/`framer-motion` 은 트랙 ⑤-4 영역.
6. **B-2 §5.7 cast 단일 진실 공급원 유지** — 모든 시각 표현은 `CastMember` 의 `name`·`colorFrom`·`colorTo`·`temperament` 만 본다. `PERSONA_MAP` 라이브 조회 금지.

---

## 3. 작업 범위 — A~F

### A. 신규 컴포넌트 — `PersonaStageStrip` (상단 sticky orb 줄)

`components/debate/PersonaStageStrip.tsx` 신규.

```tsx
interface PersonaStageStripProps {
  cast: readonly CastMember[];
  /** 지금 발화 중인 멤버 (재생 중인 turn 의 speakerId). null 이면 무대 정적. */
  activeSpeakerId: string | null;
  /** "준비 중" 인디케이터 — 청크 생성 중일 때 표시할 멤버 (옵션). */
  thinkingMemberId: string | null;
  /** orb 클릭 → 페르소나 필터 드로어 열기. */
  onSelect: (memberId: string) => void;
}
```

레이아웃:
- 회의실 상단 sticky. `z-10` 또는 `z-20` (자율 스크롤 배지 `z-20` 과 동위).
- 패널 전원의 orb 를 한 줄 가로 배치 (모바일: 가로 스크롤). 사회자는 가운데.
- **activeSpeakerId** orb 는 **확대 1.15x + glow strong + 미세 맥동 (CSS pulse, 1.5s)**. 다른 orb 는 *비활성 inactive*.
- **thinkingMemberId** orb 는 *점 3개 위 부유* (CSS `::after` translate-y bounce, 0.6s 반복). 글로우 medium.
- 비활성 orb 도 *클릭 가능* — 클릭 시 `onSelect(memberId)` → PersonaDetailDrawer 열림.
- 각 orb 아래 페르소나 이름 작게(`text-[10px]`, 한 줄 truncate, max-w 80px).
- 모바일에서 orb 5개 이상이면 가로 스크롤. snap-x 적용.

### B. `PersonaOrb` 강화 — 살아남 모드

`components/persona/PersonaOrb.tsx` 갱신. 새 prop:

```tsx
interface PersonaOrbProps {
  // ...기존...
  /** 'idle' (정적) | 'speaking' (활성·맥동) | 'thinking' (준비 중·부유) */
  state?: 'idle' | 'speaking' | 'thinking';
}
```

기본값 `'idle'` (기존 동작). `speaking` 은 CSS `animation: orb-pulse 1.5s ease-in-out infinite`, `thinking` 은 `animation: orb-bob 0.6s ease-in-out infinite`. keyframes 는 `app/globals.css` 에 추가:

```css
@keyframes orb-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 var(--pulse-soft); }
  50%      { transform: scale(1.08); box-shadow: 0 0 var(--pulse-strong); }
}
@keyframes orb-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
```

기존 `glow` prop 과 호환 — `state==='speaking'` 이면 glow 'strong' 강제, `state==='thinking'` 이면 'soft' 강제.

### C. `DebateFeed` — activeSpeakerId 추출 + StageStrip 배선

`components/debate/DebateFeed.tsx` 변경:

- **activeSpeakerId 도출** — `useDebate` 가 노출하는 `progress.revealed`·`currentChunkTurns` 를 활용. *마지막으로 드러난 turn 의 speakerId* 가 active.
- 단, 한 번 turn 이 드러나면 `PHASE_TRANSITION_TAIL_MS` 동안만 active. 그 후 다음 turn 이 드러나야 갱신.
- → `useDebate` 에 `activeSpeakerId: string | null` 추가 export. 내부 로직: *최근 reveal 된 turn 의 speakerId, 단 다음 turn 의 setTimeout 이 fire 하면 null 또는 다음 speakerId* (모델 구현은 Sonnet 결정).
- DebateFeed 상단에 `<PersonaStageStrip />` 박제. cast / activeSpeakerId / thinkingMemberId 전달.
- thinkingMemberId 는 `phase === 'generating'` 일 때 *대표 멤버 1명* (예: 사회자 또는 첫 멤버). 모델이 누가 발화할지 모르므로 *사회자 1명만 thinking* 으로.

### D. `MessageCard` 시각 차별 강화 — 페르소나별 색·테두리

`components/debate/MessageCard.tsx` 갱신:

- 현재: 좌측 색띠(`borderLeftColor: speaker.colorTo`) 만. 카드 배경은 모두 동일 `bg-surface`.
- 신규:
  - 카드 배경에 *페르소나 색의 alpha 1.5%* 톤 (`background: linear-gradient(135deg, ${speaker.colorFrom}05, transparent 40%)`).
  - 좌측 색띠 두께 4px → 6px (강조). `isKeyPoint` 면 8px.
  - 이름 옆 `temperament 미니 칩` (한국어 라벨, `text-[9px]`). 페르소나 식별 보조.
  - 발화 진행 *직전* 카드 (방금 reveal 된 카드) 는 `animation: card-enter 0.4s ease-out` — 좌측에서 등장. orb 에서 튀어나오는 *연극감*.

```css
@keyframes card-enter {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

기존 `animate-fade-in` 은 *fade 만*. 카드 진입을 *방향성* 있게 바꾼다.

### E. `PersonaDetailDrawer` 신규 — 페르소나별 발언 필터

`components/debate/PersonaDetailDrawer.tsx` 신규.

```tsx
interface PersonaDetailDrawerProps {
  member: CastMember;
  /** 해당 페르소나의 발언만 시간순으로 */
  messages: readonly Message[];
  /** 해당 페르소나가 *반박한* 메시지의 미리보기 — replyTo 가 있는 자기 발언의 대상 */
  conversationCtx: Map<string, { name: string; preview: string }>;
  open: boolean;
  onClose: () => void;
}
```

레이아웃:
- 모바일: 하단에서 올라오는 bottom sheet (`fixed inset-x-0 bottom-0 z-30 max-h-[80vh]`).
- 데스크탑: 우측 사이드 드로어 (`fixed inset-y-0 right-0 z-30 w-[420px]`).
- 헤더: 큰 orb (size 64) + 이름 + 역할 + temperament 라벨 + stance (있으면).
- 본문: 해당 멤버 발언만 *시간순* 으로 카드 리스트. 각 카드:
  - 발언 내용
  - (있다면) "[~~~]에 반박" — replyTo 대상 미리보기
  - 발언이 속한 청크의 topic (작게)
- 푸터: "닫기" 버튼.

호출 경로:
- `PersonaStageStrip` 의 orb 클릭 → 부모(`DebateFeed` 또는 `session/[id]/page`) 가 `selectedMemberId` state 갱신 → drawer open.
- 외부 클릭·ESC 로 닫기.

### F. 회의실 백그라운드 — *라운드 테이블 메타포*

`app/(main)/session/[id]/page.tsx` 의 회의실 본문 영역에 **subtle 백그라운드 레이어** 추가.

방향 (택일):
- **(F-1) 그라디언트 + radial gradient 텍스처** (권장, 가벼움)
  - body 또는 본문 컨테이너에 `background-image: radial-gradient(at top, color-mix(in srgb, var(--surface) 80%, transparent), var(--background))`
  - 또는 fixed background SVG (테이블 윤곽선 같은 미세한 일러스트)
- **(F-2) CSS arc — 라운드 테이블 시각화**
  - 회의실 상단에 큰 `border-radius` 의 ::before 로 *테이블 윤곽* 그리기
  - 패널 멤버 orb 가 그 테이블 *주변에 앉아있는* 느낌
- **(F-3) SVG 일러스트 — 어두운 회의실 메타포** (옵션, 무거움)
  - `public/stage-bg.svg` 또는 inline SVG

**Sonnet 은 F-1 부터 시도** — `app/globals.css` 에 새 CSS 변수 + `app/(main)/session/[id]/page.tsx` 의 최상위 wrapper 에 클래스만 추가. F-2/F-3 은 별도 후속 마일스톤.

배경은 *발언 카드 가독성을 해치지 말 것*. 카드는 항상 명확한 contrast.

---

## 4. 상태·데이터 흐름 — 정리

```
useDebate 가 노출:
  - activeSpeakerId: string | null    ← 신규
  - thinkingMemberId: string | null   ← 신규 (generating 중 사회자)
  - chunks, messages, revealedMessages ← 기존

session/[id]/page.tsx:
  - selectedMemberId: string | null   ← 신규 state (drawer open 추적)
  - PersonaStageStrip 에 active/thinking 전달
  - PersonaStageStrip 의 onSelect → setSelectedMemberId
  - PersonaDetailDrawer 에 messages.filter(m => m.speakerId === selectedMemberId) 전달

DebateFeed:
  - 자율 스크롤 유지
  - MessageCard 의 card-enter 애니메이션은 *방금 reveal 된 카드만* — 부모가 prop 으로 시그널 또는 카드 자체가 mount 시 1회 발동
```

---

## 5. 영향 파일 맵

```
신규:
  components/debate/PersonaStageStrip.tsx
  components/debate/PersonaDetailDrawer.tsx

갱신:
  components/persona/PersonaOrb.tsx          state prop 추가, speaking/thinking 모션
  components/debate/MessageCard.tsx          temperament 미니 칩, 페르소나 배경 그라디언트, card-enter 모션
  components/debate/DebateFeed.tsx           StageStrip 배선, activeSpeakerId 받아 prop drilling
  hooks/useDebate.ts                         activeSpeakerId / thinkingMemberId 노출
  app/(main)/session/[id]/page.tsx           selectedMemberId state + Drawer 마운트 + 회의실 백그라운드
  app/globals.css                             @keyframes orb-pulse / orb-bob / card-enter 추가, --stage-bg 변수
```

총 8개 파일 (신규 2 + 갱신 6).

---

## 6. 손대지 말 것

- `lib/prompts/*`, `lib/ai/*` — 프롬프트·LLM 호출 로직. **트랙 ⑤-2 는 순수 시각 레이어**.
- `store/sessions.ts` — 데이터 모델. 손대지 말 것.
- `sanitizeChunk` 의 ✦ 보정 — 시각 레이어와 무관.
- `BASE_PROMPT`, `OUTPUT_HINT`, `temperamentDirectives` — 절대 금지.
- 트랙 ⑤-1 의 자율 스크롤 로직(`NEAR_BOTTOM_PX`, `unreadCount`) — *유지*. 자동 점프 강제 도입 금지.
- 모션 라이브러리 (motion/framer-motion) — 트랙 ⑤-4 영역.
- 데스크탑 전용 원형 테이블 토글 뷰 — 트랙 ③ Phase 3 (별도 워크오더).
- ConcernInput 입력 가이드 — 트랙 ⑤-3.

---

## 7. 검증 기준

### 7.1 자동 검증

- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` 통과.
- [ ] `PersonaOrb` 의 `state` prop 이 *기존 호출처 (RecentSessions, history, picker)* 를 깨지 않음 — `state` 는 옵셔널, 기본값 `'idle'`.

### 7.2 사람 검증

- [ ] 청크 재생 중 *지금 말하는 사람* orb 가 즉시 식별됨 (확대·맥동).
- [ ] `generating` 중 *대표 멤버* orb 가 thinking 모션 (부유).
- [ ] orb 클릭 → PersonaDetailDrawer 등장. 해당 페르소나 발언만 시간순.
- [ ] 모바일에서 sticky orb 줄이 가로 스크롤 (snap), Drawer 가 bottom sheet 로 등장.
- [ ] MessageCard 가 페르소나별로 *배경 톤·테두리 두께·미니 칩* 으로 구분됨.
- [ ] 새 turn 이 reveal 될 때 카드가 *좌측에서 등장* 하는 모션 (card-enter).
- [ ] 회의실 본문에 *백그라운드 톤* 이 들어가되 발언 카드 가독성은 그대로.
- [ ] 자율 스크롤 ↓ 배지가 그대로 작동 (트랙 ⑤-1 회귀 확인).

---

## 8. 출하 단위 — 두 묶음

### ⑤-2a. 스테이지 + 시인성 (블로킹)

§3 A·B·C·D + 필요 만큼의 §3-E (orb 클릭 → drawer 열림 배선) + `useDebate` 갱신. 출하 시 *지금 말하는 사람* 이 보이는 게 첫 사용자 가치.

### ⑤-2b. 페르소나 필터 + 백그라운드

§3 E (Drawer 본체) + §3 F (백그라운드). a 출하 후 진입.

분리 이유: a 만 출하해도 *시인성* 이 즉시 개선됨. b 는 폴리시·몰입감이라 후속.

---

## 9. 완료 후

- `backlog.md` Active 의 트랙 ⑤-2 → Done. 트랙 ③ Phase 1 흡수 명시.
- 트랙 ⑤-3 (입력 템플릿), ⑤-4 (재생 폴리시·모션) 는 별도 워크오더 — 사용자 피드백 보고 결정.
- 트랙 ③ Phase 2 (카드별 디렉션) 는 트랙 ② (결정 지도형 결론) 이후로.

---

## 부록 — Tailwind/CSS 토큰 가이드

`app/globals.css` 에 추가:

```css
:root {
  --pulse-soft: 18px var(--accent);
  --pulse-strong: 32px var(--accent);
  --stage-bg: radial-gradient(circle at 50% -20%, color-mix(in srgb, var(--surface) 50%, transparent), transparent 70%);
}

@keyframes orb-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 var(--pulse-soft); }
  50%      { transform: scale(1.08); box-shadow: 0 0 var(--pulse-strong); }
}
@keyframes orb-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
@keyframes card-enter {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

`tailwind.config.ts` 의 `extend.animation` 에 한 줄씩 추가:

```ts
animation: {
  'orb-pulse': 'orb-pulse 1.5s ease-in-out infinite',
  'orb-bob':   'orb-bob 0.6s ease-in-out infinite',
  'card-enter':'card-enter 0.4s ease-out',
}
```
