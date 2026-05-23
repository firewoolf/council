# 스펙 — 트랙 ① 페르소나 설계 재구성

> 작성: Opus (설계)
> 상태: 설계 확정. 페이즈별로 `workorder-*.md` 로 분해해 Claude Code가 구현.
> 선행: `roadmap.md` 트랙 ①, `../CLAUDE.md`
> 최종 갱신: 2026-05-23

---

## 1. 목표와 핵심 전환

**한 줄**: "선반에서 3명 고르기"를 "이 고민을 위한 패널을 설계하기"로 바꾼다.

세 가지 전환:

1. **고정 10명 → 아키타입.** 10명은 "전체 우주"가 아니라 출발용 템플릿. 고민의 도메인이 안 맞으면 페르소나를 *즉석 생성*한다.
2. **성격만 → 성격 + 입장(stance).** 인사이트는 "똑똑한 사람들"이 아니라 *설계된 의견 충돌*에서 나온다. 추천기의 임무는 패널이 **반드시 대립하도록** 입장을 배정하는 것.
3. **고정 캐스팅 → 사용자가 자유롭게 구성.** 커스텀 페르소나를 만들고, 저장하고, 재사용한다.

---

## 2. 개념 모델

### 2.1 Archetype vs CastMember — 분리

지금은 "페르소나"가 하나의 개념(고정 레코드)이다. 이걸 둘로 가른다:

- **Archetype** — 재사용 가능한 템플릿. `data/personas.json` 의 10명. 안정적 `id`. 손으로 쓴 캐릭터 프롬프트 보유.
- **CastMember** — 한 *세션 안에* 출연하는 페르소나 인스턴스. 세션 범위 `id`. 아키타입에서 복제됐을 수도, 생성/커스텀됐을 수도. **이 고민에서의 입장(stance)을 가진다.**

세션은 이제 `string[]`(아키타입 id 목록)이 아니라 `CastMember[]`(캐스트)를 저장한다.

### 2.2 페르소나의 3축

```
CastMember = 역할/도메인  ×  성향(temperament)  ×  입장(stance)
             "20년차 교사"   비판/팩트/독설…       이 고민에서 추진/반대/회의
```

- **역할/도메인** — 누구인가. 아키타입이 주거나, 생성/커스텀으로 한 줄 정의.
- **성향(temperament)** — 어떤 태도로 말하는가. 고정 enum (§2.3).
- **입장(stance)** — *이 고민에 대해* 어느 편에 서는가. 자유 텍스트 directive. 추천기가 배정. **이게 이번 트랙의 핵심 신규 요소.**

### 2.3 temperament — 5종 고정 enum

| id | 이름 | 프롬프트 조각 (요지) |
|----|------|------|
| `advocate` | 옹호가 | 기회·실행 가능성·추진력에 주목. 가능한 길을 먼저 본다. |
| `critic` | 비판가 | 허점·리스크·반례에 집중. 깨질 지점을 먼저 본다. |
| `analyst` | 분석가 | 감정 배제. 숫자·근거·구조로만 말한다. |
| `provocateur` | 독설가 | 직설·도발. 불편한 직언을 에두르지 않는다. |
| `empath` | 공감가 | 사람·감정·심리·지속가능성을 중심에 둔다. |

`debateStyle`(기존, 10종)은 아키타입 내부 표현으로 잔존하되, **사용자 노출 분류는 temperament 5종으로 단일화**한다. 커스텀 페르소나 생성·필터는 temperament만 쓴다.

### 2.4 stance — 입장

자유 텍스트 한 줄. 추천기가 각 캐스트에게 배정. 예:

> 고민이 "지금 BYOK로 갈지, 결제를 붙일지":
> - 냉정한 투자자 → stance: "결제를 당장 붙여야 한다 — 매출 없는 검증은 자기위안"
> - 현실주의자 → stance: "BYOK로 더 버텨라 — 결제는 PMF 후"
> - 심리상담가 → stance: "왜 이 결정을 미루는지부터 봐야 한다"

추천기는 입장을 *흩뜨려야* 한다 — 최소 추진 1 / 반대 1 / 제3의 각도 1.

---

## 3. 데이터 모델 (types)

```ts
// types/persona.ts

export type Temperament =
  | 'advocate' | 'critic' | 'analyst' | 'provocateur' | 'empath';

/** 재사용 템플릿 — data/personas.json */
export interface Archetype {
  id: string;
  name: string;
  role: string;
  temperament: Temperament;
  coreValue: string;
  nonNegotiable: string;
  weakness: string;
  colorFrom: string;
  colorTo: string;
  userQuestions: string[];
  /** 손으로 쓴 캐릭터 프롬프트 */
  systemPrompt: string;
}

/** 한 세션에 출연하는 페르소나 인스턴스 */
export interface CastMember {
  /** 세션 범위 고유 id */
  id: string;
  source: 'archetype' | 'generated' | 'custom';
  /** source==='archetype' 일 때만 — 원본 아키타입 id */
  archetypeId?: string;
  name: string;
  role: string;
  temperament: Temperament;
  /** 이 고민에서의 입장. 빈 문자열 허용(중립). */
  stance: string;
  colorFrom: string;
  colorTo: string;
  /**
   * 캐릭터 프롬프트 스냅샷.
   * - generated/custom: 생성 시 합성해 여기 저장 (아키타입이 없으므로).
   * - archetype: 비움 — composePersonaPrompt 가 archetypeId 로 라이브 조회.
   */
  characterPrompt?: string;
  isFacilitator?: boolean;
}
```

`Persona`(기존)는 `Archetype`로 개명. `dynamic` 플래그 제거(생성이 별도 경로). `domain-expert` 아키타입은 잔존하되, 추천기는 도메인 커버가 필요하면 `domain-expert`보다 `generated`를 선호한다.

---

## 4. 추천기 재설계

### 4.1 새 스키마 — `panelDesignSchema`

```ts
const panelMemberSchema = z.object({
  source: z.enum(['archetype', 'generated']),
  archetypeId: z.string().nullable()
    .describe('source=archetype 이면 PERSONAS의 id, 아니면 null'),
  name: z.string(),
  role: z.string().describe('한 줄 역할/도메인'),
  temperament: z.enum(['advocate','critic','analyst','provocateur','empath']),
  stance: z.string().describe('이 고민에 대한 입장 — 한 줄, 분명하게'),
  reason: z.string().describe('왜 이 사람이 이 패널에 필요한가 (50자 이내)'),
});

export const panelDesignSchema = z.object({
  detectedDomain: z.string().nullable(),
  panel: z.array(panelMemberSchema).min(3).max(4),
});
```

기존 `recommendationSchema`(personaId enum 강제)는 폐기. enum 강제가 불가능해진 이유 = 생성 페르소나는 사전 정의된 id가 없음. 대신 §6 안전망으로 검증.

### 4.2 프롬프트 방향 — `buildPanelDesignPrompt`

핵심 지시:
- 사용 가능한 아키타입 목록을 카탈로그로 제공(기존 `PERSONA_CATALOG` 재사용).
- **임무: 이 고민을 위한 3~4인 패널을 설계하라. 패널은 반드시 의견이 갈려야 한다.**
- 입장 분배 강제: 최소 하나는 추진/찬성, 하나는 반대/제동, 하나는 전제를 의심하는 제3의 각도.
- 아키타입이 잘 맞으면 `source: archetype`. 고민의 도메인(교육·군·의료 등)이 아키타입으로 안 잡히면 `source: generated`로 그 분야 전문가를 즉석 설계.
- 각 멤버에 `stance`를 *구체적으로* — "비판적이다" 같은 성향 말고 "이 고민에서 X를 하지 말라고 주장한다".
- 사회자(facilitator)는 자동 추가되므로 패널에서 제외.

### 4.3 client.ts

`recommendPersonas` → `designPanel(args)` 로 개명. 반환 `PanelDesign`. temperature 는 `recommend`(0.45) 유지.

---

## 5. 프롬프트 합성 변경

### 5.1 `composePersonaPrompt(cast: CastMember, ctx)`

입력이 `Archetype`이 아니라 `CastMember`. 합성 순서:

```
BASE_PROMPT
+ [당신의 캐릭터] 이름/역할
+ temperament 지시 조각  (TEMPERAMENT_DIRECTIVE[cast.temperament])
+ 캐릭터 프롬프트         (archetype면 라이브 조회, 아니면 cast.characterPrompt)
+ [이 회의에서 당신의 입장]  ← cast.stance (신규, 비어있으면 생략)
+ [사용자의 고민] concern
+ OUTPUT_HINT
```

`stance` 블록이 신규. 이게 토론에 설계된 대립을 주입하는 지점.

### 5.2 temperament 지시 조각

`data/prompts.json` 에 `temperamentDirectives: Record<Temperament,string>` 추가 — 어드민 편집 가능. §2.3 표의 "프롬프트 조각"을 한 문단씩.

### 5.3 generated/custom 캐릭터 프롬프트 합성

아키타입이 없는 페르소나는 템플릿으로 `characterPrompt` 생성:

```
당신은 "{role}" 입니다.
{temperament 에 따른 기본 태도 — TEMPERAMENT_DIRECTIVE 참조}
당신은 이 분야의 현실·관행·실패 패턴을 압니다.
[절대 양보 안 하는 것] {stance 에서 파생, 또는 일반 원칙}
```

커스텀 추가와 generated가 **같은 합성 함수**를 쓴다 — 일원화.

---

## 6. 안전망 (persona-safety 재작성)

기존 `sanitizeRecommendedIds`/`sanitizeSelectedIds`는 "아키타입 id 환각" 가드였다. 모델이 이제 합법적으로 새 페르소나를 *만들기* 때문에 로직이 바뀐다:

- `source: archetype` 인데 `archetypeId` 가 PERSONAS에 없음 → 그 멤버를 `generated`로 강등(role/temperament/stance는 살림) 또는 드롭.
- `source: generated` → 그대로 수용 (정상 경로).
- 패널 크기 < 3 → 아키타입에서 무작위 보충.
- 입장 분배 검증은 하지 않음(모델 신뢰) — 단 전원이 동일 temperament면 경고 로그.

---

## 7. UI 변경

### 7.1 picking 화면 (`PersonaPicker` 재작성)

기존: 추천 3 + 접힌 풀 7 + 사회자 카드.

신규:
- **설계된 패널** — 각 카드에 이름·역할·temperament 뱃지·**입장(stance)**·추천 사유. 입장이 카드의 주인공.
- 멤버별 액션: 제거 / 교체(아키타입으로 swap, Phase D에서 regenerate).
- **커스텀 추가** 버튼 → 빠른 폼 (이름 + 한 줄 역할 + temperament 칩 선택 + 입장 선택/입력).
- **아키타입 풀** — 접힌 섹션, 기존처럼 토글 추가.
- 사회자 자동 포함 안내 유지.
- 하단 sticky: 캐스트 미리보기 + "회의 시작".

### 7.2 PersonaCard

temperament 뱃지 + stance 한 줄 표시 추가. orb 색은 generated/custom도 가져야 하므로 temperament별 기본 팔레트 정의(`TEMPERAMENT_COLORS`).

### 7.3 회의실·결론 화면

- `MessageCard` 등 PERSONA_MAP 조회 → 세션 캐스트 조회로 변경 (캐스트가 진실 공급원).
- 결론 화면의 페르소나별 입장 표시 — 이제 stance와 함께 보여주면 "처음 입장 → 최종 입장" 대비가 가능 (보너스).

---

## 8. 저장 / 마이그레이션

### 8.1 store/sessions.ts

- `sessionPersonas: Record<sid, string[]>` → `sessionCast: Record<sid, CastMember[]>`.
- zustand `persist` 의 `version` 올리고 `migrate` 작성:
  - 기존 `string[]` → 각 id를 `{source:'archetype', archetypeId:id, stance:'', ...아키타입에서 복사}` CastMember로 변환.
  - 아키타입 조회 실패한 id는 드롭.
- `createSession` 인자: `personaIds: string[]` → `cast: CastMember[]`.
- `addPersona` (useDebate) → `addCastMember`.

### 8.2 conclusionSchema

`personaPositions[].personaId: z.enum(...)` → `z.string()` (캐스트 멤버 id, enum 강제 불가).

### 8.3 Supabase (미연결 — SQL만 갱신)

- `session_personas` 테이블로는 부족 — 인라인 페르소나 정의가 필요.
- `supabase/migrations/` 에 새 마이그레이션: `session_cast` 테이블 (session_id, cast member 전체 필드 JSONB 또는 컬럼들).
- Supabase 미연결 상태라 **블로킹 아님** — 마이그레이션 파일만 추가, 적용은 STEP 7에서.

---

## 9. 페이즈 분할

각 페이즈는 독립 출하 가능. 위험·가치 순.

### Phase A — 입장(stance) 도입 ★최우선·저위험
고정 10명·shelf UI 유지. 추천기가 3명에 **stance를 배정**하고 추진/반대/제3을 보장. `composePersonaPrompt`가 stance 주입. 세션은 stance만 추가 저장(`sessionStances: Record<sid, Record<personaId,string>>` — 가산적, 마이그레이션 불필요).
→ 스토리지 대공사 없이 **"설계된 대립"이라는 핵심 가치를 즉시** 전달. 가장 큰 품질 레버.

### Phase B — 동적 생성 + 커스텀 ★핵심
CastMember 모델 도입(§3), 스토리지 마이그레이션(§8), 추천기 `panelDesignSchema`(§4), 커스텀 빠른 추가 폼, picking 화면 재작성. 트랙 ①의 본체.

### Phase C — 내 페르소나 서랍
커스텀 페르소나 저장·재사용. 별도 store + 관리 UI.

### Phase D — temperament 필터 / swap·regenerate
아키타입 풀 temperament 필터, 멤버 슬롯 regenerate.

---

## 10. 페이즈별 영향 파일

**Phase A**: `lib/prompts/recommender.ts`(stance 필드 추가), `lib/ai/client.ts`, `lib/prompts/personas/index.ts`(composePersonaPrompt에 stance), `store/sessions.ts`(sessionStances 가산), `components/session/PersonaPicker.tsx`·`PersonaCard.tsx`(stance 표시), `app/(main)/session/new/page.tsx`, `data/prompts.json`(temperament 지시 — A에선 선택).

**Phase B**: `types/persona.ts`(Archetype/CastMember), `data/personas.json`(temperament 필드 추가), `lib/prompts/recommender.ts`(panelDesignSchema), `lib/persona-safety.ts`(재작성), `store/sessions.ts`(sessionCast + migrate), `useDebate.ts`, 회의실/결론/요약 페이지(캐스트 조회), `lib/prompts/orchestrator.ts`(conclusionSchema), `supabase/migrations/`(session_cast).

**Phase C/D**: 신규 store + UI 위주.

---

## 11. 확정된 결정 / 리스크

- **결정**: temperament 5종 고정. 커스텀·필터는 temperament만 사용. `debateStyle`은 아키타입 내부에만 잔존.
- **결정**: 캐릭터 프롬프트 — archetype은 라이브 조회, generated/custom은 스냅샷. 프롬프트 개선이 아키타입엔 전파되고, 생성물은 동결.
- **결정**: 추천기 enum 강제 폐기 → §6 안전망으로 대체.
- **리스크**: 무료 모델이 `panelDesignSchema`(중첩 배열 + 자유 텍스트 stance)를 잘 못 채울 수 있음 → Phase B 착수 시 Groq/Gemini로 구조화 출력 안정성 먼저 검증. 불안정하면 Phase B는 Gemini 고정.
- **리스크**: 스토리지 마이그레이션이 기존 LocalStorage 세션을 깨면 안 됨 → `migrate` 함수에 반드시 기존 string[] 케이스 처리 + 실패 시 드롭(앱은 살아남게).
- **굴복 금지 불변**: 어떤 경로(generated/custom)로 만든 페르소나도 BASE_PROMPT가 prepend되므로 굴복 방지는 자동 유지. 커스텀 폼은 자유 프롬프트 입력을 받지 않는다(템플릿 합성만) — 이게 원칙을 지키는 핵심.

---

## 12. 다음 단계

Phase A부터 `workorder-persona-A-stance.md` 로 분해 → Claude Code 착수.
Phase B는 A 출하·검증 후 별도 워크오더. (B는 크고 마이그레이션을 포함하므로 A와 절대 묶지 말 것.)
