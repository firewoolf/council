# 작업 의뢰서 — 트랙 R-1.5: 대화 중심 반응형 레이아웃 (웹 3패널 / 모바일 챗)

> 담당: Claude Code (Sonnet) — 구현
> 작성: Fable (설계 — 운영자 라이브 검증 피드백 2026-06-10 반영)
> 검수: Opus (PR 검수) / 운영자 (반응형 실기기 검수)
> 대상 레포: `council/`
> 선행 문서: `workorder-stage-R1-consolidation.md`(출하분 위에 작업), `workorder-debate-5-6-streaming.md`
> 선행 상태: **P-A-1 + R-1 + R-2a 커밋 후 착수.** 본 워크오더는 R-2b(§E·§F)를 흡수·대체한다 — R-2b는 별도 진행하지 않는다.

---

## 0. 한 줄 목표

대화기록을 주인공으로 승격한다. 웹은 3패널(인물 무대 / 라이브 피드 / 디렉터 콘솔)로 "보면서 동시에 조향"하고, 모바일은 GPT식 챗으로 단순화한다.

## 1. 배경 — 운영자 라이브 검증 피드백 (2026-06-10)

> "대화기록이 보여져야 하고, 실시간 대화기록이 보이면서 페르소나 이미지가 같이 나와야 한다. 웹은 패널 분리 — 대화가 나오는 동시에 다른 패널에서 방향 선택·발언 작성. 모바일은 GPT와 대화하는 형태로 단순화. (무대는) 삼국지 설전·용과 같이의 NPC 대화 같은 효과."

R-1의 "무대 hero + 회의록 접힘"은 대화를 묻어버렸다 — 진단 수정: **단일 시선 원칙은 유지하되, 시선의 대상이 무대가 아니라 피드다.** 역할 재배치:

| 정보 | 유일한 자리 |
| --- | --- |
| 발언 텍스트 (스트리밍) | 피드의 메시지 카드 — **한 곳** |
| 인물 연출 (초상·상태·시그니처) | 무대 패널(웹) / 카드 아바타(모바일) |
| 조향 (방향 선택·발언 작성) | 디렉터 콘솔(웹) / 입력바+시트(모바일) |

무대와 피드가 같은 텍스트를 중복 표시하는 것(R-1에서 제거한 "자기 자신과 경쟁")은 금지 유지 — 무대는 *인물만*, 텍스트는 *피드만*.

## 2. 절대 원칙

1. **재생 엔진 불가침** — `hooks/useDebate.ts`의 스트림·큐·phase 머신 무수정. 허용 변경은 §3-E의 컴포저 게이트 해제 1건뿐.
2. **공유 컴포넌트 1벌** — 갈림길 내용(`NextDirections`), 발언 작성(`SpeechComposer`)은 웹 콘솔과 모바일 시트/입력바가 같은 컴포넌트를 소비한다. 레이아웃만 다르고 로직 분기 금지.
3. **breakpoint는 Tailwind 표준** — `xl`(1280+) 3패널 / `lg`(1024+) 2패널 / 미만 모바일 챗. JS 미디어쿼리는 시트/콘솔 상호배제 한 곳에만.
4. **CSS only** — 모션 라이브러리 금지 (기존 원칙).
5. **⑤-5 자산 보존** — 초상/컷아웃·배경·시그니처·사운드는 무대 패널과 카드에서 재활용. 삭제 금지.

## 3. 작업 범위

### A. 웹 3패널 (`xl` 이상)

```text
┌────────────┬──────────────────────────┬────────────────┐
│ 무대 패널    │ 라이브 피드 (중앙, 가변)    │ 디렉터 콘솔      │
│ w-[300px]  │                          │ w-[340px]      │
│            │  헤더(고민, 접힘)          │                │
│ 배경 이미지  │  메시지 카드 스트림         │ ① 다음 방향     │
│ 현재 화자    │   · 아바타+이름+버블       │   (갈림길)      │
│ 컷아웃/초상  │   · 최신 카드 타이핑▌      │ ② 내 발언 작성  │
│ 이름+상태    │   · 반박 라인·keypoint    │ ③ 재생 컨트롤   │
│ 시그니처     │                          │                │
└────────────┴──────────────────────────┴────────────────┘
```

- **무대 패널** (`StagePanel` 신규 — R-1의 DebateStage에서 분리·축소): 배경 + 현재 화자 컷아웃(3단 폴백) + 이름 + 상태(speaking 글로우/thinking 맥동) + 시그니처 한 줄. **발언 텍스트 없음.** 용과 같이 효과는 "화자 전환 시 컷아웃 enter 모션(기존 stage-char-enter) + 피드 최신 카드 타이핑"의 조합으로 달성한다. idle/concluded는 단체샷.
- **피드** (중앙): 자체 스크롤 컨테이너 (§D). 카드 아바타 40px로 확대, 발화 중 카드 테두리 글로우.
- **콘솔** (`DirectorConsole` 신규): ① `NextDirections` — steering 시 갈림길 칩(✦ 위계 강조), playing/generating 중엔 "장면 진행 중" 상태 + 직전 선택 표시. ② `SpeechComposer` — textarea + [발언으로 / 시그널로] 토글 (§E). ③ `DebateControls` 콘솔 하단 고정 (모바일과 공유).

### B. 웹 2패널 (`lg` ~ `xl` 미만)

무대 패널 생략 → 피드 상단에 **컴팩트 스피커 밴드**(현재 화자 초상 48px + 이름 + 상태, 한 줄) + 콘솔 유지. 밴드는 `StagePanel`의 `compact` variant — 별도 컴포넌트 금지.

### C. 모바일 챗 (`lg` 미만)

```text
헤더(고민, 접힘)
피드 — 챗 버블
  · 페르소나: 좌측 정렬, 아바타+이름+버블
  · 사용자 발언: 우측 정렬 버블 (speakerId null)
  · 최신 카드 타이핑▌ + TypingIndicator(다음 화자 준비)
하단 고정: [컴팩트 컨트롤 줄] + ChatInputBar
갈림길: SteeringSheet (bottom sheet)
```

- **ChatInputBar** (신규): 상시 노출. phase별 placeholder/동작 —
  - generating/playing: "패널에게 한마디 (발언/시그널)" → `SpeechComposer` 로직
  - steering: "직접 주제를 입력하거나, 방향을 고르세요" → 전송 = `submitCustomTopic`. 입력바 위에 "다음 방향 고르기 ▲" 칩 → 시트 재호출
  - concluded: 비활성 ("토론이 종결되었습니다")
- **SteeringSheet** (신규): steering 진입 시 자동 등장하는 bottom sheet. 내용 = `NextDirections` 공유. 내려도(dismiss) 토론은 steering 유지 — 입력바 칩으로 재호출. ✦ 후보는 시각 위계 분리(accent·Sparkles).
- 갈림길 인라인 카드는 만들지 않는다 (운영자 결정 — 시트 방식).
- 모바일에 무대 없음 — 인물 연출은 아바타·시그니처(첫 발언 카드)·사운드로.

### D. 피드 스크롤 컨테이너 전환

DebateFeed는 현재 윈도우 스크롤 전제. 패널 레이아웃에서는 자체 스크롤이 필요하다:

- `scrollContainerRef` prop 추가 — 웹 패널 모드에선 중앙 컬럼 div, 모바일에선 기존 윈도우 동작 유지 (prop 미제공 시 현행).
- near-bottom 측정·새 발언 배지·jumpToBottom 을 컨테이너 기준으로 일반화. 배지 위치도 컨테이너 내 `sticky bottom` 으로 (모바일은 입력바 위).

### E. SpeechComposer — WaitingMemoArea 승격·대체

- `components/debate/WaitingMemoArea.tsx` → `SpeechComposer.tsx` 로 개명·확장. 토글(발언/시그널)·로직은 그대로, **노출 게이트 해제**: generating 한정 → 토론 진행 중 상시 (`phase`가 idle/concluded/error 외).
- `useDebate.submitWaitingMemo` → `submitSpeech` 개명 (호출 계약 동일 — 발언은 즉시 append, 시그널은 다음 청크 주입). 주석의 "generating 중" 문구 갱신. **엔진 로직 무수정.**
- 시그널 모드 안내 문구: "다음 장면에 방향으로만 반영됩니다."

### F. 타이핑 reveal (구 R-2b §E 흡수)

- `TypewriterText` 소형 컴포넌트: 최신 reveal 카드의 본문을 글자 단위 표시. `28ms/char ÷ speed`, 완료 후 잔여 readingTime 홀드 (총 페이싱 = 현행 readingTime). 탭 = 즉시 완성, 이후 탭 = skipTurn. `prefers-reduced-motion` 즉시 완성.
- 적용 대상: **피드의 최신 카드 1장만** (이전 카드는 정적). 무대 패널에는 텍스트 자체가 없으므로 적용 없음.
- `DebateControls` progress: 스트림 열림 동안 `revealed/confirmed+` 표기 (구 R-2b §E 그대로).

### G. 정리

- R-1의 `TranscriptPanel`(접힘 회의록) **삭제** — 피드가 상시 본문이므로 역할 소멸.
- `DebateStage`는 `StagePanel`로 대체 후 삭제 (idle/concluded 단체샷 포함 이전).
- `BackgroundPicker`·`PersonaDetailDrawer` 유지 — 진입점: 무대 패널 우상단(웹) / 카드 아바타 탭(공통).
- 세션 페이지: 골격을 breakpoint grid 로 — `grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[300px_1fr_340px]`. useState ≤2 유지 (시트 상태는 `useSessionUiStore`에 `steeringSheet` 추가).

## 4. 출하 단위 — PR 2개

- **R-1.5a 모바일 챗** (좁은 화면이 기본형): 챗 버블·입력바·시트·타이핑 reveal·스크롤 일반화 (§C·D·E·F). 이 시점 웹은 모바일과 같은 단일 컬럼이어도 된다.
- **R-1.5b 웹 패널**: 3패널/2패널 grid + StagePanel + DirectorConsole (§A·B·G).
- 순서 고정: 공유 컴포넌트(NextDirections·SpeechComposer)가 a에서 태어나 b가 소비한다.

## 5. 검증

### 합격 지표

| 지표 | 합격선 |
| --- | --- |
| 발언 텍스트 표시 위치 | 1곳 (피드 카드) — 무대 패널 텍스트 0 |
| 모바일: 시작→첫 발언까지 조작 없이 읽힘 | 스크롤·탭 0회 |
| 웹 xl: 토론 재생 중 콘솔에서 발언 작성 가능 | 동시 작업 성립 |
| 갈림길 시트 dismiss 후 재호출 | 입력바 칩 1탭 |
| 세션 페이지 useState | ≤ 2개 유지 |

### 회귀 체크리스트 (운영자, 3 breakpoint × 핵심 플로우)

1. 모바일 375px: 시작 → 모두발언 → 스트리밍 타이핑 → 시트 선택 → 2청크 → 결론
2. 웹 1280px+: 3패널 — 재생 중 콘솔 발언 전송(즉시 버블 등장) + 시그널 전송(다음 장면 반영) + 갈림길 선택
3. 웹 1024px: 2패널 — 스피커 밴드 전환 확인
4. 공통: 카드 ⋯ 디렉션 / 아바타 탭 드로어 / 배경 변경 / 새 발언 배지(컨테이너 기준) / 새로고침 steering 복원 / 사운드·mute
5. `prefers-reduced-motion` — 타이핑 즉시 완성

### 기계 검증

- typecheck / lint / build. `grep -rn "WaitingMemoArea\|TranscriptPanel\|DebateStage" app components hooks` → 0건.

## 6. 메모

- 삼국지 설전의 "능력치 게이지" 감성은 보류 중인 ⑤-5a-2 자산이 무대 패널 hover/드로어로 합류할 자리다 — 본 워크오더 범위 밖, R-3' 이후 재론.
- P-B(moveType)의 무대 연출 3종(반격 펄스·크리티컬·질문 비네트)은 본 레이아웃 기준으로 다시 매핑한다: 반격 = 카드 간 연결 강조, 크리티컬 = 카드+무대 동시 펄스, 질문 = 입력바/콘솔 포커스 글로우. P-B 워크오더 작성 시 반영.
