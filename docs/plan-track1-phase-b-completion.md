# 진행 가이드 — 트랙 ① Phase B 완주

> 워크오더 `workorder-persona-B-cast.md` §5(B-2 본체) + §6(B-3 선택) 완주까지의 *진행 가이드*.
> 워크오더가 "무엇을 짜는가"라면, 이 문서는 "**누가 / 어떤 순서로 / 무엇을 보고 다음으로 넘어가는가**" 다.
> 작성: Opus / 2026-05-26 / `eb35708` 시점부터 적용.

---

## 0. 역할 분담 — 한 줄

- **Opus**: 설계 · 판단 · 워크오더 부록 · 인수인계 검증. 리스크가 높은 결정과 문구는 직접 박제한다.
- **Sonnet (Claude Code CLI)**: 실행. 전수 수정·grep·타입 안전·빌드 통과. 호출 시 반드시 워크오더 §섹션 번호를 명시한다.
- **운영자 (David)**: 라이브 검증 · 결정권 · 커밋 · backlog Done 갱신.

각 체크포인트 끝에 *"다음 담당에게 무엇을 넘기는가"* 한 줄을 의식적으로 박제한다.

---

## 1. 큰 흐름 (체크포인트 5+1)

```
[CP1] §5.1 라이브 검증            ← 출발선
  └─▶ [CP2] §5.5 sanitizePanel / 프롬프트 튜닝 (조건부)
       └─▶ [CP3] §5.6 PersonaPicker 재작성 + 커스텀 폼
            └─▶ [CP4] §5.7~§5.8 렌더링 cast 전환 + enum 해제
                 └─▶ [CP5] §5.9 종합 검증 · 출하 — 트랙 ① 본체 완성
                      └─▶ [CP6] B-3 Supabase 마이그레이션 (선택 · 블로킹 아님)
```

각 체크포인트는 **별개 커밋**. B-1/B-2를 안 묶었던 원칙(워크오더 §2 원칙 4)을 이어간다.

---

## 2. CP1 — §5.1 라이브 검증

**담당:** 운영자
**선행:** 코드 출하 완료(`eb35708`).

### 절차

1. `pnpm dev` → 브라우저 `http://localhost:3000`
2. `/settings` 에서 **Gemini** BYOK 키 1개 등록 · 연결 테스트
3. 비아키타입 분야 고민 1개로 세션 생성. 예시:
   - "동물병원 SaaS 만들지"
   - "군 전역 후 다른 창업"
   - "공무원 시험 준비하다 창업"
4. picking 화면에서 관찰:
   - generated 멤버가 분야 전문가로 등장하는가
   - 각 멤버의 stance 텍스트가 구체적인가 ("X 하지 말라고 주장" vs 뻔한 "비판적이다")
   - 에러가 뜨는가
5. **회의 시작 누르지 말 것** — §5.7 미완으로 회의실에서 "???" 정상
6. `/settings` 키를 **Groq** 로 교체 후 같은 고민으로 한 번 더 (Cerebras 키 있으면 추가로)
7. 결과를 (a)/(b)/(통과) 셋 중 하나로 분류

### 분류 기준 (워크오더 §5.1 그대로)

- **(a) JSON 자체 생성 실패** — `generateObject` 가 throw, 결과 비어있음, picking이 안 뜸 → 스키마 평탄화 필요
- **(b) JSON은 왔는데 부실** — 필드 누락, 이상한 temperament, 짧은 stance, generated가 archetype과 구분 안 됨 → sanitize·프롬프트 튜닝
- **(통과)** — generated 멤버가 분야 전문가로 그럴듯하게 등장, stance가 구체적, 토스트 안내가 적절

### 인수인계 → Opus

운영자가 Opus에게 보고할 내용:
- 공급사별 결과 (Gemini / Groq 각각)
- 분류 (a / b / 통과)
- (a)/(b) 면 콘솔 로그 또는 picking 화면 캡쳐
- 등장한 generated 멤버의 name/role/stance 예시 1~2개

### 예외 경로

- **Gemini=통과 / Groq=(a)만** → 워크오더 §5.1 정책: `recommend` 라우팅을 Gemini 고정으로 좁히고 진행 (`lib/ai/providers.ts` 1줄 변경). Sonnet에게 위임.
- 둘 다 (a) → CP2로.

---

## 3. CP2 — §5.5 sanitizePanel / 프롬프트 튜닝 (조건부)

**언제만:** CP1이 (a) 또는 (b)일 때만. 통과면 **건너뜀**.
**담당:** Opus(판단·문구) → Sonnet(코드 반영) → 운영자(재검증).

| 케이스 | Opus 결정 | Sonnet 실행 |
|---|---|---|
| (a) JSON 미생성 | 어느 필드를 더 풀지·중첩을 펼칠지 — 스키마 평탄화 방향 | `panelDesignSchema` 수정 + `pnpm typecheck`·`pnpm build` |
| (b) 내용 부실 | `buildPanelDesignPrompt` 강화 지점 — 입장 분배 강제 / 분야 구체성 / 예시 주입 | 프롬프트 텍스트 교체 |

- **커밋:** `fix(persona): B-2 §5.1 검증 결과 반영 — <증상 한 줄>`
- **인수인계:** 운영자가 CP1 재검증. 2회까지 시도, 그래도 안 풀리면 Opus가 라우팅 좁히기로 결정.

---

## 4. CP3 — §5.6 PersonaPicker 재작성 + 커스텀 폼

**담당:** Opus(UX 디테일·문구·워크오더 부록) → Sonnet(코드 전체 재작성) → 운영자(시각 검수).
**산출물:** `components/session/PersonaPicker.tsx` 재작성 + `PersonaCard.tsx` CastMember 기반 전환 + 커스텀 추가 폼 신규.

### 4.1 Opus가 박제할 디테일 (Sonnet 워크오더 부록)

1. **카드 정보 우선순위** — 입장(stance)이 주인공 / temperament 뱃지 / 이름 · 역할 · 추천 사유
2. **커스텀 추가 폼 필드** — 이름(text) / 한 줄 역할(text) / temperament(칩 5개 토글) / 입장(textarea). 자유 프롬프트 입력 **없음** (워크오더 §2 원칙 3)
3. **temperament 칩** — `TEMPERAMENT_COLORS`(§5.4) 색 그대로. 한국어 라벨: 옹호가 / 비판가 / 분석가 / 독설가 / 공감가
4. **토스트 문구** — `sanitizePanel` notes 발생 시 `toast.info`, 기존 B-4 패턴 (`persona-safety.ts`) 톤 유지

### 4.2 Sonnet 작업 체크리스트

- [ ] `PersonaPicker` props: `recommendedIds/reasons/stances` → `cast: CastMember[]` 단일 prop
- [ ] 멤버별 액션: 제거 / 아키타입으로 swap. regenerate는 Phase D — 제외
- [ ] 커스텀 추가: `synthesizeCharacterPrompt` 호출 → `source:'custom'` CastMember push
- [ ] 아키타입 풀: 접힌 섹션, 토글 추가, archetype→CastMember 변환
- [ ] 사회자 자동 포함 안내, 하단 sticky 미리보기, "회의 시작" 버튼 유지
- [ ] `PersonaCard`: `member: CastMember` 기반, `persona.dynamic` 분기 제거, orb 색은 `member.colorFrom/To` 직접 사용
- [ ] `session/new/page.tsx`: `designPanel` → `sanitizePanel` → `cast` state → `handleStart` 가 `createSession({ cast })`
- [ ] `pnpm typecheck` 통과

- **커밋:** `feat(persona): B-2 §5.6 — PersonaPicker 재작성 + 커스텀 폼`
- **인수인계 → 운영자:** "picking 화면 변화 시각 검수, 커스텀 1명 추가해서 picking 까지 확인. 회의실은 §5.7 전까지 깨짐 정상."

---

## 5. CP4 — §5.7 렌더링 cast 전환 + §5.8 conclusionSchema enum 해제

**담당:** Sonnet(grep 기반 전수 수정) → Opus(영향 매핑 검증) → 운영자(end-to-end 검증).

### 5.1 Sonnet grep 대상 (워크오더 §5.7 영향 파일)

```
components/debate/DebateFeed.tsx
components/debate/MessageCard.tsx
components/debate/UserInput.tsx
app/(main)/session/[id]/page.tsx
app/(main)/session/[id]/summary/page.tsx
components/home/RecentSessions.tsx
app/(main)/history/page.tsx
```

각 파일에서 `PERSONA_MAP[speakerId]` / `personaMap[id]` 형태 조회를 **모두** `getCastMember(sessionId, speakerId)` 또는 화면 보유 cast 배열 조회로 교체.

### 5.2 체크리스트

- [ ] 위 7개 파일 grep 결과를 PR 설명에 박제 (Opus가 누락 검증)
- [ ] `lib/prompts/orchestrator.ts` — `conclusionSchema.personaPositions[].personaId` 의 `z.enum(...)` → `z.string()` (§5.8)
- [ ] `UserInput` "페르소나 추가" 탭: 아키타입 풀만 (회의 중 커스텀 추가는 B-2 범위 밖)
- [ ] `pnpm typecheck` 통과

### 5.3 Opus 검증 포인트

Sonnet이 보고한 grep 결과를 워크오더 §5.7 영향 파일 목록과 1:1 대조. 빠진 파일 발견 시 추가 지시.

- **커밋:** `feat(persona): B-2 §5.7~§5.8 — 렌더링 cast 전환 + conclusionSchema enum 해제`
- **인수인계 → 운영자:** "CP5 종합 검증 차례."

---

## 6. CP5 — §5.9 종합 검증 + 출하

**담당:** 운영자.

### §5.9 체크리스트

- [ ] `pnpm typecheck` / `pnpm build` 통과
- [ ] 비아키타입 분야 고민으로 새 회의 → generated 멤버가 분야 전문가로 등장, picking → 회의 → 결론 → history 전부 깨짐 없음
- [ ] 커스텀 페르소나 추가 폼으로 1명 만들어 토론 끝까지 → 굴복 금지 유지
- [ ] 결론 화면에 generated 멤버 최종 입장 표시 (enum 해제 확인)
- [ ] **B-1 시점 이전 마이그레이션된 옛 세션** 열어서 정상 표시 — **회귀 검증의 핵심**

회귀 검증 통과 후 `docs/backlog.md` Active의 ⏭️/⬜ 줄을 Done으로 옮기고 commit 메시지에 박제.

---

## 7. CP6 — B-3 Supabase 마이그레이션 (선택)

**언제:** 트랙 ② 진입 전 여유 있을 때. **블로킹 아님.**
**담당:** Opus(스키마 결정 — JSONB vs 정규화 컬럼) + Sonnet(작성).

워크오더 §6 그대로:
- `supabase/migrations/0002_session_cast.sql` 신규
- `lib/supabase/sync.ts` 시그니처를 `cast: CastMember[]` 로 맞추되 실제 배선은 STEP 7로 미룸 — 빌드만 안 깨지면 OK
- `lib/supabase/types.ts` 갱신

---

## 8. 합종연횡 표 — 한 눈에

| 체크포인트 | Opus | Sonnet | 운영자 |
|---|---|---|---|
| CP1 §5.1 검증 | — | — | **실행 + 분류** |
| CP2 (a)/(b) 수정 | **판단·문구** | 코드 반영 | 재검증 |
| CP3 §5.6 picker | **UX 디테일·워크오더 부록** | **재작성 실행** | 시각 검수 |
| CP4 §5.7~§5.8 | grep 결과 검증 | **전수 수정·enum 해제** | end-to-end 검증 |
| CP5 §5.9 출하 | — | — | **종합 검증 + Done 갱신** |
| CP6 B-3 (선택) | 스키마 결정 | 마이그레이션 작성 | 적용 시점 결정 |

**Opus 호출 트리거:** CP1 결과 보고 후 / CP3 시작 전 / CP4 마무리 후 / 회귀 이슈 발견 시.
**Sonnet 호출 트리거:** CP2 코드 반영 / CP3 재작성 / CP4 전수 수정. **각 호출 시 워크오더의 해당 §섹션 번호를 명시한다** — Sonnet은 워크오더를 인용해 자기 행동을 박제할 수 있다.

---

## 9. 위험 신호 — 만나면 멈출 것

1. **CP1에서 (a)/(b) 가 2회 시도 후에도 안 풀림** → Opus가 라우팅 좁히기(Gemini 고정) 또는 스키마 단순화 결정. Sonnet 단순 작업으로 위임.
2. **CP3에서 커스텀 폼이 자유 프롬프트 입력으로 변질** → 즉시 롤백. 굴복 금지 원칙 위반(워크오더 §2 원칙 3).
3. **CP4에서 grep 결과가 워크오더 §5.7 영향 파일 목록과 어긋남** → Opus가 차이 분석 후 결정. Sonnet 임의 판단 금지.
4. **CP5 회귀 검증(옛 세션)이 깨짐** → B-1 migrate 코드 점검. 마이그레이션 깨지면 데이터 손실이라 가장 민감.

---

## 10. 트랙 ① 완주 후

`backlog.md` Active 의 트랙 ① 항목 전체를 Done 으로 이전. Phase C(내 페르소나 서랍) / Phase D(필터·regenerate) 워크오더는 Opus 가 별도 작성한다 — 트랙 ②(결정 지도형 결론) 또는 트랙 ⑤(청크 엔진) 진입 결정과 함께.
