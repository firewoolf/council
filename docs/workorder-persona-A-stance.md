# 작업 의뢰서 — 트랙 ① Phase A: 입장(stance) 도입

> 담당: Claude Code (Sonnet)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `spec-persona-redesign.md` (전체 설계), `../CLAUDE.md`

---

## 0. 한 줄 목표

추천기가 페르소나 3명에게 *이 고민에 대한 입장(stance)*을 배정하고, 그 입장이 토론 시스템 프롬프트에 주입되게 한다. 고정 10명·기존 UI는 그대로 둔다.

---

## 1. 배경 — 왜 이게 가장 큰 레버인가

인사이트는 "똑똑한 사람들이 말해서"가 아니라 **설계된 의견 충돌**에서 나온다. 지금 추천기는 페르소나만 고르고 입장을 주지 않아서, 추천된 3명이 우연히 같은 방향으로 기울면 에코챔버가 된다.

Phase A는 추천기에게 "추진 1 / 반대 1 / 제3의 각도 1"로 **입장을 흩뜨리도록** 강제하고, 각 페르소나가 그 입장을 토론 내내 견지하게 한다. 스토리지 대공사 없이 핵심 가치를 즉시 전달하는 단계.

---

## 2. 절대 원칙

1. CLAUDE.md ⓬ 준수 — `process.env` 직접 접근 금지(`@/env`), 테스트 코드 금지, Tailwind v3.
2. **이건 Phase A다 — 작게 끝낸다.** CastMember 모델·스토리지 마이그레이션·동적 생성·커스텀 폼은 전부 Phase B. 손대지 말 것.
3. **굴복 금지 불변** — stance 블록은 "입장을 견지하라"고만 한다. 사용자에게 굴복하라는 뜻이 아니다 (§5 문구 그대로 사용).
4. `sessionStances`는 **가산적 필드** — 기존 LocalStorage 세션을 깨면 안 된다. 셀렉터는 항상 `?? {}` 가드.

---

## 3. 작업 범위

### 3-1. 추천 스키마에 stance 추가 (`lib/prompts/recommender.ts`)

`recommendationSchema`의 `recommended` 배열 아이템에 `stance` 필드 추가:

```ts
recommended: z.array(z.object({
  personaId: personaIdSchema,              // 기존 enum 유지 (Phase A는 고정 10명)
  stance: z.string()
    .describe('이 페르소나가 이 고민에 대해 취하는 입장 — 한 줄, 분명하게. '
            + '"비판적이다" 같은 성향 말고 "X를 하지 말라고 주장한다" 식 구체적 입장.'),
  reason: z.string().describe('왜 이 페르소나가 지금 필요한지 한 줄 (50자 이내)'),
})).length(3)
```

`buildRecommenderPrompt`에 지시 추가:
- 각 추천 페르소나에 **이 고민에 대한 구체적 입장**을 배정하라.
- **3명의 입장은 반드시 갈려야 한다**: 최소 하나는 추진/찬성, 하나는 반대/제동, 하나는 전제를 의심하는 제3의 각도.
- 입장은 "성향"이 아니라 "이 고민에서의 주장"이다.

### 3-2. `recommendPersonas` 반환 타입 (`lib/ai/client.ts`)

`Recommendation` 타입은 `z.infer<typeof recommendationSchema>`라 스키마만 바꾸면 자동 전파. 함수 시그니처 변경 불필요 — 확인만.

### 3-3. 세션에 stance 저장 (`store/sessions.ts`)

- 새 필드: `sessionStances: Record<string, Record<string, string>>` — `sessionId → (personaId → stance)`.
- `createSession` 인자에 `stances?: Record<string, string>` 추가, 없으면 `{}`.
- 셀렉터/게터 `getStances(id)` 추가 — 항상 `?? {}` 폴백.
- `deleteSession`에서 `sessionStances[id]`도 정리.
- **마이그레이션 불필요** — 기존 세션은 `sessionStances`가 undefined → 셀렉터 `?? {}`로 처리. zustand persist version 올리지 말 것.

### 3-4. stance를 시스템 프롬프트에 주입 (`lib/prompts/personas/index.ts`)

`composePersonaPrompt`의 context 인자에 `stance?: string` 추가. 합성 시 `concernBlock` 앞(또는 캐릭터 프롬프트 뒤)에 stance 블록 삽입 — stance가 비어있으면 생략:

```
[이 회의에서 당신의 입장]
{stance}
이 입장을 토론 내내 일관되게 견지하십시오. 다른 페르소나의 반박에 논리적으로
밀리면 부분 인정은 가능하나, 핵심 입장은 끝까지 지킵니다.
```

### 3-5. useDebate가 stance를 넘기게 (`hooks/useDebate.ts`)

- store에서 `sessionStances[sessionId]` 구독.
- `composePersonaPrompt(speaker, { domain, concern })` 호출에 `stance: stances[speaker.id] ?? ''` 추가.

### 3-6. picking 화면에 stance 표시

- `app/(main)/session/new/page.tsx`: `handleAnalyze`에서 `result.recommended`로부터 `stanceMap`(personaId→stance) 구성, state로 보관. `handleStart`에서 `createSession`에 `stances: stanceMap` 전달.
- `components/session/PersonaPicker.tsx`: `stances: Record<string,string>` prop 추가, 추천 카드에 전달.
- `components/session/PersonaCard.tsx`: `stance?: string` prop 추가. 추천 사유 칩 근처에 입장을 한 줄로 표시 (사유와 구분되게 — 예: "입장:" 라벨 + accent 색).

stance는 추천된 3명에게만 있다. 풀에서 수동 추가한 페르소나는 stance 없음(중립) — 정상.

---

## 4. 손대지 말 것

- `types/persona.ts`의 `Persona`/`Archetype` 개명, `CastMember` 도입 — **Phase B**.
- `store/sessions.ts`의 `sessionPersonas` → `sessionCast` 전환 — **Phase B**.
- `conclusionSchema`의 personaId enum — Phase A는 고정 10명이라 그대로 OK. 건드리지 말 것.
- `data/personas.json` — temperament 필드 추가는 Phase B. 손대지 말 것.
- 동적 생성·커스텀 폼·temperament — 전부 Phase B 이후.

---

## 5. 검증 기준

- [ ] `pnpm typecheck` / `pnpm build` 통과.
- [ ] 새 회의 → 추천 결과 3명 카드에 "입장"이 서로 다르게 (추진/반대/제3) 표시되는지.
- [ ] 토론을 돌렸을 때 페르소나가 배정된 입장을 실제로 견지하는지 (예: "반대" 입장 페르소나가 추진론을 펴면 실패).
- [ ] 기존 LocalStorage에 저장돼 있던 *Phase A 이전* 세션을 열어도 깨지지 않는지 (`sessionStances` undefined 케이스).
- [ ] 풀에서 수동 추가한 페르소나(stance 없음)도 정상 동작하는지.

---

## 6. 참고 — 현재 관련 파일

```
lib/prompts/recommender.ts        # recommendationSchema, buildRecommenderPrompt, personaIdSchema
lib/ai/client.ts                  # recommendPersonas
store/sessions.ts                 # createSession, sessionPersonas, deleteSession
lib/prompts/personas/index.ts     # composePersonaPrompt
hooks/useDebate.ts                # composePersonaPrompt 호출부
app/(main)/session/new/page.tsx   # handleAnalyze, handleStart
components/session/PersonaPicker.tsx
components/session/PersonaCard.tsx
```

---

## 7. 완료 후

Phase A 출하·검증이 끝나면 `backlog.md`에 기록하고, Phase B 워크오더를 Opus가 별도 작성한다.
**Phase B는 마이그레이션을 포함하므로 A와 절대 묶지 말 것.**
