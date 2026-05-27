# 워크오더 부록 — CP3 (§5.6 PersonaPicker 재작성 + 커스텀 폼)

> 본 부록은 `workorder-persona-B-cast.md` §5.6 을 **Sonnet 이 그대로 실행 가능한 구체 지시**로 풀어쓴 것.
> 진행 가이드(`plan-track1-phase-b-completion.md`)의 CP3 단계와 1:1 매칭.
> 작성: Opus / 2026-05-26
> **선행 게이트:** CP1(§5.1 운영자 라이브 검증) 통과 필요. CP2 튜닝이 있었다면 그 결과 반영 후.
> 담당: Claude Code (Sonnet)

---

## 0. 한 줄 목표

PersonaPicker 의 props 를 **`cast: CastMember[]` 단일 prop 중심**으로 압축하고, archetype/generated/custom 멤버를 **한 리스트**로 통합 표시한다. 커스텀 추가 폼을 신설한다(자유 프롬프트 입력 없음).

---

## 1. 절대 원칙 (워크오더 §2 재확인)

1. **자유 프롬프트 입력란을 만들지 않는다.** 커스텀 폼은 이름·역할·temperament·입장 4필드만. `BASE_PROMPT` prepend 가 굴복 금지를 자동 보장하는 구조를 깨지 말 것.
2. **B-2 범위 밖**: regenerate(Phase D), "내 페르소나 서랍" 저장(Phase C), 회의 중 커스텀 추가. 이 셋은 만들지 말 것.
3. **렌더링 cast 전환(§5.7) 은 CP4 에서.** 이 CP3 에서는 picking 화면만 cast 기반으로 바꾼다. debate/summary/history 는 다음 단계 담당.

---

## 2. PersonaPicker 새 시그니처 (확정)

```tsx
// components/session/PersonaPicker.tsx

interface PersonaPickerProps {
  /** 현재 패널의 모든 멤버 (archetype + generated + custom + 사회자). 사회자는 별도 카드로 분리 렌더. */
  cast: CastMember[];
  /** archetype 멤버용 추천 사유 맵 (archetypeId → reason). generated/custom 은 사유가 없음. */
  reasons: Record<string, string>;
  /** 추천기가 감지한 도메인 표시용. */
  domain: string | null;
  /** 멤버 제거 — facilitator/source 무관 모두 가능 (단 facilitator 는 UI 노출 안 함). */
  onRemove: (memberId: string) => void;
  /** 아키타입 풀에서 swap — archetype 멤버를 다른 archetype 으로 교체. generated/custom 에는 노출 안 함. */
  onSwap: (memberId: string, newArchetypeId: string) => void;
  /** 풀에서 새 archetype 추가. */
  onAddFromPool: (archetypeId: string) => void;
  /** 커스텀 폼 제출. */
  onAddCustom: (input: CustomPersonaInput) => void;
  onStart: () => void;
  busy?: boolean;
}

export interface CustomPersonaInput {
  name: string;       // 1~20자
  role: string;       // 1~40자
  temperament: Temperament;
  stance: string;     // 1~120자
}
```

**제거되는 props (기존 → 새 시그니처에서 사라지는 것):**

- `recommendedIds: string[]` — `cast` 안에 다 들어있음
- `stances: Record<string, string>` — `member.stance` 로 흡수
- `selectedIds: string[]` — 더 이상 "토글 선택" 개념이 없음 (cast 가 곧 선택된 멤버)
- `generatedCast?: CastMember[]` — `cast` 에 통합
- `onToggle` — `onRemove` / `onAddFromPool` 로 분리

---

## 3. PersonaCard 새 시그니처 (확정)

```tsx
// components/persona/PersonaCard.tsx

interface PersonaCardProps {
  member: CastMember;
  /** archetype 멤버용 추천 사유 (있을 때만 표시) */
  recommendReason?: string;
  /** swap/remove 액션 노출 여부. picking 화면에서는 true, 풀(아키타입 선택)에서는 false. */
  showActions?: boolean;
  onRemove?: (memberId: string) => void;
  /** archetype 멤버 swap 시작 — 부모가 모달/드롭다운 띄움. generated/custom 에는 비활성. */
  onSwapStart?: (memberId: string) => void;
  disabled?: boolean;
}
```

**핵심 변경:**

- `persona: Archetype` → `member: CastMember`. orb 색은 `member.colorFrom/To` 직접 사용 (`TEMPERAMENT_COLORS` 적용 결과가 이미 들어있음).
- `selected` prop 제거. picker 가 cast 에 있는 멤버만 카드로 그리므로 *모든 카드는 "활성"* 상태로 그린다.
- `stance` prop 제거 — `member.stance` 직접 사용.
- `domain` prop 제거 — 이미 워크오더 §4.5 에서 `composePersonaPrompt` 인자에서도 빠짐.
- `void domain` 같은 호환 코드 전부 제거.

**카드 정보 우선순위 (상→하):**

```
[orb] [이름] ······· [temperament 뱃지] [액션 메뉴 ⋯]
       역할
       ┌ 입장: ___________________  ← stance (있으면 항상 표시, accent 강조)
       └ 추천: ___________________  ← recommendReason (archetype 멤버에만)
```

---

## 4. 새 UI 구조 (PersonaPicker 본문)

```
┌────────────────────────────────────────────────────┐
│ 헤더                                                │
│   "이 사람들이 토론할 거예요."                      │
│   설명 + 감지된 분야 칩                             │
├────────────────────────────────────────────────────┤
│ 패널 (cast 통합 리스트)                              │
│   [PersonaCard #1] ─ archetype, recommendReason 표시│
│   [PersonaCard #2] ─ generated, temperament 뱃지   │
│   [PersonaCard #3] ─ custom, "내가 추가" 라벨       │
│   ...                                              │
│   ┌──────────────────────────────────────┐         │
│   │  + 다른 페르소나 추가  ▼              │ ← 풀   │
│   │  + 직접 만들기  ▼                    │ ← 폼   │
│   └──────────────────────────────────────┘         │
├────────────────────────────────────────────────────┤
│ 사회자 자동 포함 안내 (기존 그대로)                  │
├────────────────────────────────────────────────────┤
│ [sticky 하단]  ○○○○○ 5명 참여   [회의 시작]         │
└────────────────────────────────────────────────────┘
```

### 4.1 패널 리스트 — 통합 표시

`cast` 를 `member.isFacilitator` 인 것만 빼고 그대로 카드로 나열한다. 현재의 *추천 / 즉석 설계 / 사회자 / 풀* 4구역 분리는 폐기.

- `source === 'archetype'` 이고 `reasons[member.archetypeId!]` 가 있으면 추천 사유 표시.
- `source === 'generated'` 면 카드 좌측에 `즉석 설계` 라벨 (배경: `accent/15`, 텍스트: `accent`).
- `source === 'custom'` 면 카드 좌측에 `내가 추가` 라벨 (배경: `primary/15`, 텍스트: `primary`).

### 4.2 멤버 액션 메뉴 (⋯ 버튼)

각 카드 우상단에 `⋯` (lucide `MoreHorizontal`). 클릭 시 드롭다운(shadcn `DropdownMenu` — 없으면 자체 popover):

- **archetype**: "다른 아키타입으로 교체" / "제거"
- **generated**: "제거" 만 (regenerate 는 Phase D)
- **custom**: "제거" 만 (편집은 제거 후 재추가)
- **facilitator**: 액션 메뉴 자체를 노출하지 않음

"제거" 누르면 `onRemove(member.id)` 호출, 즉시 카드 사라짐.
"다른 아키타입으로 교체" → 미사용 아키타입 목록(facilitator/domain-expert 제외, 이미 cast 에 있는 archetype 제외) 드롭다운 → 선택 시 `onSwap(member.id, newArchetypeId)` 호출.

### 4.3 "다른 페르소나 추가" — 아키타입 풀 (접힘)

기존 접힘 UI 유지. 단:

- 이미 cast 에 있는 archetype 은 풀에서 숨김 (현재 코드는 회색처리 — 더 명확히 *숨김* 으로).
- 풀 카드는 클릭 시 `onAddFromPool(archetypeId)`. PersonaCard 의 `showActions={false}` 모드로 그린다.
- 카드 우측의 ⊕ 아이콘 유지.

### 4.4 "직접 만들기" — 커스텀 폼 (접힘)

기본 접힘. 펼치면 인라인 폼 (모달 아님):

```
┌─ 직접 만들기 ─────────────────────────────────┐
│  이름                                          │
│  [ 베테랑 수의사                          ]    │
│  한 줄 역할                                    │
│  [ 동물병원 10년차 원장                   ]    │
│  성향                                          │
│  ⊙옹호가  ○비판가  ⊙분석가  ○독설가  ○공감가  │
│  입장                                          │
│  [ SaaS 보다 종이 차트가 낫다는 이유는...  ]   │
│  [ 추가 ]                          [ 취소 ]   │
└────────────────────────────────────────────────┘
```

**검증 규칙 (제출 버튼 활성 조건 + 제출 시 재검증):**

| 필드 | 규칙 | 에러 메시지 |
|---|---|---|
| name | 공백 trim 후 1~20자 | `이름은 1~20자 사이` |
| role | trim 1~40자 | `역할은 1~40자 사이` |
| temperament | 5종 중 1개 필수 | `성향을 선택해주세요` |
| stance | trim 1~120자 | `입장은 1~120자 사이` |

검증 실패 시 해당 필드 아래 빨간 helper text. 토스트는 띄우지 말 것 (인라인 폼에 적절치 않음).

폼 제출 → `onAddCustom({ name, role, temperament, stance })` → 부모가 `synthesizeCharacterPrompt` 호출 → `CastMember(source:'custom', id:crypto.randomUUID(), characterPrompt, colors: TEMPERAMENT_COLORS[temperament])` 생성 → `cast` 에 push → 폼 닫고 리셋.

### 4.5 temperament 칩 — 한국어 라벨 + 색

5종 칩은 `TEMPERAMENT_COLORS` 의 `to` 색을 보더에, 활성 시 `from→to` gradient 배경. 라벨:

```ts
const TEMPERAMENT_LABEL_KR: Record<Temperament, string> = {
  advocate:    '옹호가',
  critic:      '비판가',
  analyst:     '분석가',
  provocateur: '독설가',
  empath:      '공감가',
};
```

카드의 temperament 뱃지도 위 라벨을 쓴다 (예: "분석가").

### 4.6 하단 sticky 미리보기

현재 코드 유지하되 `cast.length` 로 카운트. "회의 시작" 활성 조건: `cast.length >= 2`.

---

## 5. `session/new/page.tsx` 변경

**상태 단순화:**

```tsx
// Before
const [panelCast, setPanelCast] = useState<CastMember[]>([]);
const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
const [stances, setStances] = useState<Record<string, string>>({});
const [reasons, setReasons] = useState<Record<string, string>>({});
const [selectedIds, setSelectedIds] = useState<string[]>([]);

// After
const [cast, setCast] = useState<CastMember[]>([]);
const [reasons, setReasons] = useState<Record<string, string>>({});  // archetypeId → reason 만 유지
const [domain, setDomain] = useState<string | null>(null);
```

**handleAnalyze 단순화:**

```tsx
// designPanel → sanitizePanel → cast
const { cast: sanitized, notes } = sanitizePanel(result.panel);
if (notes.length > 0) toast.info(notes.join(' / '), { duration: 5_000 });

// 사회자 자동 포함 (기존 로직 유지)
const withFacilitator = ensureFacilitator(sanitized);

// reasons 맵
const reasonMap: Record<string, string> = {};
for (const raw of result.panel) {
  if (raw.source === 'archetype' && raw.archetypeId && raw.reason) {
    reasonMap[raw.archetypeId] = raw.reason;
  }
}

setCast(withFacilitator);
setReasons(reasonMap);
setDomain(result.detectedDomain ?? null);
setStep('picking');
```

**핸들러 신규/변경:**

```tsx
const handleRemove = useCallback((memberId: string) => {
  setCast((prev) => prev.filter((m) => m.id !== memberId && !m.isFacilitator
    ? m.id !== memberId
    : true,
  ));
  // 더 간단히:
  // setCast((prev) => prev.filter((m) => m.isFacilitator || m.id !== memberId));
}, []);

const handleSwap = useCallback((memberId: string, newArchetypeId: string) => {
  const arch = PERSONA_MAP[newArchetypeId];
  if (!arch) return;
  setCast((prev) =>
    prev.map((m) =>
      m.id === memberId && m.source === 'archetype'
        ? {
            id: newArchetypeId,                    // §4.3 — archetypeId == id
            source: 'archetype',
            archetypeId: newArchetypeId,
            name: arch.name,
            role: arch.role,
            temperament: arch.temperament,
            stance: m.stance,                       // 입장은 유지(사용자가 그 입장을 선택해서 swap 했다고 가정)
            colorFrom: arch.colorFrom,
            colorTo: arch.colorTo,
          }
        : m,
    ),
  );
}, []);

const handleAddFromPool = useCallback((archetypeId: string) => {
  const arch = PERSONA_MAP[archetypeId];
  if (!arch) return;
  setCast((prev) => {
    if (prev.some((m) => m.archetypeId === archetypeId)) return prev;  // 중복 가드
    return [...prev, {
      id: archetypeId,
      source: 'archetype',
      archetypeId,
      name: arch.name,
      role: arch.role,
      temperament: arch.temperament,
      stance: '',
      colorFrom: arch.colorFrom,
      colorTo: arch.colorTo,
    }];
  });
}, []);

const handleAddCustom = useCallback((input: CustomPersonaInput) => {
  const colors = TEMPERAMENT_COLORS[input.temperament];
  const newMember: CastMember = {
    id: crypto.randomUUID(),
    source: 'custom',
    name: input.name,
    role: input.role,
    temperament: input.temperament,
    stance: input.stance,
    colorFrom: colors.from,
    colorTo: colors.to,
    characterPrompt: synthesizeCharacterPrompt(input),
  };
  setCast((prev) => [...prev, newMember]);
}, []);

const handleStart = useCallback(() => {
  if (!provider) return toast.error('AI 공급사가 선택되지 않았습니다.');
  if (cast.length < 2) return toast.error('최소 2명 이상 참여해야 합니다.');
  const session = createSession({ concern, cast, aiProvider: provider, domain });
  router.push(`/session/${session.id}`);
}, [provider, cast, concern, domain, createSession, router]);
```

**렌더링:**

```tsx
{step === 'picking' && (
  <PersonaPicker
    cast={cast}
    reasons={reasons}
    domain={domain}
    onRemove={handleRemove}
    onSwap={handleSwap}
    onAddFromPool={handleAddFromPool}
    onAddCustom={handleAddCustom}
    onStart={handleStart}
  />
)}
```

---

## 6. 토스트 문구 (확정)

`sanitizePanel` 의 notes 가 들어왔을 때:

- "archetypeId '%s' 없음 → generated 강등" → 그대로 join 노출 (운영자 본인용이라 기술적 표현 OK)
- "패널 부족 → %s 자동 보충" → 그대로

운영자 외에 일반 사용자에게는 부드러운 문구가 낫지만, COUNCIL은 1인 개발자 본인+소수 베타라 현 톤 유지. 사용자 경험 개선은 Phase C.

`handleStart` 검증 실패:
- "최소 2명 이상 참여해야 합니다." (기존 "최소 2명 이상 선택해주세요" 에서 "선택" → "참여")

`handleRemove` 시 사회자 보호: facilitator 카드 자체를 노출하지 않아 자연 차단. 별도 토스트 불필요.

---

## 7. Sonnet 실행 체크리스트 (체크하며 진행)

코드 변경 순서 (각 단계 후 `pnpm typecheck` 통과 확인):

- [ ] **(A) 타입·헬퍼 추가**
  - `components/session/PersonaPicker.tsx` 의 `CustomPersonaInput` export
  - `lib/prompts/personas/index.ts` 또는 인접 모듈에 `TEMPERAMENT_LABEL_KR` 추가
  - `lib/persona-safety.ts` 의 `ensureFacilitator(cast: CastMember[]): CastMember[]` 헬퍼 신규 (현재 `session/new/page.tsx` 안의 facilitator 추가 로직을 함수로 추출)
- [ ] **(B) PersonaCard 재작성** (`components/persona/PersonaCard.tsx`)
  - `persona` → `member` prop, `selected`/`stance`/`domain` prop 제거
  - orb 색을 `member.colorFrom/To` 에서 직접
  - temperament 뱃지 추가 (`TEMPERAMENT_LABEL_KR` 사용)
  - `void domain` 같은 호환 코드 전부 제거
  - `showActions` true 일 때 ⋯ 메뉴 표시 (드롭다운 자체 구현 OK — shadcn 의존성 추가는 피할 것)
- [ ] **(C) PersonaPicker 재작성** (`components/session/PersonaPicker.tsx`)
  - props 새 시그니처로 교체
  - 패널 리스트를 `cast.filter(m => !m.isFacilitator)` 통합 단일 리스트로
  - generated/custom 라벨 칩
  - 풀 섹션 — `cast` 에 이미 있는 archetypeId 는 숨김
  - 커스텀 폼 (인라인, 자체 valid 검증)
- [ ] **(D) session/new/page.tsx 재배선**
  - state 5개 → 3개로 압축 (`cast`, `reasons`, `domain`)
  - `handleAnalyze` — sanitizePanel → ensureFacilitator → setCast
  - `handleRemove`/`handleSwap`/`handleAddFromPool`/`handleAddCustom`/`handleStart` 신규
  - `handleToggle` 제거
  - PersonaPicker 호출 인자 교체
- [ ] **(E) 검증**
  - `pnpm typecheck` 통과
  - `pnpm lint` 통과
  - `pnpm build` 통과
  - dev 서버 띄워서 시각 검수 (운영자 인계 직전)

---

## 8. 손대지 말 것 (재강조)

- `lib/prompts/orchestrator.ts`, `hooks/useDebate.ts` — CP4 담당. **이번 CP3 에서는 건드리지 않는다.**
- `components/debate/*`, `summary/page.tsx`, `history/page.tsx`, `RecentSessions.tsx` — CP4 담당.
- `conclusionSchema.personaPositions[].personaId` enum — CP4 §5.8.
- `BASE_PROMPT`, `OUTPUT_HINT`, temperament 지시 조각(prompts.json) — 절대 수정 금지.
- 회의 중 커스텀 추가(UserInput) — B-2 범위 밖.
- regenerate, persona 저장(서랍), temperament 필터 — Phase C/D.

---

## 9. 출하 기준

```
✓ pnpm typecheck / lint / build 모두 통과
✓ 운영자 시각 검수: picking 화면에 archetype/generated/custom 카드가 한 리스트로 표시
✓ 커스텀 폼으로 1명 추가 → 패널에 표시, 카드 좌측 "내가 추가" 라벨
✓ archetype 멤버의 ⋯ 메뉴에 swap/remove, generated/custom 멤버는 remove 만
✓ swap 시 stance 유지, 색·이름·역할 변경
✓ 풀에 이미 cast 에 있는 archetype 은 숨김
✓ 회의 시작 누르면 generated 멤버는 회의실에서 "???" — 정상 (§5.7 미완 — CP4 에서 해결)
```

회귀 검증:
- 기존 archetype만 추천된 세션도 정상 picking → 회의 시작 가능
- B-1 마이그레이션된 옛 세션은 CP3 와 무관 (이 흐름은 '새 세션' 생성 흐름)

---

## 10. 커밋 메시지

```
feat(persona): B-2 §5.6 — PersonaPicker 재작성 + 커스텀 폼

- PersonaPicker props 를 cast 단일 prop 으로 통합 (recommendedIds/stances/selectedIds 제거)
- PersonaCard 를 CastMember 기반으로 재작성 (Archetype 의존 제거)
- archetype/generated/custom 통합 단일 리스트 표시
- 카드 액션 메뉴 — archetype 은 swap/remove, generated/custom 은 remove
- "직접 만들기" 커스텀 폼 (이름/역할/temperament/stance 4필드, 자유 프롬프트 입력 없음)
- temperament 한국어 라벨, TEMPERAMENT_COLORS 직접 사용
- ensureFacilitator 헬퍼 추출
- session/new/page.tsx 상태 5개 → 3개로 압축

Co-Authored-By: Claude Opus (설계) <noreply@anthropic.com>
Co-Authored-By: Claude Sonnet (실행) <noreply@anthropic.com>
```

---

## 11. 인수인계 → 운영자

CP3 출하 직후 운영자가 시각 검수:
1. 비아키타입 분야 고민으로 새 세션 → picking 화면에 archetype/generated 통합 표시
2. "직접 만들기" 폼으로 1명 추가 → "내가 추가" 라벨
3. archetype 카드의 ⋯ → 다른 archetype 으로 swap → 색·이름 즉시 변경
4. 회의 시작은 누르지 말 것 (§5.7 까지는 깨짐 정상)

이상이면 CP4 진입. 이상 없으면 Sonnet 에게 CP4 워크오더 부록 발행 요청.
