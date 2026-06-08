# 작업 의뢰서 — ⑤-5a-2: 능력치 ★ 게이지 + archetype 점수표

> 담당: Claude Code (Sonnet)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `workorder-debate-5-5-gamify.md` §4-F · §8(⑤-5a-2 분리 사유), `workorder-persona-E-multitrait.md`(3축 trait 출하 완료)
> 선행 상태: ⑤-5a-1(시그니처 + Aha) 출하 완료. `SIGNATURE_LINES` 가 `lib/prompts/personas/index.ts` 에 박제됨 — 이 워크오더의 `STAT_SCORES` 도 *같은 파일·같은 패턴* 으로 붙는다.

---

## 0. 한 줄 목표

삼국지/RPG 의 *능력치 화면* 을 차용해 각 페르소나를 **trait 3축 ★ 게이지**(1~5)로 시각화한다. ⑤-5f 가 일러스트로 캐릭터 *얼굴* 을 박았으니, 이번은 캐릭터 *능력치* — 식별성과 변별력 완성.

---

## 1. 핵심 설계 — 라벨은 trait 값에서, 점수는 archetype별 박제

trait 3축의 각 *값* 이 능력치 *라벨* 이 된다(gamify §4-F 매핑). 점수(1~5)는 archetype별로 손으로 박제한 `STAT_SCORES` 에서 온다.

| 축 | trait 값 → 능력치 라벨 |
|---|---|
| **stanceAxis** | advocate→**추진력** / critic→**비판력** / agnostic→**통찰력** |
| **lens** | analyst→**분석력** / empath→**공감력** / pragmatist→**실전력** |
| **expression** | provocateur→**도발력** / measured→**조정력** |

즉 한 페르소나는 *자기 trait 가 가리키는 3개 능력치*만 표시한다. 예: `cold-investor`(critic/analyst/measured) → **비판력·분석력·조정력** 3개. 능력치 *이름* 은 캐릭터마다 다르다(이게 식별성의 핵심).

> **왜 고정 5스탯(삼국지식 통/무/지/정/매)이 아닌가:** 모바일 카드에 5개 게이지는 과중. trait 3축 = 이미 제품의 1급 분류 체계 → 그 위에 점수만 얹으면 *데이터 0 신규 개념*. `Record<archetypeId, Record<traitAxis, 1~5>>` 라는 §8 의 타입 시그니처와도 정확히 일치.

### 변별력 보강 — 같은 trait 조합도 점수로 구분

3축 조합이 겹치는 페르소나 쌍이 있다. 점수가 이들을 갈라준다(트레잇만으로는 구분 불가했던 해상도를 점수가 추가):

- `realist` vs `domain-expert` — 둘 다 {critic, pragmatist, measured}. realist 는 *가정 검증*(비판4·실전5), domain-expert 는 *업계 지식*(비판3·실전5·조정4).
- `startup-expert` vs `facilitator` — 둘 다 {agnostic, analyst, measured}. startup-expert 는 *분석 편향*(분석5), facilitator 는 *조정 편향*(조정5).

---

## 2. 절대 원칙 (gamify §3 승계)

1. **시각 효과는 이해를 도와야 한다** — 능력치는 *캐릭터 식별* 정보. 장식 아님.
2. **모바일 퍼스트** — 카드 게이지는 한 줄, 작은 화면에서도 읽힘.
3. **CSS only** — `motion`/`framer-motion` 금지. 별점은 텍스트 글리프(★/☆) + Tailwind.
4. **굴복 금지·프롬프트 불변** — 능력치는 *순수 데이터·UI*. `lib/prompts/base`·`BASE_PROMPT`·directive·`composePersonaPrompt` *합성 로직* 손대지 말 것. 점수는 프롬프트에 주입하지 않는다(표시 전용).
5. **무대 정적 시인성 보존** — `PersonaStageStrip` 의 항상-노출 레이아웃 회귀 금지(§4-C 참조).
6. **generated/custom 폴백** — `STAT_SCORES` 에 없는 멤버(archetype 아님)도 정상 렌더. `SIGNATURE_LINES` 와 동일한 graceful 폴백.

---

## 3. 데이터 박제 — `lib/prompts/personas/index.ts`

`SIGNATURE_LINES` 바로 아래에 추가. 본문은 **부록 A** 그대로 박제(임의 변경 금지).

```ts
import type { StanceAxis, Lens, Expression, CastMember } from '@/types/persona';

/** ⑤-5a-2 — trait 값 → 능력치 라벨 매핑. */
export const STANCE_STAT_LABEL: Record<StanceAxis, string> = {
  advocate: '추진력',
  critic:   '비판력',
  agnostic: '통찰력',
};
export const LENS_STAT_LABEL: Record<Lens, string> = {
  analyst:    '분석력',
  empath:     '공감력',
  pragmatist: '실전력',
};
export const EXPRESSION_STAT_LABEL: Record<Expression, string> = {
  provocateur: '도발력',
  measured:    '조정력',
};

/** 능력치 점수 1~5. 표시 전용 — 프롬프트 합성에 쓰지 않는다. */
export type StatScore = 1 | 2 | 3 | 4 | 5;
export interface StatTriple {
  stanceAxis: StatScore;
  lens: StatScore;
  expression: StatScore;
}

/**
 * ⑤-5a-2 — archetype별 능력치 점수표 (Opus 박제, 부록 A).
 * 키는 trait *축*. 라벨은 그 멤버의 trait *값* 으로 런타임 해석.
 * generated/custom(여기 없는 멤버)은 DEFAULT_STAT 폴백.
 */
export const STAT_SCORES: Record<string, StatTriple> = {
  'cold-investor':       { stanceAxis: 5, lens: 5, expression: 3 },
  'cynical-dev':         { stanceAxis: 5, lens: 4, expression: 5 },
  'jobs-designer':       { stanceAxis: 5, lens: 3, expression: 5 },
  'realist':             { stanceAxis: 4, lens: 5, expression: 3 },
  'startup-expert':      { stanceAxis: 4, lens: 5, expression: 4 },
  'branding-strategist': { stanceAxis: 4, lens: 5, expression: 3 },
  'psychologist':        { stanceAxis: 4, lens: 5, expression: 4 },
  'growth-marketer':     { stanceAxis: 5, lens: 4, expression: 3 },
  'domain-expert':       { stanceAxis: 3, lens: 5, expression: 4 },
  'facilitator':         { stanceAxis: 4, lens: 3, expression: 5 },
};

/** generated/custom 폴백 — 정의 trait(stance)만 약간 높게. */
const DEFAULT_STAT: StatTriple = { stanceAxis: 4, lens: 3, expression: 3 };

/** 한 멤버의 *표시용* 능력치 3개 — {라벨, 점수}. 카드·드로어 공용. */
export function statsForMember(
  member: Pick<CastMember, 'archetypeId' | 'trait'>,
): { label: string; score: StatScore }[] {
  const s =
    (member.archetypeId && STAT_SCORES[member.archetypeId]) || DEFAULT_STAT;
  return [
    { label: STANCE_STAT_LABEL[member.trait.stanceAxis],   score: s.stanceAxis },
    { label: LENS_STAT_LABEL[member.trait.lens],           score: s.lens },
    { label: EXPRESSION_STAT_LABEL[member.trait.expression], score: s.expression },
  ];
}
```

> `import` 줄은 파일 상단 기존 import 에 병합(중복 타입 import 주의). `statsForMember` 가 라벨 해석 + 폴백을 한 곳에 캡슐화 → 카드·드로어는 점수표를 몰라도 됨.

---

## 4. UI — `<StatGauge>` 신규 + 3곳 배치 결정

### 신규 컴포넌트 — `components/persona/StatGauge.tsx`

별점 한 줄 렌더러. 텍스트 글리프(★ 채움 / ☆ 빈칸), CSS only, 접근성 라벨 포함.

```tsx
import { cn } from '@/lib/utils';

interface StatGaugeProps {
  label: string;
  score: 1 | 2 | 3 | 4 | 5;
  /** 채운 별 색 — 기본 accent, 카드에선 persona colorTo 주입 가능. */
  color?: string;
  /** 'sm' 카드용(작게) | 'md' 드로어용. */
  size?: 'sm' | 'md';
  className?: string;
}

export function StatGauge({ label, score, color, size = 'sm', className }: StatGaugeProps) {
  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="img"
      aria-label={`${label} 5점 만점에 ${score}점`}
    >
      <span
        className={cn(
          'shrink-0 text-text-muted',
          size === 'sm' ? 'text-[10px]' : 'text-xs',
        )}
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'font-mono leading-none tracking-tight',
          size === 'sm' ? 'text-[11px]' : 'text-sm',
        )}
        style={{ color: color ?? 'var(--accent)' }}
      >
        {'★'.repeat(score)}
        <span className="text-text-dim">{'☆'.repeat(5 - score)}</span>
      </span>
    </div>
  );
}
```

### 배치 ① — `PersonaCard.tsx` (picking + 패널 카드)

trait 칩 행 *바로 아래*, role 줄 *위* 에 게이지 3개를 한 줄로. **읽기 전용**(칩의 cycle 인터랙션과 무관). 좁은 화면 `flex-wrap` 허용.

```tsx
import { statsForMember } from '@/lib/prompts/personas';
import { StatGauge } from './StatGauge';

// trait 3축 칩 행(기존 </div>) 직후:
<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
  {statsForMember(member).map((s) => (
    <StatGauge key={s.label} label={s.label} score={s.score} color={member.colorTo} />
  ))}
</div>
```

- 색은 `member.colorTo`(orb 끝색)로 채워 카드 정체성과 묶음.
- 칩(카테고리) + 게이지(강도)는 *상보적* — 칩은 "무엇", 게이지는 "얼마나".

### 배치 ② — `PersonaDetailDrawer.tsx` (캐릭터 시트, 풀 노출)

드로어 헤더(trait 칩 영역, 현재 169~214행) *직후* + "발언 수 바"(216행) *직전* 에 능력치 패널 섹션 신규. 여기가 *삼국지 능력치 화면* 의 본진 — `size='md'`, 라벨+별 세로 정렬로 또렷하게.

```tsx
{/* ⑤-5a-2 — 능력치 패널 */}
<div className="shrink-0 border-b border-border/50 px-5 py-3">
  <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-muted/60">
    능력치
  </p>
  <div className="flex flex-col gap-1.5">
    {statsForMember(member).map((s) => (
      <StatGauge key={s.label} label={s.label} score={s.score} size="md" color={member.colorTo} />
    ))}
  </div>
</div>
```

### 배치 ③ — `PersonaStageStrip.tsx` → **변경 없음** (의도적 설계 결정)

gamify §4-F 는 "StageStrip orb 아래, *호버 시* 표시"를 제안했으나 **채택하지 않는다**:

- 모바일엔 호버가 없어 절반의 사용자가 못 봄.
- 무대 strip 은 *활성 화자 추적* 이 본업 — 게이지를 얹으면 정적 시인성 회귀(§2-5 위반).
- orb 클릭 → DetailDrawer 가 *이미* 캐릭터 상세 동선 → 능력치는 거기(배치 ②)가 정답.

즉 **§4-F 의 strip-hover 아이디어를 DetailDrawer 로 이전**. strip 코드는 손대지 않는다.

---

## 5. 영향 파일 맵

```
신규:
  components/persona/StatGauge.tsx          별점 렌더러 (§4)

갱신:
  lib/prompts/personas/index.ts             STAT_SCORES + 라벨맵 + statsForMember (§3, 부록 A)
  components/persona/PersonaCard.tsx         trait 칩 아래 게이지 3개 (배치 ①)
  components/debate/PersonaDetailDrawer.tsx  헤더 직후 능력치 패널 (배치 ②)
```

총 4개(신규 1 + 갱신 3). `PersonaStageStrip.tsx` 는 **손대지 않음**.

---

## 6. 손대지 말 것

- `lib/prompts/base`·`BASE_PROMPT`·`OUTPUT_HINT`·directive 8개·`composePersonaPrompt` 합성 로직 — 점수는 표시 전용, 프롬프트 무관.
- `data/personas.json` — 점수는 `index.ts` 코드 상수로(SIGNATURE_LINES 와 동일 위치). JSON 스키마 변경 불필요.
- `types/persona.ts` 의 `Archetype`/`CastMember` — 필드 추가 없음(`StatTriple` 은 index.ts 로컬 타입).
- `PersonaStageStrip.tsx` — 무대 정적 레이아웃 보존(§4-③).
- ⑤-5a-1 `SIGNATURE_LINES`·Aha keyframe — 회귀 금지.
- 자율 스크롤·재생 엔진(⑤-1/⑤-2) — 무관.

---

## 7. 검증 기준

### 7.1 자동

- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` 통과.
- [ ] `STAT_SCORES` 키 10개가 `data/personas.json` 의 id 10개와 정확히 일치(오타 0).
- [ ] generated/custom 멤버(archetypeId 없음) 카드/드로어 — `DEFAULT_STAT` 로 정상 렌더(크래시 0).

### 7.2 사람 검증

- [ ] PersonaCard — trait 칩 아래 능력치 3개가 *한 줄*, 라벨이 멤버 trait 와 일치(예: cold-investor=비판력·분석력·조정력).
- [ ] 별점이 점수표대로(예: jobs-designer 추진력 ★★★★★, 실전력 ★★★☆☆).
- [ ] 게이지 색이 persona colorTo — 카드 정체성과 묶임.
- [ ] DetailDrawer — 헤더 아래 "능력치" 패널, 별 또렷(size md).
- [ ] `realist` vs `domain-expert` 카드 *나란히* 비교 시 능력치 모양이 다름(변별력 확인).
- [ ] StageStrip — 회귀 없음(게이지 안 들어감, 활성 화자 추적 정상).
- [ ] 모바일 폭(375px) — 게이지 줄 깨지지 않고 wrap 또는 한 줄 유지.

---

## 8. 완료 후

- `backlog.md` Active 에 ⑤-5a-2 추가 → 완주 시 Done.
- 다음 우선순위 큐(`project` 메모리): ⑤-5c 분야 배경 + 호명 강조 / 트랙 ④ 거울 페르소나.

---

## 부록 A — `STAT_SCORES` 점수 근거 (Opus 박제)

각 점수의 캐릭터 정합성 근거. **점수 본문은 §3 그대로, 변경 금지.** 표는 라벨(=trait 값) 해석 포함.

| archetype | stance(라벨·점) | lens(라벨·점) | expression(라벨·점) | 설계 의도 |
|---|---|---|---|---|
| cold-investor | 비판력 5 | 분석력 5 | 조정력 3 | 숫자=전부. 분석·비판 쌍5, 차가운 측정자. |
| cynical-dev | 비판력 5 | 분석력 4 | 도발력 5 | 독설가. 비판·도발 쌍5의 공격형. |
| jobs-designer | 추진력 5 | 실전력 3 | 도발력 5 | 비전 추진+도발 5, 실전(비용/출시)은 약점 3. |
| realist | 비판력 4 | 실전력 5 | 조정력 3 | 3회 실패 창업자. 실전 5가 정체성. |
| startup-expert | 통찰력 4 | 분석력 5 | 조정력 4 | 프레임워크형. 분석 편향 5. |
| branding-strategist | 추진력 4 | 공감력 5 | 조정력 3 | 인식·사람 중심. 공감 5. |
| psychologist | 통찰력 4 | 공감력 5 | 조정력 4 | 상담가. 공감 5 + 부드러운 조정 4. |
| growth-marketer | 추진력 5 | 실전력 4 | 조정력 3 | "지금 안 움직이면 늦는다" 행동 추진 5. |
| domain-expert | 비판력 3 | 실전력 5 | 조정력 4 | 업계 지식 실전 5. realist 와 점수로 분리. |
| facilitator | 통찰력 4 | 분석력 3 | 조정력 5 | 사회자. 조정 5가 정체성. startup-expert 와 분리. |

설계 규칙: 모든 페르소나가 *정확히 하나 이상의 5*(명확한 특기) 보유. 올-5 없음(값싼 만렙 방지). 합계 12~14 로 균형. 같은 trait 조합 쌍은 점수 모양이 반드시 다름(변별력).
