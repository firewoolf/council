# 작업 의뢰서 — 트랙 ① Phase E: 페르소나 모델 v2 (다축 trait)

> 담당: Claude Code (Sonnet)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `roadmap.md` 트랙 ① / `workorder-persona-B-cast.md` Phase B-1 (CastMember 도입)
> 선행 상태: 트랙 ① Phase B 완주 (B-1 + B-2). v1 `Temperament` enum 5종이 운영 중.
> **권장 순서: 트랙 ⑤-1 청크 엔진 출하 후 진입.** 모델 변경이 청크 프롬프트와 충돌하지 않게.

---

## 0. 한 줄 목표

페르소나의 *성향*을 단일 `Temperament` enum (1개 선택)에서 **3축 trait 객체**로 재설계한다. 잡스 같은 *옹호적·분석적·도발적* 페르소나가 표현 가능해진다.

---

## 1. 배경 — Phase B 의 한계 진단

운영자 David 가 2026-05-26 제기한 검토:

> *"비판가·공감가·독설가·옹호가·분석가의 특성을 하나만 선택해야할까? 중복으로 선택하는건 불합리할까? 독설적이면서 옹호적일수도? 독설가이면서 분석가일수도 있는거 아닌가? 그리고 이 다섯가지가 정말 mece 한 것일까?"*

진단 결과: **5종 중 일부가 다른 축에 속한다** — 한 enum 에 평행 배치된 게 잘못이다.

### 1.1 MECE 검토

| temperament | 실제 의미 | 어느 축인가 |
|---|---|---|
| `advocate` | 추진 / 찬성 / 옹호 | **stance 축** (정치적 입장) |
| `critic` | 비판 / 리스크 / 반대 | **stance 축** (advocate 의 반대) |
| `analyst` | 데이터 / 구조 / 이성 | **lens 축** (인지 양식) |
| `empath` | 감정 / 사람 / 심리 | **lens 축** (analyst 의 반대 — 정서) |
| `provocateur` | 도발 / 직설 / 불편한 직언 | **expression 축** (표현 방식) |

세 축이 **enum 한 줄에 평행 배치돼 있다.** 잡스를 표현하려면 advocate + analyst + provocateur 세 개를 동시에 골라야 하는데 단일 선택이라 *하나만 고른 뒤 나머지는 systemPrompt 본문에 묻어버리는* 우회를 쓰고 있다.

또한 `expression` 축은 비대칭: `provocateur` 의 대응 *유화/측정* 이 없다. 5종 어색.

### 1.2 stance 중복 문제

현재 `CastMember.stance: string` 은 *이 고민에서의 구체적 한 줄 주장* (예: "동물병원 SaaS는 6개월 안 안 바뀐다"). 그런데 `temperament.advocate/critic` 도 *추진/반대* 의미라 **stance 와 temperament 가 한 축을 공유**한다.

해결: stance 축은 *분류용 enum* (`Stance`) 으로 분리하고, 현재 `stance` 텍스트는 그대로 유지 (UI 표시·프롬프트 합성용).

---

## 2. 절대 원칙

1. **마이그레이션 무중단** — zustand persist `version` 을 1 → 2 로 올리고, `migrate` 가 v1 의 `temperament` 를 v2 의 3축 기본값으로 변환. *알 수 없는 값은 안전 기본값* 으로 강등하되 세션은 살린다 (B-1 패턴 그대로).
2. **굴복 금지 불변** — 새 trait 도 `temperamentDirectives` 와 동등한 *지시 조각* 으로 풀어 `BASE_PROMPT` 다음에 prepend. lens·expression 각각 5종 directive 가 필요.
3. **단일 책임** — 이 워크오더는 *데이터 모델 + 프롬프트 합성 + 어드민 + 추천 schema* 만 다룬다. 회의실·결론 렌더링은 cast 의 *표시 필드* (name/role/colors) 만 본다 — 영향 거의 없음(트랙 ① Phase B-2 §5.7 효과).
4. **트랙 ⑤-1 청크 프롬프트와의 정합** — `buildChunkPrompt` 안의 패널 명단 표기가 *3축 trait* 을 자연어로 합쳐서 제공. enum 값 그대로 노출 금지.
5. **`temperament` 단어 자체 폐기** — 모든 코드·문서·UI 라벨에서 *trait* 또는 *축별 이름* 으로 교체. 데이터 v2 마이그레이션이 완료된 시점에 enum/필드 모두 삭제.

---

## 3. 신규 모델 — 3축 분리 (방향 A)

### 3.1 타입 (`types/persona.ts`)

```ts
/** stance 축 — 이 패널 멤버가 *이 고민* 에 취하는 기본 입장 분류. */
export type StanceAxis =
  | 'advocate'    // 추진/찬성: "X 해야 한다"
  | 'critic'      // 비판/반대: "X 하지 말라, Y 가 먼저다"
  | 'agnostic';   // 전제 의심/중립: "X 라는 질문 자체가 틀렸다"

/** lens 축 — 어떤 *인지 양식* 으로 사안을 보는가. */
export type Lens =
  | 'analyst'     // 데이터·구조·숫자 (감정 배제)
  | 'empath'      // 사람·감정·심리·지속가능성
  | 'pragmatist'; // 실전·경험·업계 현실 (analyst 와 empath 사이의 실용주의)

/** expression 축 — 어떤 *표현 방식* 으로 말하는가. */
export type Expression =
  | 'provocateur' // 도발·직설·불편한 직언
  | 'measured';   // 측정된·정중한·구조적

/** 한 멤버의 trait 묶음. v2 의 신설. */
export interface Trait {
  stanceAxis: StanceAxis;
  lens: Lens;
  expression: Expression;
}
```

`Temperament` 타입은 **v2 출하 후 삭제**. 마이그레이션 코드 안에서만 잠시 쓰임.

### 3.2 Archetype / CastMember 변경

```ts
export interface Archetype {
  // ...기존 필드 유지...
  trait: Trait;          // 신규
  // temperament 필드 제거
}

export interface CastMember {
  // ...기존 필드 유지...
  trait: Trait;          // 신규 (생성/custom 도 동일)
  stance: string;        // 그대로 — 이 고민에서의 구체적 한 줄 주장 (변경 없음)
  // temperament 필드 제거
}
```

`stance: string` 는 그대로. *trait.stanceAxis* (분류) 와 *stance* (텍스트) 는 다른 것.

### 3.3 archetype 10명 trait 매핑 (`data/personas.json`)

Phase B-1 의 단일 temperament → v2 3축:

| archetype id | v1 temperament | v2 stanceAxis | v2 lens | v2 expression | 근거 |
|---|---|---|---|---|---|
| `cold-investor` | analyst | critic | analyst | measured | 숫자로 비판 |
| `cynical-dev` | provocateur | critic | analyst | provocateur | 분석 기반 도발 |
| `jobs-designer` | provocateur | advocate | pragmatist | provocateur | 본질주의 추진+도발 |
| `realist` | critic | critic | pragmatist | measured | 현실 검증 비판 |
| `startup-expert` | analyst | agnostic | analyst | measured | 구조적 중립 |
| `branding-strategist` | empath | advocate | empath | measured | 감성·추진 |
| `psychologist` | empath | agnostic | empath | measured | 사람 중심 중립 |
| `growth-marketer` | advocate | advocate | pragmatist | measured | 실전 추진 |
| `domain-expert` | critic | critic | pragmatist | measured | 업계 현실 비판 |
| `facilitator` | analyst | agnostic | analyst | measured | 분석적 중재 |

운영자가 추후 어드민에서 조정 가능. 이 매핑은 *마이그레이션 직후 시점의 합리적 기본값*.

### 3.4 마이그레이션 (`store/sessions.ts`)

persist `version: 1 → 2`. `migrate` 가:
- v1 의 `CastMember.temperament` → v2 의 `trait` 객체로 변환
- 변환 표는 §3.3 의 archetype id 매핑을 *역참조* 가 아니라 **temperament 단위 매핑** 사용 (옛 generated/custom 도 같은 규칙):

```ts
const TEMPERAMENT_TO_TRAIT: Record<string, Trait> = {
  advocate:    { stanceAxis: 'advocate', lens: 'pragmatist', expression: 'measured' },
  critic:      { stanceAxis: 'critic',   lens: 'analyst',    expression: 'measured' },
  analyst:     { stanceAxis: 'agnostic', lens: 'analyst',    expression: 'measured' },
  provocateur: { stanceAxis: 'agnostic', lens: 'pragmatist', expression: 'provocateur' },
  empath:      { stanceAxis: 'agnostic', lens: 'empath',     expression: 'measured' },
};
```

알 수 없는 옛 값 → 기본 `{ agnostic, pragmatist, measured }`. cast 자체는 살린다.

---

## 4. 프롬프트 합성 (`lib/prompts/personas/index.ts`, `data/prompts.json`)

### 4.1 신규 directive 3세트 — 본문 박제 완료 (2026-05-26, Opus)

`data/prompts.json` 의 `temperamentDirectives` → 폐기. 대신 아래 8개. 본문은 워크오더 부록 A 와 동일 (이중 박제 — `prompts.json` 에 그대로 복사).

### 4.2 `composePersonaPrompt` 갱신

합성 순서 (스펙 §5.1 의 자리에 3 directive 가 들어옴):

```
BASE_PROMPT
+ [당신의 캐릭터] 이름 / 역할
+ stanceDirective[trait.stanceAxis]
+ lensDirective[trait.lens]
+ expressionDirective[trait.expression]
+ 캐릭터 프롬프트
+ [이 회의에서 당신의 입장] cast.stance (비어있으면 생략)
+ [사용자의 고민] concern
+ OUTPUT_HINT
```

3 directive 가 BASE 와 캐릭터 프롬프트 *사이* 에 박힘. 잡스 = advocate + pragmatist + provocateur 면 세 줄이 다 들어가 *옹호적·실용주의적·도발적* 톤이 합성됨.

---

## 5. 추천기 갱신 (`lib/prompts/recommender.ts`)

`panelDesignSchema` 의 `temperament: string` 필드를 **3축 객체** 로 교체:

```ts
trait: z.object({
  stanceAxis: z.string().describe("'advocate' / 'critic' / 'agnostic'"),
  lens: z.string().describe("'analyst' / 'empath' / 'pragmatist'"),
  expression: z.string().describe("'provocateur' / 'measured'"),
}),
```

느슨한 스키마 그대로 — `sanitizePanel` 이 unknown 값을 기본값으로 정규화. 새 정규화 규칙은 §6 참조.

`buildPanelDesignPrompt` 본문에 *3축 설명* 박제. "패널은 *stance × lens × expression* 의 자유로운 조합" 원칙을 명시하고, *추진 1·반대 1·제3 1* 강제는 **stanceAxis** 분배로 자연 매핑.

---

## 6. sanitize·UI 정규화 (`lib/persona-safety.ts`)

`sanitizePanel` 갱신:
- `raw.trait.stanceAxis` 가 3종 밖이면 `'agnostic'` 폴백
- `raw.trait.lens` 가 3종 밖이면 `'pragmatist'` 폴백
- `raw.trait.expression` 이 2종 밖이면 `'measured'` 폴백

`TEMPERAMENT_COLORS` 도 폐기 → `LENS_COLORS` 로 교체 (색의 *주체* 는 lens 가 가장 정체성에 가까움):

```ts
export const LENS_COLORS: Record<Lens, { from: string; to: string }> = {
  analyst:    { from: '#1E40AF', to: '#3B82F6' }, // blue — 냉정
  empath:     { from: '#6D28D9', to: '#A78BFA' }, // violet — 공감
  pragmatist: { from: '#047857', to: '#10B981' }, // emerald — 실전
};
```

expression='provocateur' 면 *추가 시각 마커* (orb 외곽 amber ring 또는 카드 좌측 강조선). UI 디테일은 §7 에서.

---

## 7. UI 변경 (`components/persona/PersonaCard.tsx`, `components/session/PersonaPicker.tsx`)

### 7.1 PersonaCard 뱃지 + 인터랙티브 변경

기존 1개 temperament 뱃지 → 3개 칩 (작은 사이즈):

```
[orb] [이름] ······ [입장: 옹호자] [관점: 실용가] [표현: 도발] [⋯]
       역할
       입장: stance text
```

칩 색·라벨은 `LENS_COLORS` + 한국어 라벨 맵 (`STANCE_LABEL_KR`, `LENS_LABEL_KR`, `EXPRESSION_LABEL_KR`).

`expression='measured'` 면 표현 칩 생략 (기본값이라 노이즈).

#### 인터랙티브 변경 — 사용자 피드백(2026-05-26) 반영

> "제일 처음 페르소나를 선택할때 페르소나의 타입(공감가, 독설가, 비판가 등) 라벨 버튼을 누르면 변경이 될 수 있도록 하자."

각 칩이 **클릭 cycle** 로 동작 (picking 화면에서만 — picker 외 화면은 read-only):

- **stance 칩 클릭** → `advocate → critic → agnostic → advocate` (3-cycle)
- **lens 칩 클릭** → `analyst → empath → pragmatist → analyst` (3-cycle)
- **expression 칩 클릭** → `measured → provocateur → measured` (2-cycle, toggle)

상호작용 디테일:
- 칩 클릭 시 카드 우상단 ⋯ 메뉴와 *동시 동작 가능* — `e.stopPropagation()` 필수.
- 변경 즉시 `onTraitChange(memberId, axis, newValue)` 콜백 호출 → 부모(`PersonaPicker` → `session/new/page.tsx`)가 `cast` 갱신.
- archetype 멤버의 trait 변경 시 *archetype 출신 표시* 는 유지하되 `LENS_COLORS[newLens]` 로 카드 시각 즉시 갱신 (색이 바뀐다 = 다른 사람이 된 거 같은 강한 시그널).
- generated/custom 멤버도 동일하게 변경 가능.
- 모바일에서 칩이 작아 누르기 어렵지 않게 — `min-height: 28px`, `min-width: 56px` 보장.

**대안 UX — 드롭다운**: 칩 클릭 시 *3개 (또는 2개) 옵션 드롭다운* 등장. cycle 보다 명시적이지만 한 단계 더. **Sonnet 결정** — *처음 사용자 학습 비용* vs *반복 클릭 비용* 의 트레이드오프. 권장은 **cycle 우선**, 모바일에서 *길게 누름* 시 드롭다운 보조.

#### `PersonaPicker` props 갱신

```tsx
interface PersonaPickerProps {
  cast: CastMember[];
  // ...기존...
  /** trait 축별 cycle 변경. Picker 내부에서만 호출됨. */
  onTraitChange: (memberId: string, axis: 'stanceAxis' | 'lens' | 'expression', newValue: string) => void;
}
```

`session/new/page.tsx` 의 `handleTraitChange` 핸들러 신규:

```tsx
const handleTraitChange = useCallback(
  (memberId: string, axis: keyof Trait, newValue: string) => {
    setCast((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        const trait = { ...m.trait, [axis]: newValue };
        // lens 변경 시 LENS_COLORS 재적용
        const colors = axis === 'lens'
          ? LENS_COLORS[newValue as Lens]
          : { from: m.colorFrom, to: m.colorTo };
        return {
          ...m,
          trait,
          colorFrom: colors.from,
          colorTo: colors.to,
        };
      }),
    );
  },
  [],
);
```

stance/expression 변경 시 색은 그대로 (lens 만 색의 주체). UI 즉시 반영.

### 7.2 커스텀 폼 (Phase B-2 §5.6 변형)

기존: temperament 칩 5개 토글 → 1개 선택.
v2: 3축 각각 별도 칩 그룹:

```
입장
  ◯ 옹호자  ⊙ 비판자  ◯ 회의자

관점
  ◯ 분석가  ⊙ 공감가  ◯ 실용가

표현
  ⊙ 측정자  ◯ 도발가
```

검증 규칙:
- stanceAxis / lens 필수
- expression 기본 `measured` (선택)
- 자유 프롬프트 입력 *금지* 원칙 유지

### 7.3 어드민 (`components/admin/PersonaForm.tsx`)

archetype 편집 폼도 위와 동일. `lib/admin/schemas.ts` `personaSchema` 갱신 — `temperament` 제거, `trait` 추가.

---

## 8. 영향 파일 맵

```
types/persona.ts                              StanceAxis / Lens / Expression / Trait 신규, Temperament 폐기
data/personas.json                            10명 × {stanceAxis, lens, expression} (§3.3 표)
data/prompts.json                             temperamentDirectives → stanceDirectives + lensDirectives + expressionDirectives
lib/admin/schemas.ts                          personaSchema · promptsSchema 3축 교체
components/admin/PersonaForm.tsx              3축 셀렉터
app/admin/prompts/edit/PromptsEditForm.tsx   directive 3 그룹 textarea
store/sessions.ts                             persist v1→v2 migrate
lib/prompts/personas/index.ts                 composePersonaPrompt 합성 순서, TEMPERAMENT_LABEL_KR → 3개 LABEL_KR
lib/prompts/recommender.ts                    panelDesignSchema.trait 객체, buildPanelDesignPrompt 갱신
lib/prompts/synthesize.ts                     synthesizeCharacterPrompt 인자 (temperament → trait)
lib/persona-safety.ts                         sanitizePanel.trait 정규화, TEMPERAMENT_COLORS → LENS_COLORS
components/persona/PersonaCard.tsx            뱃지 3개
components/session/PersonaPicker.tsx          커스텀 폼 3축
app/(main)/session/new/page.tsx               handleAddCustom 의 colors 산출 (LENS_COLORS[input.lens])
```

총 14개 파일. B-1 + B-2 합산 분량의 60% 수준.

---

## 9. 실행 순서 — 두 묶음으로

### E-1. 데이터 모델 + 마이그레이션 + 합성 (블로킹)

§3, §4, §6 (sanitize), §8 의 데이터/타입 파일들. 출하 후 **앱이 v1 과 동일하게 동작**해야 함 — UI 뱃지는 아직 1개라 시각 변화 0. 마이그레이션 무중단 검증 핵심.

### E-2. 추천기 + UI (E-1 통과 후)

§5 (recommender), §7 (UI). E-1 통과 후 진입. 출하 시 picking 카드에 3 뱃지·커스텀 폼 3축 노출.

---

## 10. 검증 기준

### 10.1 자동 검증

- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` 통과.
- [ ] persist v1 세션이 v2 코드에서 정상 로드 (마이그레이션 무중단). 마이그레이션된 cast 의 trait 가 §3.4 매핑과 일치.

### 10.2 사람 검증

- [ ] 비아키타입 분야 고민으로 새 세션 → picking 에서 generated 멤버의 3축 칩이 모두 표시·합리적.
- [ ] 커스텀 폼으로 *옹호자·공감가·도발가* 조합 페르소나 1명 추가 → 토론 발언에 세 directive 가 모두 반영 (공감하면서도 도발적인 말투).
- [ ] 잡스 archetype (jobs-designer) 발언이 *추진+실용+도발* 톤으로 나오는지 — 옛 단일 provocateur 보다 발언이 풍부해야 함.
- [ ] **옛 세션 회귀** — B-1 마이그레이션된 세션이 E 코드에서도 정상.

---

## 11. 손대지 말 것

- `BASE_PROMPT`, `OUTPUT_HINT` — 굴복 금지 규칙. 그대로.
- 회의실·결론·summary 렌더링 — cast 의 *표시 필드* 만 본다 (B-2 §5.7 효과). 손대지 말 것.
- `conclusionSchema` — Phase B-2 §5.8 enum 해제 상태 유지.
- 청크 엔진 (트랙 ⑤-1) — 영향 받지만 *prompt 의 패널 표기* 만 갱신 (trait 3축 자연어 표기). 청크 엔진 본체 로직은 손대지 말 것.
- Supabase — 별도 마일스톤.

---

## 12. 완료 후

- `backlog.md` Active 에 Phase E 추가 → 완주 시 Done.
- Phase C (내 페르소나 서랍), Phase D (필터·regenerate) 는 Phase E 완료 후 워크오더 재발행 — E 의 3축 모델 기준으로 다시 작성됨.

---

## 부록 A — directive 본문 8개 (Opus 박제 완료 2026-05-26)

`data/prompts.json` 의 `stanceDirectives` / `lensDirectives` / `expressionDirectives` 에 *그대로* 들어가는 본문. Sonnet 은 임의 수정 금지.

### A.1 `stanceDirectives` (3개)

```json
"stanceDirectives": {
  "advocate": "[입장 — 옹호자] 당신은 이 고민에서 *추진* 쪽을 든다. 막을 이유보다 되게 할 길을 먼저 찾는다. 가능하다고 보는 경로가 보이면, 그 경로를 명료히 가리킨다. 단, 근거 없는 낙관은 금물 — '되게 할 수 있다' 고 말할 땐 *그 경로를 구체적으로* 제시한다. 막연한 응원은 발언이 아니다.",

  "critic": "[입장 — 비판자] 당신은 이 고민에서 *제동* 을 건다. 허점·리스크·반례에 집중한다. 어떤 주장이든 '어디서 깨질까' 를 먼저 본다. 단, 반대를 위한 반대는 금물 — 깨질 지점을 짚으면 *왜 그것이 치명적인지* 까지 말한다. 그저 부정만 하는 비평은 발언이 아니다.",

  "agnostic": "[입장 — 회의자] 당신은 이 고민의 *전제 자체* 를 의심한다. 'X 를 할까 말까' 가 아니라 'X 라는 질문 자체가 옳은 질문인가' 를 묻는다. 사용자가 깔고 있던 가정에 의문을 던진다. 단, 모든 걸 부정하는 회의주의는 금물 — 의심한 가정의 *대안 프레임* 을 한 줄이라도 제시한다."
}
```

### A.2 `lensDirectives` (3개)

```json
"lensDirectives": {
  "analyst": "[관점 — 분석가] 당신은 감정을 배제하고 데이터·근거·구조로만 말한다. '느낌상' 이라는 말을 쓰지 않는다. 추정치라도 *수치로 환산* 해 제시한다. 주장엔 근거의 출처를 단다. 인상에 의존한 발언은 발언이 아니다.",

  "empath": "[관점 — 공감가] 당신은 사람·감정·심리·지속가능성을 중심에 둔다. 결정이 사람에게 미치는 영향과 번아웃·동기 같은 비가시적 비용을 본다. 단, 위로로 끝내지 말 것 — 그 관점에서의 *구체적 판단* 까지 내린다. '힘드시겠다' 만 남는 발언은 발언이 아니다.",

  "pragmatist": "[관점 — 실용가] 당신은 업계 현실·관행·실패 패턴으로 사안을 본다. 추상이 아니라 *실제로 어떻게 굴러가는지* 를 말한다. analyst 의 숫자와 empath 의 감정 사이, 현장의 손때 묻은 디테일을 본다. 단, 경험담 일화에 갇히지 말 것 — *일반화 가능한 패턴* 까지 언어화한다."
}
```

### A.3 `expressionDirectives` (2개)

```json
"expressionDirectives": {
  "provocateur": "[표현 — 도발가] 당신은 직설적이고 도발적으로 말한다. 불편한 직언을 에두르지 않는다. 단, 인신공격이 아니라 *논점* 을 찌른다 — 상대가 외면하던 약점을 정면으로 끄집어낸다. 도발은 *논리의 강도* 이지 *말투의 거침* 이 아니다.",

  "measured": "[표현 — 측정자] 당신은 정중하고 구조적으로 말한다. 발언을 '주장 → 근거 → 함의' 의 순서로 짠다. 단, 정중함이 *벙벙함* 으로 흐르지 말 것 — 측정된 말이지 *무뎌진 말* 이 아니다. 한 발언에는 반드시 한 번의 단언이 들어간다."
}
```

### A.4 합성 결과 시뮬레이션 — 잡스 (advocate + pragmatist + provocateur)

세 directive 가 BASE_PROMPT 뒤에 prepend 되면 잡스의 시스템 프롬프트 머리는 이렇게 합성된다:

```
{BASE_PROMPT — 굴복 금지 / 벙벙함 금지}

[당신의 캐릭터] 당신의 이름은 "잡스형 디자이너" 입니다. 역할: ...

[입장 — 옹호자] 당신은 이 고민에서 *추진* 쪽을 든다. 막을 이유보다 되게 할 길을 먼저 찾는다 ...

[관점 — 실용가] 당신은 업계 현실·관행·실패 패턴으로 사안을 본다 ...

[표현 — 도발가] 당신은 직설적이고 도발적으로 말한다. 불편한 직언을 에두르지 않는다 ...

{캐릭터 프롬프트 — 손으로 쓴 systemPrompt}

[이 회의에서 당신의 입장] {stance text}

[사용자의 고민] {concern}

{OUTPUT_HINT}
```

→ "되게 할 길을 + 현장 디테일로 + 도발적으로" 의 조합이 명시적으로 입력. v1 의 `provocateur` 단일 선택보다 *세 축이 합성된 페르소나* 가 입력됨.

Sonnet 검증 (§10.2 사람 검증): 잡스 발언이 이 합성 결과의 *세 직무를 모두 수행* 하는지 확인. 옛 v1 발언과 *명시적으로 풍부* 해야 한다.

---

## 부록 B — temperament v1 → trait v2 *역* 매핑 (참고)

§3.4 의 `TEMPERAMENT_TO_TRAIT` 은 옛 데이터를 v2 로 옮길 때 *정방향* 매핑이다. 일부 archetype 의 *기존 v1 systemPrompt* 가 옛 temperament 의 정체성을 표현하므로, 마이그레이션 후 그 정체성이 v2 3축에 잘 분배됐는지 *역방향* 으로 검증:

- v1 `provocateur` archetype = `cynical-dev`, `jobs-designer` → v2 에선 `expression: provocateur` 가 잡고, 본문의 *분석/실용* 성격은 `lens` 가 분담.
- v1 `analyst` archetype = `cold-investor`, `startup-expert`, `facilitator` → v2 에선 `lens: analyst` 가 그대로 유지, stanceAxis 는 archetype 마다 다름.
- v1 `empath` archetype = `branding-strategist`, `psychologist` → v2 `lens: empath` 유지.

§3.3 표가 이 분배의 결정. 매핑이 의도대로 들어갔는지는 §10.2 의 *옛 archetype 발언이 풍부해졌는가* 로 검증된다.
