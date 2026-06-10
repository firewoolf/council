# 작업 의뢰서 — 트랙 R-1: 무대 단일화 (뺄셈 스프린트)

> 담당: Claude Code (Sonnet) — 구현
> 작성: Fable (설계)
> 검수: Opus (PR 검수) / 운영자 (모바일 실기기 시각 검수)
> 대상 레포: `council/`
> 선행 문서: `meeting-2026-06-10-ui-replan.md` §2-A·§2-B·§5, `plan-2026-06-10-role-split.md`
> 선행 상태: ⑤-2a/b·⑤-5g·⑤-5h 출하 상태. **P-A(프롬프트)와 병행 가능** — 본 워크오더는 LLM·프롬프트 코드 불가침.

---

## 0. 한 줄 목표

한 화면에 3중으로 쌓인 화자 표시 시스템을 무대(DebateStage) 하나로 단일화하고, 대화록 경로를 1개로 줄인다. **기능 추가 0, 철거와 통합만.**

## 1. 배경 — 진단 (2026-06-10 코드 검증)

`app/(main)/session/[id]/page.tsx` 현재 상태:

- 화자 표시 3중: `DebateStage`(⑤-5h 무대) + `DebateFeed` 내장 `SpeakerSpotlight`(⑤-5g) + `PersonaStageStrip`(⑤-2a). 무대 아래 `<details>`를 펼치면 무대와 스포트라이트가 동시에 보인다.
- `DebateFeed` 3곳 렌더: ① `stageActive`시 `<details>` 대화 기록 ② 풀스크린 대화록 오버레이(`transcriptOpen`) ③ 비재생 phase 본문.
- 로컬 useState 6개: `headerOpen / soundMuted / selectedMemberId / bgPickerOpen / transcriptOpen` + phase별 화면 골격 분기(`stageActive` 삼항).

레이어가 대체 없이 누적된 결과다(⑤-2 → ⑤-5g → ⑤-5h). 이번 작업은 ⑤-5g를 철거하고 ⑤-2a를 무대 안으로 흡수한다.

## 2. 절대 원칙

1. **LLM·프롬프트·훅 불가침** — `hooks/useDebate.ts`, `lib/ai/**`, `lib/prompts/**` 수정 금지 (P-A·R-2와 충돌 방지). useDebate의 반환 인터페이스를 그대로 소비한다.
2. **기능 추가 금지** — 이 워크오더는 뺄셈이다. 새 인터랙션·새 설정·새 모션을 넣지 않는다. (자동 펼침 한 가지만 예외 — §3-D)
3. **기존 동작 자산 보존** — DebateFeed의 자동 스크롤 자율화(배지), 청크 그루핑, 시그니처 첫 발언 표시, MessageCard 디렉션 메뉴는 그대로 작동해야 한다.
4. **모바일 퍼스트** — 모든 변경은 375px 기준으로 우선 확인.
5. **CSS only** — 애니메이션 라이브러리 도입 금지 (기존 원칙).

## 3. 작업 범위

### A. `DebateStage` — orb 줄 흡수 + 항상 표시

`components/debate/DebateStage.tsx` 확장:

```ts
interface DebateStageProps {
  cast: readonly CastMember[];            // ★신규 — orb 줄
  speaker: CastMember | null;
  mode: 'speaking' | 'thinking' | 'idle' | 'concluded';  // ★ idle/concluded 추가
  line?: string;
  signatureLine?: string;
  backgroundId: string;
  activeSpeakerId?: string | null;        // ★신규 — orb 줄 상태
  thinkingMemberId?: string | null;       // ★신규
  onSelectMember?: (id: string) => void;  // ★신규 — orb 클릭 → 드로어
  onAdvance?: () => void;
  onOpenBackground: () => void;
  // onOpenTranscript 삭제 ★ — 회의록은 무대 아래 고정 패널 (§D)
}
```

- **orb 줄**: 무대 *내부* 상단에 가로 배치 — 현재 `PersonaStageStrip`의 렌더 로직(PersonaOrb + 이름 + speaking/thinking 상태 + inactive 흐림 + 가로 스크롤 snap)을 옮겨온다. 무대 배경 위 오버레이이므로 래퍼 스타일만 교체: `bg-black/30 backdrop-blur rounded-full px-3 py-2` 톤의 떠 있는 줄, sticky 아님 (무대 자체가 화면 상단).
- **idle 모드** (재생 전): 배경 + 캐스트 orb들을 중앙에 단체샷 배치(`PersonaOrb` size 56, 겹침 없이 flex-wrap) + 하단에 "패널이 모였습니다 — 토론 시작을 누르세요" 한 줄. 컷아웃·대사 박스 없음.
- **concluded 모드**: idle과 동일 골격 + 안내 문구 "토론이 종결되었습니다". (결론 배너·summary 링크는 페이지 영역 — 무대가 중복 안내하지 않는다.)
- speaking/thinking 동작은 현행 유지 (컷아웃 폴백 체인, 대사 박스 탭=skipTurn, 준비 중 배지).
- 우상단 버튼: 배경 변경 1개만 잔존 (대화록 버튼 삭제).

### B. `SpeakerSpotlight` 폐기 + `PersonaStageStrip` 철거

- `components/debate/SpeakerSpotlight.tsx` **파일 삭제**.
- `components/debate/PersonaStageStrip.tsx` **파일 삭제** (렌더 로직은 §A에서 DebateStage 내부로 이동).
- `DebateFeed.tsx`에서 두 import, `stageStrip`/`stageHeader`/spotlight 파생값(`spotlightSpeaker`·`spotlightMode`·`spotlightSig`) 전부 제거. props에서 `activeSpeakerId`·`thinkingMemberId`·`onSelectMember` 제거. `SIGNATURE_LINES` import는 MessageCard 시그니처와 무관하면 제거.
- 잔존 효과: DebateFeed = 순수 기록 뷰 (그루핑 + 카드 + 스크롤 자율화 + 디렉션).
- 관련 CSS(globals.css의 spotlight-enter/glow, tailwind의 animate-spotlight-glow)가 다른 곳에서 미사용이면 함께 제거.

### C. 세션 페이지 — 골격 단일화

`app/(main)/session/[id]/page.tsx` 재구성. **phase와 무관하게 항상 같은 골격**:

```text
홈 링크 + mute 토글
헤더 (고민, 접힘)                       ← 현행 유지
[결론 배너] [에러 배너]                  ← 현행 유지 (조건부)
DebateStage                             ← 항상 렌더 (idle/concluded 포함)
  무대 하단 슬롯:
    phase==='generating' → WaitingMemoArea
    phase==='steering'   → SteeringPanel
회의록 패널 (§D — DebateFeed 단일 렌더)
DebateControls (하단 sticky)             ← 현행 유지
PersonaDetailDrawer / BackgroundPicker   ← 시트 (§E — 동시 1개)
```

- `stageActive` 삼항 분기 **삭제** — 무대 상시 + 회의록 패널 상시.
- `<details>` 대화 기록 **삭제**, 풀스크린 대화록 오버레이(`transcriptOpen` 블록 전체) **삭제**.
- `stageSpeaker/stageMode/stageLine/stageSig` 파생은 현행 유지하되 `mode`에 idle/concluded 매핑 추가:
  `phase==='concluded' ? 'concluded' : activeSpeakerId ? 'speaking' : thinkingMemberId ? 'thinking' : 'idle'`.

### D. 회의록 패널 — 단일 진입점

신규 소형 컴포넌트 `components/debate/TranscriptPanel.tsx`:

- 카드형 섹션: 헤더 줄 "회의록 · N개 발언" + 펼침 토글 (chevron). 본문 = `DebateFeed` (이 한 곳이 앱 전체에서 유일한 DebateFeed 렌더).
- 접힘 상태 기본값: `phase`가 idle/generating/playing/steering이면 접힘, **concluded·error로 진입하면 자동 펼침** (마운트 시 phase 기준 1회 + phase 전환 감지 1회 — 사용자가 수동으로 토글한 뒤에는 자동 전환이 덮어쓰지 않는다: `userToggledRef`).
- 펼침 상태는 세션 내 ephemeral (persist 불요).
- `emptyHint`는 패널 내부로 이동 (idle일 때 "토론 시작을 누르면 회의록이 쌓입니다").
- 주의: DebateFeed는 윈도우 스크롤 기준으로 설계돼 있다(자체 스크롤 컨테이너 아님) — 패널은 `max-h`/`overflow` 를 걸지 말고 그대로 문서 흐름에 펼친다. 새 발언 배지(`fixed bottom-28`)는 회의록이 펼쳐진 상태에서만 의미 있으므로, 접힘 상태일 때 배지가 뜨지 않게 `collapsed` prop 1개를 DebateFeed에 추가하거나 패널에서 조건 분기한다 (둘 중 단순한 쪽).

### E. UI 상태 정리 — `useSessionUiStore`

신규 `store/session-ui.ts` (persist 없음, 메모리 전용):

```ts
type SheetKind = 'none' | 'memberDrawer' | 'bgPicker';
interface SessionUiState {
  sheet: SheetKind;
  selectedMemberId: string | null;
  openMemberDrawer: (id: string) => void;   // sheet='memberDrawer' + id
  openBgPicker: () => void;                 // sheet='bgPicker'
  closeSheet: () => void;                   // sheet='none' + id null
}
```

- 시트 동시 1개 보장 — open 계열이 서로를 자연 대체.
- 페이지 잔존 useState: `headerOpen`, `soundMuted` **2개만** (합격선).
- `transcriptOpen`/`bgPickerOpen`/`selectedMemberId` useState 삭제, 스토어로 대체.

### F. 정리

- `useStageStore`(배경)는 현행 유지.
- 삭제 파일의 import 잔재 grep 확인: `SpeakerSpotlight`, `PersonaStageStrip` 참조 0건.

## 4. 출하 단위 — PR 2개

- **R-1a**: §A + §B — 무대 orb 흡수 + 스포트라이트/스트립 철거 + DebateFeed 순수화. (이 시점엔 페이지의 기존 3곳 렌더 구조 유지 — 컴파일 가능 상태로.)
- **R-1b**: §C + §D + §E + §F — 페이지 골격 단일화 + 회의록 패널 + UI 스토어.
- 분리 이유: R-1a는 컴포넌트 내부 교체(시각 회귀 위험), R-1b는 페이지 구조 교체(동작 회귀 위험) — 검수 관점이 다르다.

## 5. 검증

### 합격 지표 (회의 박제)

| 지표 | 합격선 |
| --- | --- |
| 화자 표시 시스템 / 화면 | 정확히 1개 (DebateStage) |
| 대화록 진입 경로 | 정확히 1개 (TranscriptPanel) |
| DebateFeed 렌더 위치 | 1곳 |
| 세션 페이지 로컬 useState | ≤ 2개 |
| 기능 회귀 | 0건 (아래 체크리스트) |

### 회귀 체크리스트 (운영자 라이브 검수 8항목)

1. 토론 시작 → 모두 발언 카드 + 무대 idle→thinking→speaking 전환
2. 무대 orb 클릭 → PersonaDetailDrawer (발언 필터) 정상
3. 카드 ⋯ → DirectionMenu 5액션 전송 + 토스트
4. generating 중 WaitingMemoArea — 시그널/발언 토글 모두 작동
5. steering — SteeringPanel 선택/직접 입력/결론 내기 3경로
6. 배경 변경 버튼 → BackgroundPicker → 무대 배경 즉시 반영
7. 회의록 패널 — 재생 중 접힘, 펼치면 청크 그루핑 + 새 발언 배지 + 부드러운 스크롤, 결론 후 자동 펼침
8. 새로고침(steering 복원)·concluded 세션 재진입 — 무대 골격 동일, half-state 없음

### 기계 검증

- typecheck / lint / build 통과.
- `grep -rn "SpeakerSpotlight\|PersonaStageStrip" app components hooks lib` → 0건.

## 6. R-2 호환 메모 (구현 시 참고)

대사 박스의 `line` 표시부는 R-2(⑤-6 스트리밍)에서 글자 단위 타이핑 reveal로 교체될 자리다. 이번 작업에서 해당 표시부를 별도 함수/컴포넌트로 과도하게 추상화하지 말 것 — R-2가 갈아끼우기 쉽게 *단순하게* 남겨두는 것이 최선이다.
