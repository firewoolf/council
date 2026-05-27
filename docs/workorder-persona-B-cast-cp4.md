# 워크오더 부록 — CP4 (§5.7 렌더링 cast 전환 + §5.8 conclusionSchema enum 해제)

> 본 부록은 `workorder-persona-B-cast.md` §5.7~§5.8 을 **Sonnet 이 그대로 실행 가능한 구체 지시**로 풀어쓴 것.
> 진행 가이드(`plan-track1-phase-b-completion.md`)의 CP4 단계와 1:1 매칭.
> 작성: Opus / 2026-05-26 (CP3 부록과 동시 박제)
> **선행 게이트:** CP3 출하 통과(`pnpm build` + 운영자 시각 검수).
> 담당: Claude Code (Sonnet)

---

## 0. 한 줄 목표

generated/custom 멤버가 `PERSONA_MAP` 에 없어 발생하는 렌더링 결손을 제거한다. 7개 파일의 `PERSONA_MAP[speakerId]` / `cast.map(m => m.archetypeId ? PERSONA_MAP[m.archetypeId] : ...)` 패턴을 **cast 직접 조회**로 일괄 전환하고, `conclusionSchema.personaPositions[].personaId` 의 `z.enum` 을 `z.string()` 으로 해제한다.

---

## 1. 절대 원칙

1. **렌더링은 cast 만 본다.** `PERSONA_MAP` 라이브 조회는 *프롬프트 합성*(`composePersonaPrompt`의 archetype 캐릭터 프롬프트)과 *검증 로직*(`sanitizePanel`)에서만 정당. 화면 렌더링에서는 cast 가 단일 진실 공급원.
2. **`PERSONA_MAP` / `PERSONAS` import 자체를 다 지우지는 않는다.** 영향 7개 파일 중 일부는 `PERSONAS.filter(...)` 처럼 *카탈로그* 용도로 정당하게 쓴다(예: `UserInput` 의 페르소나+ 탭). 라인 단위로 판단할 것.
3. **B-2 범위 밖**: 회의 중 커스텀 추가, regenerate, "내 페르소나 서랍". 손대지 않는다.

---

## 2. 영향 파일 7개 — 정확한 변경 라인 (Opus 가 grep 으로 미리 매핑)

각 파일의 *변경 대상 라인*과 *변경 패턴*. Sonnet 은 이 표를 그대로 체크하며 작업한다.

### 2.1 `components/debate/DebateFeed.tsx`

| 라인 | 현재 | 변경 |
|---|---|---|
| 7 | `import { PERSONA_MAP } from '@/lib/prompts/personas';` | 제거 |
| 9 | `import type { Archetype as Persona } from '@/types/persona';` | `import type { CastMember } from '@/types/persona';` |
| 14 | `thinkingPersona: Persona \| null;` | `thinkingMember: CastMember \| null;` |
| 11~17 props | (props 인터페이스 전체) | **`cast: readonly CastMember[]`** prop 신규 추가. `thinkingPersona` → `thinkingMember` 개명. |
| 30 | `thinkingPersona?.id` | `thinkingMember?.id` |
| 51 | `m.speakerId !== null ? (PERSONA_MAP[m.speakerId] ?? null) : null` | `m.speakerId !== null ? (castMap.get(m.speakerId) ?? null) : null` |
| 57 | `const tp = PERSONA_MAP[target.speakerId];` | `const tp = castMap.get(target.speakerId);` |
| 본문 | (none) | `const castMap = useMemo(() => new Map(cast.map(c => [c.id, c])), [cast]);` 를 `messageById` 옆에 추가 |
| 80 | `{thinkingPersona && <TypingIndicator persona={thinkingPersona} />}` | `{thinkingMember && <TypingIndicator persona={thinkingMember} />}` (TypingIndicator props 도 같이 점검 — 2.8 참조) |

### 2.2 `components/debate/MessageCard.tsx`

| 라인 | 현재 | 변경 |
|---|---|---|
| 6 | `import type { Archetype as Persona } from '@/types/persona';` | `import type { CastMember } from '@/types/persona';` |
| 11 | `speaker: Persona \| null;` | `speaker: CastMember \| null;` |

본문(line 72 `speaker.colorTo`, line 89 `<PersonaOrb persona={speaker} ...>`, line 90 `speaker.name`)은 **변경 없음** — `CastMember` 가 `colorTo`/`name` 을 모두 갖고 있어 코드 그대로 작동. **단** `PersonaOrb` 가 `Archetype` 타입만 받게 돼있으면 PersonaOrb 의 타입도 `CastMember | Archetype` 으로 확장 필요 (2.8 참조).

### 2.3 `components/debate/UserInput.tsx`

**변경 없음 (또는 거의 없음).**

이 파일은 `PERSONAS.filter(...)` 로 *카탈로그* 를 쓴다 — 풀에서 archetype 만 보여주려는 의도라 정당. 회의 중 커스텀 추가는 B-2 범위 밖이라 그대로 둔다.

확인 포인트:
- 부모(`session/[id]/page.tsx`)가 `activePersonaIds` 를 cast 의 archetype 멤버 id 들로 정확히 계산해 넘기는지만 점검(2.4 참조).
- `onAddPersona(personaId)` 콜백 시그니처는 유지 — 부모가 archetypeId → CastMember 변환을 처리.

### 2.4 `app/(main)/session/[id]/page.tsx`

| 라인 | 현재 | 변경 |
|---|---|---|
| 24 | `import { PERSONA_MAP } from '@/lib/prompts/personas';` | 제거 |
| 49 | 주석 `// B-1 통찰: 모든 cast 멤버가 아키타입 출신이므로 PERSONA_MAP 조회로 렌더링.` | 주석 갱신 — "B-2 §5.7: cast 직접 사용. generated/custom 도 정상 렌더." |
| 54 | `.map((m) => (m.archetypeId ? PERSONA_MAP[m.archetypeId] : undefined))` `.filter(...)` | **cast 를 그대로 사용** — 이 변환 자체를 제거. 호출부가 받는 타입이 `Persona[]` → `CastMember[]` 로 바뀌므로 후속 grep 필요. |
| 197 | 주석 `// 피드 — B-1 통찰: 렌더링은 PERSONA_MAP 조회. CastMember → Archetype 변환.` | 주석 갱신 |
| 202 | `thinkingMember.archetypeId ? PERSONA_MAP[thinkingMember.archetypeId] ?? null : null` | `thinkingMember` 그대로 전달 (DebateFeed 의 `thinkingMember` prop 으로) |
| 223 | `const arch = PERSONA_MAP[archetypeId];` (UserInput 의 `onAddPersona` 핸들러) | archetypeId 로 `PERSONA_MAP[archetypeId]` 조회 — 이건 **archetype → CastMember 변환을 위한 정당한 사용**. 유지하되 변환 결과를 `addCastMember(member)` 호출로. |

**핵심 변경:** 페이지가 들고 있는 `activePersonas: Persona[]` (라인 49~57 추정) 같은 derived state 를 **`activeCast: CastMember[]`** 로 바꾸고, 자식 컴포넌트(DebateFeed, UserInput 등) 에 그대로 전달한다.

검증: DebateFeed 에 `cast` 와 `thinkingMember` 둘 다 정확히 흐르는지 확인.

### 2.5 `app/(main)/session/[id]/summary/page.tsx`

| 라인 | 현재 | 변경 |
|---|---|---|
| 18 | `import { PERSONA_MAP } from '@/lib/prompts/personas';` | 제거 |
| 48 | `const persona = PERSONA_MAP[entry.personaId];` | 세션 cast 에서 조회: `const persona = sessionCast.find(c => c.id === entry.personaId);` (cast 는 페이지 상단에서 `getCast(sessionId)` 로 가져와 둠) |

**핵심:** entry.personaId 가 generated/custom 의 uuid 일 수 있음 — §5.8 enum 해제(아래 §3) 와 짝지어야 동작.

### 2.6 `components/home/RecentSessions.tsx`

| 라인 | 현재 | 변경 |
|---|---|---|
| 7 | `import { PERSONA_MAP } from '@/lib/prompts/personas';` | 제거 |
| 54~57 | `.map((m) => (m.archetypeId ? PERSONA_MAP[m.archetypeId] : undefined))` | cast 를 그대로 사용 (orb 색·이름 표시용). PersonaOrb 가 CastMember 받도록 확장(2.8). |

### 2.7 `app/(main)/history/page.tsx`

| 라인 | 현재 | 변경 |
|---|---|---|
| 8 | `import { PERSONA_MAP } from '@/lib/prompts/personas';` | 제거 |
| 67 | `.map((m) => (m.archetypeId ? PERSONA_MAP[m.archetypeId] : undefined))` | cast 그대로 사용 |

### 2.8 `PersonaOrb` / `TypingIndicator` 타입 점검 (영향 파일 외)

7개 파일 변경의 *부수 효과* — PersonaOrb·TypingIndicator 가 `Archetype` 만 받는다면 cast 전환 시 타입 에러가 난다. 둘 다 *색·이름만 본다면* 다음처럼 처리:

- **권장 경로:** PersonaOrb props 타입을 `persona: Pick<CastMember | Archetype, 'colorFrom' | 'colorTo' | 'name'>` 또는 신규 `OrbSubject` 타입으로 좁힘. CastMember 와 Archetype 둘 다 만족.
- **단순 경로:** PersonaOrb / TypingIndicator props 를 `persona: CastMember` 로 좁히고 호출부가 archetype 일 때는 임시 CastMember-shape 객체로 감싸 전달. **이건 추천 안 함** (불필요한 변환).

Sonnet 은 PersonaOrb / TypingIndicator 의 현재 props 시그니처를 먼저 읽고 **권장 경로** 로 처리. 변경 라인 수가 적으면 컴포넌트 두 개도 cast 호환으로 손본다.

---

## 3. §5.8 conclusionSchema enum 해제

`lib/prompts/orchestrator.ts`:

| 라인 | 현재 | 변경 |
|---|---|---|
| 17 | `import { PERSONAS } from './personas';` | **이 import 가 파일 내 다른 곳에서 안 쓰이면 제거.** 쓰이면 유지. |
| 23 | `const personaIdValues = PERSONAS.map((p) => p.id) as [string, ...string[]];` | **삭제** |
| 35 | `personaId: z.enum(personaIdValues),` | `personaId: z.string().describe('CastMember id — archetype id 또는 generated/custom uuid'),` |

**왜:** `conclusion` 결과의 `personaPositions[].personaId` 가 generated/custom 의 uuid 일 수 있다. enum 강제는 LLM 출력을 깬다. 결론 화면(`summary/page.tsx`)이 이 id 로 cast 를 조회하므로 enum 검증은 불필요·유해.

---

## 4. Sonnet 실행 체크리스트

코드 변경 순서 (각 단계 후 `pnpm typecheck` 확인):

- [ ] **(A) §5.8 enum 해제 — 1파일, 2~3줄.** 가장 가벼움. 먼저 끝낸다.
  - `lib/prompts/orchestrator.ts` line 17/23/35
  - `pnpm typecheck`
- [ ] **(B) PersonaOrb / TypingIndicator props 호환 확장.** 권장 경로(§2.8) 적용.
  - 두 컴포넌트 grep → props 타입 확인 → 좁힘 타입으로 변경
  - `pnpm typecheck`
- [ ] **(C) 렌더링 7파일 cast 전환.** §2.1~§2.7 표 그대로.
  - DebateFeed → MessageCard (자식) → session/[id]/page → summary → RecentSessions → history → UserInput 순
  - 각 파일 변경 후 `pnpm typecheck` (점진적 확인)
- [ ] **(D) 최종 검증:**
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`
  - dev 띄워서 운영자 인계 직전 시각 확인

### 4.1 Sonnet 의 보고 형식 (PR 설명에 박제)

```
■ §5.8 enum 해제
  - orchestrator.ts line 17/23/35 변경
  - PERSONAS import 제거 여부:  (제거/유지 + 사유)

■ PersonaOrb / TypingIndicator
  - 변경 라인: file:line
  - 타입 좁힘 방식:

■ §5.7 7파일 grep 결과
  components/debate/DebateFeed.tsx     ✓ (라인 X, Y, Z 변경)
  components/debate/MessageCard.tsx    ✓
  components/debate/UserInput.tsx      변경 없음 (PERSONAS 카탈로그 정당 사용)
  app/(main)/session/[id]/page.tsx     ✓
  app/(main)/session/[id]/summary/page.tsx  ✓
  components/home/RecentSessions.tsx   ✓
  app/(main)/history/page.tsx          ✓

■ 부수 효과로 변경한 파일 (있으면)
  - 예: PersonaOrb 타입 확장

■ pnpm typecheck/lint/build: PASS
```

Opus 가 이 보고를 받으면 §2.1~§2.7 표와 1:1 대조해 누락 검증.

---

## 5. 손대지 말 것

- `lib/prompts/personas/index.ts` — `PERSONA_MAP` 정의 자체. 그대로 둔다 (프롬프트 합성에서 사용).
- `lib/persona-safety.ts` — `sanitizePanel` 안의 `PERSONA_MAP[archetypeId]` 조회는 *검증* 용도라 정당.
- `lib/prompts/orchestrator.ts` 의 line 153, 203 `personaMap = Object.fromEntries(cast.map(...))` — 이미 cast 기반 로컬 맵. 변수명만 헷갈리지 동작 정당. **수정 금지.**
- `store/sessions.ts` migrate 안의 `PERSONA_MAP[aid]` — 마이그레이션 검증. 절대 손대지 말 것 (데이터 무결성).
- `app/admin/personas/[id]/page.tsx`, `.../edit/page.tsx` — admin 페이지는 archetype 자체 편집이라 PERSONA_MAP 정당.
- `app/(main)/session/new/page.tsx` 의 `PERSONA_MAP[FACILITATOR_ID]` — CP3 부록의 `ensureFacilitator` 헬퍼 추출 후 위치 이동.
- `components/session/PersonaPicker.tsx` — CP3 에서 이미 처리.
- `BASE_PROMPT`, `OUTPUT_HINT`, `temperamentDirectives` — 절대 금지.

---

## 6. 출하 기준

```
✓ pnpm typecheck / lint / build 모두 통과
✓ 운영자 end-to-end 검증:
  - 비아키타입 분야 고민으로 새 회의 → picking → 회의 시작
  - generated 멤버가 회의실에서 정상 이름·색으로 발언
  - 커스텀 멤버 1명 추가 후 회의 → 동일하게 정상 렌더
  - 결론 화면에 generated 멤버의 입장 표시 (enum 해제 확인)
  - history / RecentSessions 에서 cast 가 올바른 색으로 표시
✓ 회귀 검증 (B-1 시점 이전의 옛 세션):
  - history 에서 정상 표시
  - 옛 세션 회의실 열어서 발언자 이름·색 정상
```

---

## 7. 커밋 메시지

```
feat(persona): B-2 §5.7~§5.8 — 렌더링 cast 전환 + conclusionSchema enum 해제

- §5.7 7파일 PERSONA_MAP 조회 → cast 직접 조회로 전환
  · DebateFeed: castMap useMemo, thinkingPersona → thinkingMember
  · MessageCard: speaker prop 타입 CastMember
  · session/[id]/page: activePersonas → activeCast, PERSONA_MAP 제거
  · summary/page: entry.personaId → sessionCast.find 조회
  · RecentSessions / history: cast 그대로 사용
  · UserInput: 변경 없음 (PERSONAS 카탈로그 정당)
- §5.8 conclusionSchema.personaPositions[].personaId enum 해제 → z.string()
- PersonaOrb / TypingIndicator props 를 CastMember | Archetype 호환으로 확장
- generated/custom 멤버가 회의실·결론·요약·history 어디서도 깨지지 않음

Co-Authored-By: Claude Opus (설계) <noreply@anthropic.com>
Co-Authored-By: Claude Sonnet (실행) <noreply@anthropic.com>
```

---

## 8. 인수인계 → 운영자 (CP5 직전)

CP4 출하 직후 운영자는 **CP5 §5.9 종합 검증**으로 직진. 본 부록에 적힌 출하 기준(§6) + 워크오더 §5.9 체크리스트로 검증.

회귀 깨짐 발견 시 → Opus 호출. 가장 민감한 곳은:
- migrate 코드 (B-1 시점 이전 세션) — store/sessions.ts
- summary 의 enum 해제 — generated id 가 정확히 cast 로 매핑되는지
