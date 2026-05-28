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

### 4.1 신규 directive 3세트

`data/prompts.json` 의 `temperamentDirectives` → 폐기. 대신 신규 3 개:

```json
"stanceDirectives": {
  "advocate": "[입장 축 — 옹호자] 당신은 ...",
  "critic":   "[입장 축 — 비판자] 당신은 ...",
  "agnostic": "[입장 축 — 회의자] 당신은 ..."
},
"lensDirectives": {
  "analyst":    "[관점 — 분석가] ...",
  "empath":     "[관점 — 공감가] ...",
  "pragmatist": "[관점 — 실용가] ..."
},
"expressionDirectives": {
  "provocateur": "[표현 — 도발가] ...",
  "measured":    "[표현 — 측정자] ..."
}
```

각 문구는 **B-1 의 temperamentDirectives 와 동일 톤** — "단, …" 가드로 BASE 의 굴복 금지·벙벙함 금지와 충돌 없게. 본문은 워크오더 발행 직전 Opus 가 직접 박제(임의 작성 금지).

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

### 7.1 PersonaCard 뱃지

기존 1개 temperament 뱃지 → 3개 칩 (작은 사이즈):

```
[orb] [이름] ······ [입장: 옹호자] [관점: 실용가] [표현: 도발] [⋯]
       역할
       입장: stance text
```

칩 색·라벨은 `LENS_COLORS` + 한국어 라벨 맵 (`STANCE_LABEL_KR`, `LENS_LABEL_KR`, `EXPRESSION_LABEL_KR`).

`expression='measured'` 면 표현 칩 생략 (기본값이라 노이즈).

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

## 부록 A — directive 본문 (출하 직전 Opus 가 박제)

stance / lens / expression 각 directive 본문은 **B-1 temperamentDirectives 와 같은 톤** ("단, …" 가드 포함) 으로 Opus 가 직접 작성. 예시 (잠정):

```
stanceDirectives.advocate:
  "[입장 — 옹호자] 당신은 이 고민에서 *추진* 쪽을 든다. 막을 이유보다 되게 할 길을 먼저 찾는다.
   단, 근거 없는 낙관은 금물 — 가능하다고 말할 땐 그 경로를 구체적으로 제시한다."

lensDirectives.pragmatist:
  "[관점 — 실용가] 당신은 업계 현실·관행·실패 패턴으로 사안을 본다. 추상이 아니라
   '실제로 어떻게 굴러가는지' 를 말한다. 단, 경험담 일화에 갇히지 말 것 — 일반화 가능한
   패턴까지 언어화한다."

expressionDirectives.provocateur:
  "[표현 — 도발가] 당신은 직설적이고 도발적으로 말한다. 불편한 직언을 에두르지 않는다.
   단, 인신공격이 아니라 *논점* 을 찌른다 — 상대가 외면하던 약점을 정면으로 끄집어낸다."
```

본 워크오더 발행 시 부록 A 가 *전체 7 directive* 본문으로 채워진다. Sonnet 은 본문을 임의 작성 금지.
