# 작업 의뢰서 — 트랙 ① Phase B: CastMember 모델 · 동적 생성 · 커스텀

> 담당: Claude Code (Sonnet)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `spec-persona-redesign.md` (전체 설계), `workorder-persona-A-stance.md` (Phase A — 출하 완료), `../CLAUDE.md`

---

## 0. 한 줄 목표

"선반에서 아키타입 3명 고르기"를 "이 고민을 위한 캐스트를 설계하기"로 바꾼다. 페르소나를 **세션 범위 인스턴스(CastMember)**로 모델링하고, 추천기가 아키타입에 없는 분야는 **즉석 생성(generated)**하며, 사용자가 **커스텀 페르소나**를 추가할 수 있게 한다.

---

## 1. 배경 — Phase A 다음에 왜 이것인가

Phase A는 추천된 3명에게 *입장(stance)*을 배정해 "설계된 대립"을 주입했다. 하지만 풀은 여전히 고정 10명이다. 고민이 "군 복무 중 창업 준비"나 "병원 EMR 도입"이면 아키타입 10명 중 누구도 그 분야를 모른다 — 추천기가 `domain-expert`를 끼워넣어도 "동적 분야 주입"이라는 자리표시자 한 줄뿐이다.

Phase B는 페르소나를 **재사용 템플릿(Archetype)**과 **세션 출연 인스턴스(CastMember)**로 가른다. CastMember는 아키타입 복제일 수도, 추천기가 즉석 설계한 생성물일 수도, 사용자가 만든 커스텀일 수도 있다. 이게 트랙 ①의 본체다.

스펙 `spec-persona-redesign.md` §1~12 가 전체 설계다. 이 워크오더는 그걸 **실행 가능한 순서**로 분해한다.

---

## 2. 절대 원칙

1. CLAUDE.md ⓬ 준수 — `process.env` 직접 접근 금지(`@/env`), 테스트 코드 금지, Tailwind v3, MSA/Redis 금지.
2. **마이그레이션이 기존 LocalStorage 세션을 깨면 절대 안 된다.** zustand `persist` 의 `migrate` 는 옛 `string[]` 케이스와 *Phase A 이전*(`sessionStances` 없음) 케이스를 모두 처리하고, 변환 실패한 세션은 **드롭하되 앱은 살아남게** 한다 (스펙 §11).
3. **굴복 금지 불변** — generated/custom 페르소나도 `BASE_PROMPT` 가 prepend 되므로 굴복 방지는 자동 유지. **커스텀 폼은 자유 프롬프트 입력을 받지 않는다** — 이름 + 한 줄 역할 + temperament 선택 + 입장만 받아 템플릿으로 합성한다 (스펙 §11). 이게 원칙을 지키는 핵심.
4. **B-1 과 B-2 는 별도로 출하·검증한다.** §3 의 순서를 지킬 것. B-1(마이그레이션)을 먼저 끝내고 "앱이 이전과 동일하게 동작하는지" 검증한 뒤에 B-2(신규 능력)에 착수한다. 한 커밋에 묶지 말 것.
5. **단순함 우선** (CLAUDE.md ❷). Supabase 는 미연결 — §6 의 Supabase 작업은 *블로킹 아님*, 맨 마지막 선택 단계다.

---

## 3. 실행 순서 — 두 묶음으로 나눠 출하

Phase B 는 크다. 한 번에 하면 마이그레이션 버그와 신규 기능 버그가 섞여 디버깅이 지옥이 된다. **두 묶음으로 쪼개 각각 출하·검증한다.**

```
┌─ B-1  데이터 모델 마이그레이션 (§4)  ──────────────────────┐
│  Archetype/CastMember 타입, personas.json temperament,     │
│  스토리지 sessionCast + migrate, composePersonaPrompt(cast),│
│  TEMPERAMENT 지시 조각, useDebate/orchestrator 배선.        │
│  ▸ 출하 후 검증: "앱이 Phase A 와 똑같이 동작하는가?"        │
│    추천기·풀·UI 는 아직 아키타입만 다룬다 — 보이는 변화 0.   │
└────────────────────────────────────────────────────────────┘
                          ↓  (B-1 검증 통과 후에만)
┌─ B-2  동적 생성 + 커스텀 + picker 재작성 (§5)  ────────────┐
│  recommender panelDesignSchema, generated/custom 합성,      │
│  persona-safety 재작성, 커스텀 추가 폼, PersonaPicker 재작성,│
│  렌더링 조회 cast 전환, conclusionSchema enum 해제.          │
│  ▸ 출하 후 검증: §5.9                                       │
└────────────────────────────────────────────────────────────┘
                          ↓  (선택 — 여유 있을 때)
┌─ B-3  Supabase 마이그레이션 파일 (§6)  ── 블로킹 아님 ──────┐
└────────────────────────────────────────────────────────────┘
```

**핵심 통찰**: B-1 이 끝나면 *모든 CastMember 가 아키타입 출신*이다. 그래서 `messages.speakerId` 가 여전히 아키타입 id 와 일치하고(§4.3 의 id 규칙), `PERSONA_MAP` 조회도 그대로 작동한다 → 렌더링 코드를 안 건드려도 된다. 렌더링 조회의 cast 전환은 generated/custom(= PERSONA_MAP 에 없는 id)이 등장하는 **B-2 에서만** 필요하다. 이 덕분에 B-1 은 순수 데이터 배관 작업으로 축소된다.

---

## 4. B-1 — 데이터 모델 마이그레이션

### 4.1 타입 (`types/persona.ts`)

스펙 §3 을 따른다. 단 아래 두 가지는 이 워크오더가 확정한다 (스펙 §2.3 ↔ §3 의 모호함 해소):

- **`debateStyle` 는 `Archetype` 에 잔존시킨다.** 현재 각 페르소나 `systemPrompt` 본문이 "[반박 스타일 — 데이터형]" 식으로 이 값을 텍스트로 품고 있어 제거하면 불필요한 churn 이 크다. 스펙 §2.3 도 "아키타입 내부에 잔존"이라 명시. `CastMember` 에는 넣지 않는다.
- **`dynamic` 플래그는 제거한다** (스펙 §3). domain-expert 의 동적 분야 주입은 generated 경로로 대체된다 — §4.5 참조.

```ts
// types/persona.ts

export type DebateStyle = /* 기존 10종 그대로 유지 */;

export type Temperament =
  | 'advocate' | 'critic' | 'analyst' | 'provocateur' | 'empath';

/** 재사용 템플릿 — data/personas.json 의 10명. */
export interface Archetype {
  id: string;                 // kebab-case slug, 안정적 PK
  name: string;
  role: string;
  coreValue: string;
  debateStyle: DebateStyle;   // 아키타입 내부 표현으로 잔존
  temperament: Temperament;   // 신규 — 사용자 노출 분류 단일화
  nonNegotiable: string;
  weakness: string;
  systemPrompt: string;       // 손으로 쓴 캐릭터 프롬프트 (BASE 미포함)
  colorFrom: string;
  colorTo: string;
  userQuestions: string[];
}

/** 한 세션에 출연하는 페르소나 인스턴스. */
export interface CastMember {
  id: string;                            // §4.3 의 id 규칙 참조
  source: 'archetype' | 'generated' | 'custom';
  archetypeId?: string;                  // source==='archetype' 일 때만
  name: string;
  role: string;
  temperament: Temperament;
  stance: string;                        // 이 고민에서의 입장. 빈 문자열 = 중립.
  colorFrom: string;
  colorTo: string;
  /**
   * 캐릭터 프롬프트 스냅샷.
   * - generated/custom: 생성 시 합성해 저장 (아키타입이 없으므로).
   * - archetype: undefined — composePersonaPrompt 가 archetypeId 로 라이브 조회.
   */
  characterPrompt?: string;
  isFacilitator?: boolean;
}
```

`Persona` 라는 이름은 전부 `Archetype` 으로 개명한다. import 깨지는 곳을 grep 으로 전수 추적해 고칠 것 (`type { Persona }` → `type { Archetype }`). 변수명 `persona` 는 의미가 맞는 곳이면 굳이 다 바꿀 필요 없다 — 타입명만 정확히.

### 4.2 personas.json + 어드민 (`data/personas.json`, `lib/admin/schemas.ts`, `components/admin/PersonaForm.tsx`)

10개 아키타입 각각에 `temperament` 필드를 추가한다. 아래 매핑을 적용 (운영자가 추후 어드민에서 조정 가능 — 완벽할 필요 없음):

| 아키타입 id | 이름 | debateStyle | → temperament | 근거 |
|---|---|---|---|---|
| `cold-investor` | 냉정한 투자자 | data | `analyst` | 숫자·근거로만 말함 |
| `cynical-dev` | 독설가 개발자 | cynical | `provocateur` | 직설·도발 |
| `jobs-designer` | 잡스형 디자이너 | emotion | `provocateur` | 타협을 도발적으로 거부 |
| `realist` | 현실주의자 | experience | `critic` | 검증 안 된 가정의 허점 |
| `startup-expert` | 스타트업 전문가 | structural | `analyst` | 구조·근거 |
| `branding-strategist` | 브랜딩 전문가 | sensory | `empath` | 감성·일관성 |
| `psychologist` | 심리상담가 | question | `empath` | 사람·감정 중심 |
| `growth-marketer` | 마케터 | data-tactical | `advocate` | 채널·실행·추진 |
| `domain-expert` | 도메인 전문가 | industry | `critic` | 업계 현실의 함정 |
| `facilitator` | 사회자 | facilitator | `analyst` | 중재·구조 정리 |

> 위 10개 `id` 는 `data/personas.json` 실제 값과 대조 확인 완료(2026-05-24).

- `lib/admin/schemas.ts` `personaSchema`: `temperament: z.enum([...5종])` 추가, `dynamic` 필드 제거.
- `components/admin/PersonaForm.tsx`: temperament 선택 `<select>`(또는 칩) 추가. `dynamic` 입력이 있었다면 제거.
- domain-expert 의 `systemPrompt` 본문에서 "(구체적 분야는 회의 시작 시 동적으로 주입됩니다 …)" 자리표시자 문장을 제거하고, 일반적인 "도메인 전문가" 프롬프트로 다듬는다 — `dynamic` 제거에 따른 정리(§4.5).

### 4.3 CastMember id 규칙 — **확정 결정**

> 아키타입 출신 CastMember 의 `id` 는 **그 아키타입 id 를 그대로 쓴다.** generated/custom 은 `crypto.randomUUID()`.

이유: `messages.speakerId` 가 발언자를 id 로 가리킨다. 마이그레이션된 옛 메시지의 `speakerId` 는 아키타입 id 다. 아키타입 CastMember 의 id 를 아키타입 id 로 두면 **옛 메시지가 그대로 해석되고**, B-1 에서 렌더링 조회를 건드릴 필요가 없다(§3 통찰). 트레이드오프 — 한 세션에 같은 아키타입을 두 번 넣을 수 없다. 현재 picker 가 토글(Set) 기반이라 어차피 불가능하므로 **수용 가능**. (Phase C 에서 "내 페르소나 서랍"이 들어오면 그때 재검토.)

### 4.4 스토리지 (`store/sessions.ts`)

스펙 §8.1. `sessionPersonas`(아키타입 id 배열) 와 Phase A 의 `sessionStances` 를 **하나의 `sessionCast` 로 통합**한다 — stance 는 이제 CastMember 의 필드다.

- 상태: `sessionPersonas`, `sessionStances` 제거 → `sessionCast: Record<string, CastMember[]>` 추가.
- `createSession` 인자: `personaIds: string[]` + `stances` → `cast: CastMember[]`.
- 게터: `getPersonaIds` 제거 → `getCast(id): CastMember[]` (폴백 `?? []`), `getCastMember(sessionId, memberId): CastMember | undefined` 추가.
- `updatePersonaIds` → `updateCast(sessionId, cast: CastMember[])`.
- `deleteSession`: `sessionCast[id]` 정리.
- **persist `version` 을 0(기본) → 1 로 올리고 `migrate` 작성**:

```ts
migrate: (persisted, version) => {
  if (version >= 1) return persisted as SessionsState;
  // v0: sessionPersonas(string[]) + (Phase A) sessionStances 를 sessionCast 로 변환
  const old = persisted as {
    sessionPersonas?: Record<string, string[]>;
    sessionStances?: Record<string, Record<string, string>>;
    [k: string]: unknown;
  };
  const sessionCast: Record<string, CastMember[]> = {};
  for (const [sid, ids] of Object.entries(old.sessionPersonas ?? {})) {
    const members: CastMember[] = [];
    for (const aid of ids ?? []) {
      const arch = PERSONA_MAP[aid];
      if (!arch) continue;                 // 알 수 없는 아키타입 → 드롭(앱은 살림)
      members.push({
        id: aid,                            // §4.3 — 아키타입 id 그대로
        source: 'archetype',
        archetypeId: aid,
        name: arch.name,
        role: arch.role,
        temperament: arch.temperament,
        stance: old.sessionStances?.[sid]?.[aid] ?? '',  // Phase A 이전이면 ''
        colorFrom: arch.colorFrom,
        colorTo: arch.colorTo,
        isFacilitator: aid === 'facilitator',
      });
    }
    sessionCast[sid] = members;
  }
  const { sessionPersonas: _p, sessionStances: _s, ...rest } = old;
  return { ...rest, sessionCast } as SessionsState;
}
```

마이그레이션은 순수 데이터 변환이라 위험이 낮다. 그래도 `?? {}` / `?? []` 가드를 빠짐없이.

### 4.5 프롬프트 합성 (`lib/prompts/personas/index.ts`)

`composePersonaPrompt` 입력을 `Archetype` → `CastMember` 로 바꾼다. 스펙 §5.1 의 합성 순서:

```
BASE_PROMPT
+ [당신의 캐릭터] 이름 / 역할
+ temperament 지시 조각        ← TEMPERAMENT 신규
+ 캐릭터 프롬프트              ← archetype: PERSONA_MAP[archetypeId].systemPrompt 라이브 조회
                                 generated/custom: cast.characterPrompt
+ [이 회의에서 당신의 입장]    ← cast.stance (비어있으면 블록 생략 — Phase A 와 동일)
+ [사용자의 고민] concern
+ OUTPUT_HINT
```

- 시그니처: `composePersonaPrompt(cast: CastMember, context?: { concern?: string })`. **`domain` 인자는 제거** — generated 페르소나는 분야가 role/characterPrompt 에 이미 박혀 있고, archetype 은 동적 주입을 안 한다(`dynamic` 제거).
- stance 블록 문구는 Phase A 와 **동일하게 유지** (`workorder-persona-A-stance.md` §3-4 의 텍스트 그대로).
- archetype 인데 `PERSONA_MAP[archetypeId]` 조회 실패 시(어드민이 삭제) → 캐릭터 프롬프트 없이라도 합성은 진행되게 방어 (BASE + 이름/역할 + stance 만으로도 동작).

### 4.6 temperament 지시 조각 (`data/prompts.json`, `lib/admin/schemas.ts`, prompts 어드민)

스펙 §5.2. `data/prompts.json` 에 `temperamentDirectives: Record<Temperament,string>` 추가. 아래 5개 문구를 그대로 사용한다 (각 문구는 "단, …" 가드를 품어 BASE 의 굴복 금지·벙벙함 금지와 충돌하지 않게 설계됨):

```json
"temperamentDirectives": {
  "advocate": "[성향 — 옹호가] 당신은 기회와 실행 가능성에 먼저 주목합니다. 막을 이유보다 되게 할 길을 먼저 찾습니다. 단, 근거 없는 낙관은 금물 — 가능하다고 말할 땐 그 경로를 구체적으로 제시하십시오.",
  "critic": "[성향 — 비판가] 당신은 허점·리스크·반례에 집중합니다. 어떤 주장이든 '어디서 깨질까'를 가장 먼저 봅니다. 단, 반대를 위한 반대는 금물 — 깨질 지점을 짚으면 그게 왜 치명적인지까지 말하십시오.",
  "analyst": "[성향 — 분석가] 당신은 감정을 배제하고 숫자·근거·구조로만 말합니다. '느낌상'이라는 말을 쓰지 않습니다. 추정치라도 수치로 환산해 제시하고, 주장엔 근거의 출처를 답니다.",
  "provocateur": "[성향 — 독설가] 당신은 직설적이고 도발적입니다. 불편한 직언을 에두르지 않습니다. 단, 인신공격이 아니라 논점을 찌릅니다 — 상대가 외면하던 약점을 정면으로 끄집어내십시오.",
  "empath": "[성향 — 공감가] 당신은 사람·감정·심리·지속가능성을 중심에 둡니다. 결정이 사람에게 미치는 영향과 번아웃·동기 같은 비가시적 비용을 봅니다. 단, 위로로 끝내지 말고 그 관점에서의 구체적 판단을 내리십시오."
}
```

- `lib/prompts/personas/index.ts` 또는 인접 모듈에 `TEMPERAMENT_DIRECTIVE` 로더 추가 — `prompts.json` 에서 읽어 `composePersonaPrompt` 가 `cast.temperament` 로 조회.
- `lib/admin/schemas.ts` `promptsSchema` 에 `temperamentDirectives` 추가: `z.object({ advocate: z.string().min(10), ... })` 5키 전부.
- `app/admin/prompts/edit/PromptsEditForm.tsx`: 5개 지시 조각 textarea 추가.

### 4.7 useDebate · orchestrator 배선 (`hooks/useDebate.ts`, `lib/prompts/orchestrator.ts`)

B-1 의 핵심: 동작은 그대로, 데이터 소스만 cast 로.

- `useDebate`: `sessionPersonas`/`sessionStances` 구독 → `sessionCast` 구독. Phase A 의 `EMPTY_STANCES` 모듈 const 패턴은 `EMPTY_CAST: readonly CastMember[]` 로 바꿔 동일하게 reference 안정성 유지. `activePersonas` → `activeCast: CastMember[]`.
- `composePersonaPrompt` 호출: `composePersonaPrompt(castMember, { concern: session.concern })` — stance 는 cast 안에 있으니 별도 전달 불필요(Phase A 의 `stances[id]` 인자 제거).
- `addPersona(personaId)` → `addCastMember(member: CastMember)`. B-1 단계에선 풀(아키타입)에서만 추가되므로 호출부가 아키타입→CastMember 변환해 넘긴다. (`UserInput` 의 "페르소나 추가" 탭 — §5.7 에서 최종 정리.)
- `orchestrator.ts`:
  - `decideNextSpeaker(activeCast, messages)` — 내부적으로 `.id` 만 쓰므로 인자 타입만 `readonly CastMember[]` 로. 로직 불변.
  - `buildDebateContext` / `buildConclusionPrompt`: 인자 `personaMap: Record<string, Persona>` → `cast: readonly CastMember[]` 로 바꾸고 함수 안에서 id→이름 맵을 만든다.
  - `conclusionSchema.personaPositions[].personaId` 의 `z.enum(...)` 은 **B-1 에선 건드리지 않는다** — B-1 은 아키타입만 다뤄 enum 이 여전히 유효. enum 해제는 B-2(§5.8).

### 4.8 new-session 페이지 — cast 빌드 (`app/(main)/session/new/page.tsx`)

B-1 에선 추천기(`recommender.ts`)·`persona-safety.ts`·`PersonaPicker` 의 **로직을 바꾸지 않는다.** 추천기는 Phase A 의 `recommendationSchema`(personaId + stance + reason) 를 그대로 쓴다. 바뀌는 건 `handleStart` 뿐:

- `sanitizeSelectedIds` 로 정리된 `safe.ids` (아키타입 id 배열) 를 `CastMember[]` 로 변환 후 `createSession({ cast })` 호출.
- 변환: 각 id 마다 `PERSONA_MAP[id]` 에서 name/role/temperament/colors 복사, `source:'archetype'`, `archetypeId:id`, `id:id`(§4.3), `stance: stances[id] ?? ''`, `isFacilitator: id==='facilitator'`.
- `PersonaPicker` 는 B-1 에서 그대로 — 여전히 `recommendedIds`/`stances` props 로 동작. 재작성은 B-2(§5.6).

---

## 5. B-2 — 동적 생성 + 커스텀 + picker 재작성

> **B-1 출하·검증(§4 끝)이 통과한 뒤에만 착수.**

### 5.1 착수 전 리스크 검증 — 먼저 할 것

스펙 §11 리스크: 무료 모델(Gemini Flash / Groq)이 `panelDesignSchema`(중첩 배열 + 자유 텍스트 stance + nullable)를 안정적으로 못 채울 수 있다. **B-2 의 첫 작업은 이 스키마로 Gemini·Groq 에 실제 `generateObject` 를 한 번 돌려 구조화 출력이 깨지지 않는지 확인하는 것.** 불안정하면 picker 등 나머지 작업 전에 보고하라 — 스키마를 평탄화하거나 Gemini 고정으로 정책을 바꾼다.

### 5.2 추천기 재설계 (`lib/prompts/recommender.ts`, `lib/ai/client.ts`)

스펙 §4. `recommendationSchema` 폐기 → `panelDesignSchema`:

```ts
const panelMemberSchema = z.object({
  source: z.enum(['archetype', 'generated']),
  archetypeId: z.string().nullable()
    .describe('source=archetype 이면 PERSONAS 의 id, 아니면 null'),
  name: z.string(),
  role: z.string().describe('한 줄 역할/도메인'),
  temperament: z.enum(['advocate','critic','analyst','provocateur','empath']),
  stance: z.string().min(5)
    .describe('이 고민에 대한 입장 — 한 줄, 분명하게. "비판적이다" 같은 성향 말고 '
            + '"X를 하지 말라고 주장한다" 식 구체적 주장.'),
  reason: z.string().describe('왜 이 사람이 이 패널에 필요한가 (50자 이내)'),
});

export const panelDesignSchema = z.object({
  detectedDomain: z.string().nullable(),
  panel: z.array(panelMemberSchema).min(3).max(4),
});
export type PanelDesign = z.infer<typeof panelDesignSchema>;
```

`buildRecommenderPrompt` → `buildPanelDesignPrompt`. 지시(스펙 §4.2): 아키타입 카탈로그 제공 / 임무는 "3~4인 패널 설계, 반드시 의견이 갈리게" / 입장 분배 강제(추진 1·반대 1·제3 각도 1 — Phase A 프롬프트의 분배 문구 재사용) / 아키타입이 잘 맞으면 `source:archetype`, 고민의 분야(교육·군·의료 등)가 아키타입으로 안 잡히면 `source:generated` 로 그 분야 전문가를 즉석 설계 / 사회자는 자동 추가되므로 패널에서 제외.

`lib/ai/client.ts`: `recommendPersonas` → `designPanel(args)`, 반환 `PanelDesign`, schema 만 교체. `TEMPERATURE.recommend`(0.45) 유지.

### 5.3 generated/custom 캐릭터 프롬프트 합성 (신규 모듈 — 예: `lib/prompts/synthesize.ts`)

아키타입이 없는 페르소나의 `characterPrompt` 를 템플릿으로 합성한다. **custom 추가와 generated 가 같은 함수를 쓴다** (스펙 §5.3 — 일원화):

```ts
function synthesizeCharacterPrompt(input: {
  role: string; temperament: Temperament; stance: string;
}): string
```

스펙 §5.3 의 템플릿: `당신은 "{role}" 입니다.` + temperament 기본 태도(= `TEMPERAMENT_DIRECTIVE[temperament]`) + `당신은 이 분야의 현실·관행·실패 패턴을 압니다.` + `[절대 양보 안 하는 것]` (stance 에서 파생하거나 일반 원칙). 자유 프롬프트 입력은 받지 않는다(§2 원칙 3).

`designPanel` 응답을 CastMember 로 변환할 때: `source:generated` 멤버는 이 함수로 `characterPrompt` 를 만들어 스냅샷 저장. `source:archetype` 멤버는 `characterPrompt` 를 비워둔다(라이브 조회).

### 5.4 generated/custom orb 색상 (`TEMPERAMENT_COLORS`)

아키타입 출신이 아닌 CastMember 는 colorFrom/colorTo 가 없다. temperament 별 기본 팔레트를 정의 (디자인 시스템 톤에 맞춤):

```ts
export const TEMPERAMENT_COLORS: Record<Temperament, { from: string; to: string }> = {
  advocate:    { from: '#047857', to: '#10B981' }, // emerald — 추진
  critic:      { from: '#9F1239', to: '#F43F5E' }, // rose — 경고
  analyst:     { from: '#1E40AF', to: '#3B82F6' }, // blue — 냉정
  provocateur: { from: '#B45309', to: '#F59E0B' }, // amber — 도발
  empath:      { from: '#6D28D9', to: '#A78BFA' }, // violet — 공감
};
```

### 5.5 안전망 재작성 (`lib/persona-safety.ts`)

스펙 §6. 기존 `sanitizeRecommendedIds`/`sanitizeSelectedIds` 는 "아키타입 id 환각" 가드였다 — 모델이 이제 합법적으로 새 페르소나를 *만들기* 때문에 로직이 바뀐다. 신규 `sanitizePanel(panel: PanelDesign['panel']): { cast: CastMember[]; notes: string[] }`:

- `source:archetype` 인데 `archetypeId` 가 `PERSONA_MAP` 에 없음 → 그 멤버를 `source:generated` 로 강등(role/temperament/stance 는 살림, characterPrompt 합성, 색은 `TEMPERAMENT_COLORS`). `notes` 에 기록.
- `source:generated` → 그대로 수용. characterPrompt 합성, 색 `TEMPERAMENT_COLORS`.
- `source:archetype` 정상 → `PERSONA_MAP` 에서 필드 복사, id=archetypeId(§4.3).
- 패널 크기 < 3 → 미사용 아키타입에서 무작위 보충 (facilitator/domain-expert 제외 — 기존 보충 로직 재사용).
- 입장 분배 검증은 하지 않음(모델 신뢰). 단 전원이 동일 temperament 면 `console.warn`.
- `notes` 비어있지 않으면 호출부가 `toast.info` 로 사용자 안내(기존 패턴).

회의 시작 직전 가드(`sanitizeSelectedIds` 대체): 커스텀/generated 멤버는 검증 대상이 아니고, archetype 멤버만 "그 사이 어드민이 삭제했나" 확인하면 충분. 가벼운 `dropStaleArchetypeMembers(cast): { cast, dropped }` 정도로.

### 5.6 PersonaPicker 재작성 (`components/session/PersonaPicker.tsx`, `PersonaCard.tsx`)

스펙 §7.1, §7.2. props 가 `recommendedIds`/`reasons`/`stances`(아키타입 id 기반) → **`cast: CastMember[]`** 중심으로 바뀐다.

- **설계된 패널** — 각 카드: 이름 · 역할 · temperament 뱃지 · **입장(stance)** · 추천 사유. 입장이 카드의 주인공.
- 멤버별 액션: 제거 / 교체(아키타입으로 swap). regenerate 는 Phase D — 제외.
- **커스텀 추가** 버튼 → 빠른 폼: 이름 + 한 줄 역할 + temperament 칩 선택 + 입장 입력. 제출 시 `synthesizeCharacterPrompt` 로 `source:'custom'` CastMember 생성해 패널에 추가. **자유 프롬프트 입력란 없음**(§2 원칙 3).
- **아키타입 풀** — 접힌 섹션, 토글로 추가(기존 UX 유지). 추가 시 archetype→CastMember 변환.
- 사회자 자동 포함 안내 유지. 하단 sticky 캐스트 미리보기 + "회의 시작" 유지.
- `PersonaCard`: `persona: Persona` → `member: CastMember` 기반. temperament 뱃지 추가, stance 한 줄 표시(Phase A accent 칩 스타일 유지). orb 색은 `member.colorFrom/To` 직접 사용(generated/custom 도 §5.4 로 색이 있음). `persona.dynamic` 분기 제거.
- `app/(main)/session/new/page.tsx`: `designPanel` → `sanitizePanel` → `cast` state. `handleStart` 는 `createSession({ cast })`. 사회자 CastMember 는 picking 진입 시 자동으로 캐스트에 포함.

### 5.7 회의실 · 결론 · 요약 렌더링 → cast 조회

generated/custom 멤버는 `PERSONA_MAP` 에 없으므로 **모든 발언자 조회를 세션 cast 조회로 바꾼다.** grep 으로 전수 추적: `components/debate/DebateFeed.tsx`, `MessageCard.tsx`, `UserInput.tsx`, `app/(main)/session/[id]/page.tsx`, `summary/page.tsx`, `components/home/RecentSessions.tsx`, `app/(main)/history/page.tsx`.

- 조회는 `getCastMember(sessionId, speakerId)`(§4.4) 또는 화면이 이미 가진 `cast` 배열에서. **렌더링은 항상 CastMember 를 읽는다** — 이름·역할·orb 색은 cast 의 스냅샷. `PERSONA_MAP` 라이브 조회는 `composePersonaPrompt` 의 archetype 캐릭터 프롬프트에서만.
- `UserInput` "페르소나 추가" 탭: 아키타입 풀에서 선택 → CastMember 변환 → `addCastMember`. (커스텀 추가를 회의 중에도 열지는 B-2 범위 밖 — 아키타입만.)

### 5.8 conclusionSchema enum 해제 (`lib/prompts/orchestrator.ts`)

스펙 §8.2. `personaPositions[].personaId` 의 `z.enum(personaIdValues)` → `z.string()`. generated/custom 멤버 id(uuid)는 enum 에 없기 때문. 결론 요약 화면이 이 id 로 cast 를 조회(§5.7)하므로 enum 강제는 불필요·유해.

### 5.9 B-2 검증 기준

- [ ] `pnpm typecheck` / `pnpm build` 통과.
- [ ] 아키타입으로 안 잡히는 분야의 고민(예: "공무원 시험 준비하다 창업", "동물병원 SaaS")으로 새 회의 → 패널에 `generated` 멤버가 그 분야 전문가로 등장하는지.
- [ ] 커스텀 페르소나 추가 폼 → 만든 페르소나가 토론에 정상 참여하고 굴복 금지가 유지되는지.
- [ ] generated/custom 멤버의 발언이 회의실·결론·요약·history 에서 이름·색이 깨짐 없이 렌더되는지.
- [ ] 결론 화면에 generated 멤버의 최종 입장이 표시되는지(enum 해제 확인).
- [ ] **B-1 에서 마이그레이션된 기존 세션**이 B-2 배포 후에도 여전히 정상으로 열리는지.

---

## 6. B-3 (선택) — Supabase 마이그레이션 파일

스펙 §8.3. **블로킹 아님** — Supabase 미연결. 여유 있을 때만.

- `council/supabase/migrations/` 디렉터리 신규 생성, `session_cast` 테이블 마이그레이션 추가 — `session_personas` 로는 인라인 페르소나 정의를 못 담는다. CastMember 전체 필드를 컬럼 또는 JSONB 로.
- `lib/supabase/sync.ts`: `pushSession` 의 `personaIds: string[]` 인자와 `pullSessions` 의 `session_personas` 참조가 새 모델과 어긋난다. **먼저 `pushSession` 호출부를 grep** — 현재 어디서도 호출 안 하면(추정) 시그니처만 `cast: CastMember[]` 로 맞춰 빌드만 깨지지 않게 두고 실제 배선은 STEP 7 로 미룬다. `lib/supabase/types.ts` 도 함께 갱신.

---

## 7. 손대지 말 것

- **Phase C** — 커스텀 페르소나 저장·재사용("내 페르소나 서랍"), 별도 store. B-2 의 커스텀 폼은 *그 세션 한정* 으로만 만든다. 저장 안 함.
- **Phase D** — 아키타입 풀 temperament 필터, 멤버 슬롯 regenerate, swap UI 고도화.
- Supabase 실제 연결·Realtime — STEP 7.
- `BASE_PROMPT` / `OUTPUT_HINT` 문구 — 굴복 금지 규칙은 검증된 자산. 건드리지 말 것.
- 무료 LLM 공급사 라우팅·폴백(`runWithFallback`) — 이미 출하됨. 그대로 사용.

---

## 8. 스펙 누락분 — 어드민 영향 (Opus 추가 발견)

스펙 §3~8 은 어드민(`/admin`)을 언급하지 않았으나, `temperament`(personas.json) 와 `temperamentDirectives`(prompts.json) 추가는 어드민 편집 경로에 **필수 영향**을 준다. B-1 범위에 포함했다 — §4.2, §4.6:

- `lib/admin/schemas.ts` `personaSchema`(temperament 추가, dynamic 제거) / `promptsSchema`(temperamentDirectives 추가).
- `components/admin/PersonaForm.tsx`(temperament 셀렉터).
- `app/admin/prompts/edit/PromptsEditForm.tsx`(지시 조각 5개 textarea).
- 어드민 서버 라우트(`app/api/admin/personas/route.ts`, `prompts/route.ts`)가 위 스키마로 재검증하므로 스키마만 맞추면 라우트는 대개 자동 정합. 빌드로 확인.

이걸 빠뜨리면 어드민에서 페르소나 저장 시 새 필드가 검증에 막히거나 유실된다.

---

## 9. 참고 — 영향 파일 맵

```
B-1:
  types/persona.ts                       Persona→Archetype 개명, Temperament/CastMember 신규
  data/personas.json                     temperament 필드 ×10, domain-expert 자리표시자 정리
  data/prompts.json                      temperamentDirectives 추가
  lib/admin/schemas.ts                    personaSchema/promptsSchema 갱신
  components/admin/PersonaForm.tsx        temperament 셀렉터
  app/admin/prompts/edit/PromptsEditForm.tsx  지시 조각 textarea
  store/sessions.ts                       sessionCast + migrate + version:1
  lib/prompts/personas/index.ts           composePersonaPrompt(cast), TEMPERAMENT_DIRECTIVE
  hooks/useDebate.ts                      sessionCast 구독, activeCast, addCastMember
  lib/prompts/orchestrator.ts             decideNextSpeaker/buildDebateContext 인자 타입
  app/(main)/session/new/page.tsx         handleStart 가 cast 빌드

B-2:
  lib/prompts/recommender.ts              panelDesignSchema, buildPanelDesignPrompt
  lib/ai/client.ts                        recommendPersonas→designPanel
  lib/prompts/synthesize.ts (신규)        synthesizeCharacterPrompt
  lib/persona-safety.ts                   sanitizePanel 재작성, TEMPERAMENT_COLORS
  components/session/PersonaPicker.tsx    재작성 — 캐스트·커스텀 폼
  components/persona/PersonaCard.tsx      CastMember 기반, temperament 뱃지
  components/debate/{DebateFeed,MessageCard,UserInput}.tsx   cast 조회
  app/(main)/session/[id]/page.tsx, summary/page.tsx         cast 조회
  components/home/RecentSessions.tsx, app/(main)/history/page.tsx  cast 조회
  lib/prompts/orchestrator.ts             conclusionSchema enum 해제

B-3 (선택):
  council/supabase/migrations/ (신규), lib/supabase/sync.ts, lib/supabase/types.ts
```

---

## 10. 완료 후

B-1 / B-2 각각 출하·검증되면 `backlog.md` Done 에 commit 과 함께 기록한다. B-2 검증(§5.9)까지 끝나면 트랙 ① 의 본체가 완성된다 — Phase C(내 페르소나 서랍) / Phase D(필터·regenerate) 워크오더는 Opus 가 별도 작성한다.
