# 작업 의뢰서 — 트랙 ⑤ Phase ⑤-5: 게임화 (NPC 몰입)

> 담당: Claude Code (Sonnet)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `roadmap.md` 트랙 ⑤·③, `workorder-debate-5-2-stage-ui.md` (⑤-2a/b 출하 후), `workorder-persona-E-multitrait.md` (출하 완료)
> 선행 상태: 트랙 ⑤-1·⑤-2 출하, 트랙 ① Phase E 출하. 시각 레이어와 페르소나 표현력 둘 다 갖춤. 다음은 *캐릭터 깊이* 와 *결정 무게* 의 시각화.

---

## 0. 한 줄 목표

게임 NPC 의 몰입 패턴을 차용해 패널을 *캐릭터처럼* 느끼게 하고, 사용자 결정의 *무게* 를 시각화한다. *읽는 토론* → *플레이하는 토론*.

---

## 1. 배경 — 사용자 피드백 (2026-05-31)

> "롤플레잉 게임을 할때 npc 처럼 얘기가 나올 수 있으면 좀 더 몰입도가 있지 않을까? 게임을 벤치마킹하는게 필요할수도."

핵심 진단: 트랙 ⑤-2 가 *공간 메타포* 를 구축했지만, *캐릭터 메타포* 는 아직 약하다. 청크 안에서 발언이 흐르긴 하나 *그 사람만의 시그니처* 가 없다. 사용자가 ChatGPT 의 *한 사람 N면체* 와 COUNCIL 의 *N명의 1면체* 를 차이로 느끼려면, 각 페르소나가 *입장하는 순간* / *결정적 발언* / *분기 선택* 모두 *게임 NPC 의 무게* 로 작동해야 한다.

---

## 2. 영감 — 게임 8선 ↔ 차용 포인트

### 2.1 서양 RPG (깊이 영감)

| 게임 | 차용 매핑 |
|---|---|
| **Disco Elysium** (Skill voices) | 사용자 내면 N개 목소리 동시 발화. **COUNCIL 의 미래 구조**. 페르소나 시그니처 (이름 옆 아이콘/모토 한 줄) 차용. 트랙 ④ 거울 페르소나의 직접 참고. |
| **Mass Effect** (Witty banter) | NPC 가 *서로* 호명하며 잡담. 청크 안에서 발언자 첫 줄에 *호명 강조* (예: "잡스의 그 말은 — ...") |
| **Persona 5** (Aha 모먼트) | 결정적 발견 시 *전구 깜빡 / 화면 일순* 효과. `isKeyPoint` 발언 reveal 시 *카드 글로우 펄스 + orb 전구 효과* |
| **Detroit: Become Human** (분기 무게) | 다음 결정의 *무게* 가 화면에 명시. SteeringPanel 의 ✦ 후보가 *결정 무게 시각* (Sparkles + 강조 가중치) |
| **Inworld AI** (환경 컨텍스트) | NPC 가 *공간 안에서* 대화. 분야별 *회의실 배경 톤 변화* — `detectedDomain` 에 따른 `--stage-bg` 색조 분기 |

### 2.2 클래식 일본/한국 시뮬 (가벼움·모바일 fit ★)

**모바일·BYOK·1인 운영 인 COUNCIL 에는 서양 RPG 의 깊이보다 클래식 시뮬의 가벼움이 본질에 더 fit.** 다음 3선이 메인 메타포:

| 게임 | 차용 매핑 |
|---|---|
| **삼국지** (코에이, 회의 화면) | 군주가 신하들의 *조언* 받음. 한 화면에 N명 얼굴 + 짧은 발언 + 능력치 게이지. → **trait 3축을 ★ 게이지로 시각화** (PersonaCard / StageStrip). 인재 영입 메타포 — picking 이 *모집 화면* 처럼. |
| **프린세스 메이커** (이벤트 컷신) | 매주 결정 누적. *이벤트 컷신* (그림+텍스트+선택지). 엔딩 분기. → **청크 인트로 컷신** (청크 시작 직전 1~2초 표시: 분야 라벨 + 시그니처 + 첫 발언자). **SteeringPanel = *주간 결정* 메타포** ("이번 주제" 헤더 + hook 의 *결과 예고* 확장). |
| **동급생** (엘프, 캐릭터 일러스트) | 캐릭터별 *고유 인사·말투·일러스트*. → **orb → 이모티콘/미니 아바타** (옵션, 큰 변경. 1차는 lucide-react 매핑, 후속은 일러스트). 시그니처 멘트가 *말풍선* 으로. |

### 2.3 결정적 통찰

서양 RPG = *깊이 + 분기 + 음성* (무거움) ↔ 일본/한국 클래식 = **정적 그림 + 짧은 텍스트 + 선택지** (가볍고 친근, 모바일 fit). COUNCIL 의 *제품 톤* 은 후자.

---

## 3. 절대 원칙

1. **시각 효과는 *이해를 도와야* 한다** (트랙 ③ 원칙). 스펙터클이 목적이 아님. 게임 차용은 *몰입* 을 위한 *정보 표현*, 화려함을 위한 게 아니다.
2. **모바일 퍼스트 유지** — 모든 시각 효과는 작은 화면에서도 의미있게.
3. **CSS only** — `motion`/`framer-motion` 도입 금지. CSS keyframe + Tailwind animate. (트랙 ⑤-4 영역 보존.)
4. **굴복 금지 불변** — `BASE_PROMPT`·directive 손대지 말 것.
5. **자율 스크롤·재생 엔진 회귀 금지** — ⑤-1/⑤-2 출하분 그대로 작동.
6. **시그니처 멘트는 데이터 영역** — 운영자가 `data/personas.json` 으로 편집 가능. 코드에 박지 말 것.
7. **Disco Elysium 메타포 의 차용은 부분만** — 사용자 내면 목소리 화 는 **트랙 ④ 거울 페르소나** 영역이라 여기서는 *시그니처 표현* 만 차용. 메타포 침범 금지.

---

## 4. 작업 범위 — A~G

### A. 시그니처 진입 멘트 (`data/personas.json`, `types/persona.ts`)

각 archetype 에 `signatureLine?: string` 가산 필드. 회의 시작 시 *첫 청크 직전* 또는 *그 페르소나가 첫 발언* 시 *카드 상단에 작게* 표시.

```ts
export interface Archetype {
  // ...기존...
  /** ⑤-5 — 이 페르소나가 회의에 들어올 때의 시그니처 한 줄. UI 표시용. */
  signatureLine?: string;
}
```

예시 (Opus 가 박제할 본문):
- `cold-investor`: "결정은 숫자에서 갈린다."
- `cynical-dev`: "그건 우리가 이미 한 번 망해본 거야."
- `jobs-designer`: "이게 *왜* 존재해야 합니까?"
- `realist`: "이론은 매끈하지만 현장은 그렇지 않습니다."
- `psychologist`: "결정 뒤에는 사람이 남습니다."
- ... (10명 전체는 §10 부록 A 에 Opus 박제)

UI 위치 두 가지 (Sonnet 선택):
- **(A-1) 회의 시작 직전 인트로 카드** — 모든 멤버 시그니처 *한 화면* 에 카드 줄 (~2초 표시 후 첫 청크로). 영화 OP 처럼.
- **(A-2) 그 페르소나의 첫 발언 카드 상단** — orb 옆에 italic 작은 글씨로. 자연스럽게.

**권장**: **(A-2)** — 인지부하 적고 자연스러움. (A-1) 은 *더 게임감* 이지만 *너무 무거움*.

### B. Aha 모먼트 — `isKeyPoint` 시각 강화

기존: 좌측 색띠 8px + `border-accent/50` 만.
신규:
- **카드 글로우 펄스 (CSS, 1회)** — reveal 직후 0.6s 동안 `box-shadow` 가 accent 색으로 확산했다 사라짐.
- **orb 전구 효과** — `isKeyPoint=true` 발언 카드의 orb 가 등장 시 *밝아짐 → 가라앉음* (1회 keyframe).
- **카드 좌측에 ★ 아이콘 마커** (or `Sparkles` 작게) — 한눈에 *핵심 발언* 식별.

`app/globals.css` 에 새 keyframes:

```css
@keyframes keypoint-pulse {
  0%   { box-shadow: 0 0 0 0 var(--accent-glow); }
  50%  { box-shadow: 0 0 24px 4px var(--accent-glow); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
```

`tailwind.config.ts` 의 `animation` 에:
```ts
'keypoint-pulse': 'keypoint-pulse 0.8s ease-out',
```

`MessageCard.tsx` 에서 `message.isKeyPoint && 'animate-keypoint-pulse'` 적용.

### C. SteeringPanel — *결정 무게* 시각화

기존: ✦ 후보가 accent 보더 + Sparkles 아이콘.
신규:
- **✦ 후보 카드 크기 ↑** (다른 후보보다 20% 큼 + 위 30% 굵은 폰트)
- **호버/포커스 시 *무게* 시각** — 카드 살짝 들어올림 (`hover:-translate-y-1`) + glow 강도 ↑.
- **선택 직후 *결정의 무게* 모먼트** — 클릭 → 카드가 *확대되며 화면 가운데로 슬라이드* → 0.3s 후 다음 청크 generating 진입. ✦ 후보 클릭 시 더 긴 모션 (0.5s, accent 폭발).
- **분기 카운터** — SteeringPanel 헤더에 "✦ 못 본 각도 1개 / 일반 N개" 카운터.

### D. 분야별 회의실 배경 (`detectedDomain` 기반)

`useDebate` 또는 `session/[id]/page.tsx` 에서 `session.domain` 또는 *cast 가 다루는 분야* 에 따라 `--stage-bg` 의 색조를 분기. 5개 분야 톤 (Sonnet 결정):

- **수의/의료** → 차분한 cyan/teal radial
- **금융/창업** → emerald/blue
- **법률** → indigo/violet
- **창작/디자인** → amber/rose
- **기타/일반** → 기존 surface 톤 (현재값 유지)

매핑 표를 `lib/stage-theme.ts` 또는 `app/(main)/session/[id]/page.tsx` 에 박제.

`session.domain` 이 명시 안 됐으면 기본값. 운영자가 추후 어드민 편집 가능 (옵션, 별도 마일스톤).

### E. 페르소나 호명 — 발언 첫 줄 강조 (가벼움)

`MessageCard.tsx` — 발언 본문이 *다른 페르소나 이름* 으로 시작하면 (예: `"잡스의 그 말은..."`) 그 이름을 *볼드 + accent 색* 으로 강조. 정규식 또는 `cast.name` 매칭.

이건 *모델 생성* 발언에 대한 후처리이므로 일관성 약함 — 옵션. Sonnet 이 *간단한 매칭* (`cast` 의 이름들 중 첫 단어와 일치) 으로 구현. 매칭 안 되면 그대로.

### F. 삼국지 능력치 — *trait 3축 ★ 게이지* (클래식 시뮬 차용)

PersonaCard 와 PersonaStageStrip 에 *능력치 게이지* 추가. 각 축마다 1~5 ★:

- **stance** — advocate=추진력 / critic=비판력 / agnostic=통찰력 (라벨)
- **lens** — analyst=분석력 / empath=공감력 / pragmatist=실전력
- **expression** — provocateur=도발력 / measured=조정력

값은 *고정 5점* (단순) 또는 *trait 별 다른 점수표* — Sonnet 결정. 1차는 **고정 5점 표시** (값 1~5 가 모두 archetype 마다 동일). 후속에서 archetype 별 점수 다르게 부여 가능.

표기 형태:
```
[추진력 ★★★★★] [실전력 ★★★★☆] [도발력 ★★★☆☆]
```

위치 — PersonaCard:
- 이름 행 아래, role 아래.
- 작은 칩 3개 (한 줄, 모바일 truncate 허용).

위치 — PersonaStageStrip:
- orb 아래 이름 아래.
- *호버* 시에만 표시 (정적 시인성 유지).

### G. 청크 인트로 컷신 — *프린세스 메이커 식* (클래식 시뮬 차용)

`useDebate` 의 phase 머신에 **`intro` 단계 신규** — `generating` 다 끝나고 `playing` 진입 직전 *1~2초 인트로*. 컴포넌트 `ChunkIntroCutscene.tsx` 신규.

내용:
```
┌─────────────────────────────────────────┐
│   #동물병원 SaaS                          │  ← 분야 라벨 (큰 폰트)
│                                          │
│   [orb] 잡스형 디자이너                   │  ← 첫 발언자 시그니처
│         "이게 *왜* 존재해야 합니까?"      │
│                                          │
│   ──────────────────────                 │
│   이번 장면 — "원장 1인 결정 6개월"        │  ← topic (steering 에서 고른 것)
└─────────────────────────────────────────┘
```

- **1.5초 자동 표시** 후 fade-out → `playing` 진입.
- 사용자가 *건너뛰기 클릭* 가능 (즉시 playing).
- 첫 청크는 *모든 멤버 시그니처* 한 화면 표시 (롤 소개 모드, 3초 약간 더 길게).

CSS animation: `cutscene-enter` (fade + scale) / `cutscene-exit`. `app/globals.css` 박제.

phase 머신 변경: `idle → generating → intro → playing → steering → ...`. `useDebate` 의 `intro` 도입 + `INTRO_DURATION_MS = 1500`.

### G+ (옵션) 동급생 식 페르소나 아바타

orb 대신 *lucide-react 아이콘 매핑* 1차. archetype 별 아이콘 추천:
- cold-investor → `BarChart3`
- cynical-dev → `Code2`
- jobs-designer → `Sparkles`
- realist → `Mountain`
- startup-expert → `Rocket`
- branding-strategist → `Palette`
- psychologist → `Heart`
- growth-marketer → `TrendingUp`
- domain-expert → `BookOpen`
- facilitator → `Users`

PersonaOrb 가 `state==='avatar'` 모드일 때 아이콘 표시 옵션. **이건 ⑤-5d (별도 출하)** — 큰 변경이라 분리.

---

## 5. 영향 파일 맵

```
신규:
  lib/stage-theme.ts          (선택) 분야별 --stage-bg 매핑

갱신 (A 시그니처):
  types/persona.ts            Archetype.signatureLine?: string
  data/personas.json          10명에 signatureLine 추가 (부록 A 박제)
  components/debate/MessageCard.tsx  첫 발언 카드 상단 시그니처 표시

갱신 (B Aha):
  app/globals.css                @keyframes keypoint-pulse
  tailwind.config.ts             animate-keypoint-pulse 등록
  components/debate/MessageCard.tsx  isKeyPoint reveal 시 animate-keypoint-pulse + ★ 마커

갱신 (C 결정 무게):
  components/debate/SteeringPanel.tsx
    - ✦ 후보 시각 가중치 (크기·glow·hover translate)
    - 선택 모션 (클릭 후 카드 확대 0.3~0.5s)
    - 카운터

갱신 (D 분야 배경):
  app/(main)/session/[id]/page.tsx  domain → --stage-bg 매핑
  app/globals.css                    분야별 변수 (5개)

갱신 (E 호명 강조):
  components/debate/MessageCard.tsx  발언 본문 첫 단어 매칭 후 강조
```

총 6~7개 파일 (신규 0~1 + 갱신 5~6).

---

## 6. 손대지 말 것

- `lib/prompts/*` — 프롬프트 변경 없음 (시그니처는 *데이터*, 자연어 변경 아님).
- `lib/ai/*` — LLM 호출 로직 무관.
- `BASE_PROMPT`, `OUTPUT_HINT`, directive 8개 — 절대 금지.
- 자율 스크롤 (`NEAR_BOTTOM_PX`, `unreadCount`) — 유지.
- `useDebate` phase 머신·`generateChunk`·`sanitizeChunk` — 무관.
- PersonaDetailDrawer / PersonaStageStrip — 시각 회귀 없도록 손대지 말 것.
- WaitingMemoArea (⑤-1f-C) — 무관.
- `motion`/`framer-motion` 도입 — 트랙 ⑤-4.

---

## 7. 검증 기준

### 7.1 자동 검증

- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` 통과.
- [ ] 옛 세션 회귀 — `signatureLine` 없는 archetype 도 정상 렌더 (옵셔널).

### 7.2 사람 검증

- [ ] 청크 첫 발언에 해당 페르소나 *시그니처 한 줄* 표시 — 카드 정체성 강화.
- [ ] `isKeyPoint` 발언 reveal 시 카드가 *맥동* 하고 ★ 마커 표시 — *Aha 모먼트* 식별.
- [ ] SteeringPanel 의 ✦ 후보가 *시각적으로 무게* 있음 (크기·glow). 다른 후보와 *비교* 됨.
- [ ] ✦ 후보 클릭 시 *결정 모션* (0.5s 확대) 후 다음 청크 generating.
- [ ] `domain` 이 설정된 세션은 회의실 배경이 *분야 톤* — 일반 세션과 구분.
- [ ] (E) 페르소나 호명 시 첫 단어 강조 — 자연스럽고 *과하지 않음*.

---

## 8. 출하 단위 — 작게 쪼개기

### ⑤-5a-1. 시그니처 + Aha (블로킹, 가장 가벼움 — 출하 완료 2026-05-31)

§4-A + §4-B. 시그니처 멘트(10명 SIGNATURE_LINES 박제) + Aha 모먼트(keypoint-pulse + ★ 핵심 마커). PersonaCard 손대지 않음.

### ⑤-5a-2. 능력치 ★ 게이지 + archetype 별 점수 (블로킹, 후속)

§4-F. **분리 이유:** 1차에서 *고정 5점* 만 박제하면 변별력 0. archetype 별 *차별화된 점수표* (예: 잡스=추진5/실전4/도발5, 사회자=추진2/분석4/조정5) 를 함께 박제해야 시각 가치 ↑. `data/personas.json` 또는 `lib/prompts/personas` 에 `STAT_SCORES: Record<archetypeId, Record<traitAxis, 1~5>>` 신규 박제.

### ⑤-5b. 결정 무게 + 인트로 컷신 (프메 식)

§4-C + §4-G. SteeringPanel 강화 + 청크 인트로 1.5초 컷신 (`intro` phase 신규).

### ⑤-5c. 분야 배경 + 호명 강조

§4-D + §4-E. Inworld 식 공간 + Mass Effect 식 banter. 폴리시.

### ⑤-5d. (옵션·큰 변경) 페르소나 아바타 — 동급생 식

§4-G+ . orb → lucide 아이콘 매핑. PersonaOrb 의 `avatar` 모드. 별도 PR.

---

## 9. 완료 후

- `backlog.md` Active 에 ⑤-5 항목 추가 → 완주 시 Done.
- 시각 검수 결과로 *몰입도 체감 증가* 확인.
- 다음 트랙 결정 (③ 카드 디렉션 / ② 결정 지도 / ④ 거울).

---

## 부록 A — `signatureLine` 본문 10명 (Opus 박제)

```json
{
  "cold-investor":        "결정은 숫자에서 갈린다.",
  "cynical-dev":          "우리는 이미 한 번 망해본 적이 있어.",
  "jobs-designer":        "이게 *왜* 존재해야 합니까?",
  "realist":              "이론은 매끈하지만 현장은 그렇지 않습니다.",
  "startup-expert":       "구조를 보면 결정이 보입니다.",
  "branding-strategist":  "사람들이 *기억하는* 것은 결정의 잔향뿐입니다.",
  "psychologist":         "결정 뒤에는 사람이 남습니다.",
  "growth-marketer":      "지금 안 움직이면 6개월 뒤엔 늦습니다.",
  "domain-expert":        "그 분야의 *진짜 문제* 는 다른 데 있어요.",
  "facilitator":          "우리가 *진짜로* 풀어야 할 질문이 뭡니까?"
}
```

Sonnet 은 위 본문을 `data/personas.json` 의 각 항목 `signatureLine` 필드로 박제. 임의 변경 금지.

---

## 부록 B — Aha 모먼트 CSS 본문 (Opus 박제)

```css
:root {
  --accent-glow: color-mix(in srgb, var(--accent) 60%, transparent);
}

@keyframes keypoint-pulse {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  35%      { box-shadow: 0 0 24px 4px var(--accent-glow); }
  70%      { box-shadow: 0 0 12px 2px var(--accent-glow); }
}
```

Tailwind animation:

```ts
'keypoint-pulse': 'keypoint-pulse 0.8s ease-out',
```

`MessageCard.tsx` 의 isKeyPoint 카드:

```tsx
className={cn(
  /* ...기존... */,
  message.isKeyPoint && 'animate-keypoint-pulse',
)}
```

---

## 부록 C — 분야별 `--stage-bg` 매핑 (Opus 박제)

```ts
// lib/stage-theme.ts
export const DOMAIN_STAGE_BG: Record<string, string> = {
  의료:    'radial-gradient(circle at 50% -20%, color-mix(in srgb, #0E7490 35%, transparent), transparent 70%)',
  수의:    'radial-gradient(circle at 50% -20%, color-mix(in srgb, #0E7490 35%, transparent), transparent 70%)',
  금융:    'radial-gradient(circle at 50% -20%, color-mix(in srgb, #1E40AF 35%, transparent), transparent 70%)',
  창업:    'radial-gradient(circle at 50% -20%, color-mix(in srgb, #047857 35%, transparent), transparent 70%)',
  법률:    'radial-gradient(circle at 50% -20%, color-mix(in srgb, #4338CA 35%, transparent), transparent 70%)',
  창작:    'radial-gradient(circle at 50% -20%, color-mix(in srgb, #B45309 35%, transparent), transparent 70%)',
  디자인:  'radial-gradient(circle at 50% -20%, color-mix(in srgb, #B45309 35%, transparent), transparent 70%)',
};

export function stageBgFor(domain: string | null | undefined): string {
  if (!domain) return 'var(--stage-bg)';  // 기존 기본값
  // 부분 일치 — '동물병원 SaaS' → '의료' 키 안 맞으니 '의료' 가 들어가야 매칭됨.
  for (const [k, v] of Object.entries(DOMAIN_STAGE_BG)) {
    if (domain.includes(k)) return v;
  }
  return 'var(--stage-bg)';
}
```

`session/[id]/page.tsx` 최상위 div:
```tsx
style={{ backgroundImage: stageBgFor(domain) }}
```

기본값은 ⑤-2b 의 `--stage-bg` 그대로 — *회귀 없음*.
