# 후속 작업 백로그

> 단일 워크오더(`workorder-*.md`)로 묶기 어려운, 우선순위·근거가 명확한 후속 작업 큐.
> 새 후보는 가장 위 섹션에 누적. 처리 완료 시 PR 링크를 적고 아래 "Done" 으로 이동.

---

## Active

### 트랙① Phase B-2 — 동적 생성 + 커스텀 + picker 재작성
워크오더 `docs/workorder-persona-B-cast.md` §5. **진행 중.**
진행 가이드(체크포인트·역할 분담): `docs/plan-track1-phase-b-completion.md` (Opus, 2026-05-26).
CP3 워크오더 부록(§5.6): `docs/workorder-persona-B-cast-cp3.md` (Opus, 2026-05-26).
CP4 워크오더 부록(§5.7~§5.8): `docs/workorder-persona-B-cast-cp4.md` (Opus, 2026-05-26).

### 트랙 ⑤-1 청크 엔진 — Gold Standard 박제
Phase B 완주 직후 진입 예정. 워크오더 `docs/workorder-debate-5-1-chunk-engine.md` 본체 존재.
Gold standard 예시(LLM 한 호출이 재현해야 할 청크 산출물): `docs/example-target-discussion.md` (Opus, 2026-05-26).
구현 시 워크오더 본문 §3 chunkSchema 와 §4 buildChunkPrompt 가 example 의 표 §5 제약 6개를 강제해야 함.

### 트랙 ① Phase E — 페르소나 모델 v2 (다축 trait)
워크오더 `docs/workorder-persona-E-multitrait.md` (Opus, 2026-05-26).
**진단:** 현재 `Temperament` enum 5종이 stance·lens·expression 3축이 섞인 비-MECE 모델.
잡스 같은 *옹호적·분석적·도발적* 조합 표현 불가.
**해결:** `Trait = { stanceAxis, lens, expression }` 3축 객체로 분리.
**권장 순서:** 트랙 ⑤-1 청크 엔진 출하 *후* 진입 (모델 변경이 청크 프롬프트와 충돌 방지).
출하 단위 2개: E-1 데이터 모델 + 마이그레이션 / E-2 추천기 + UI.

**현재 커서 (2026-05-24):**
- ✅ §5.1 검증 슬라이스 출하 — `panelDesignSchema`(느슨한 스키마: enum·min 제거),
  `buildPanelDesignPrompt`, `designPanel`(client), `sanitizePanel`(정규화·강등·보충·dedupe),
  `synthesizeCharacterPrompt`. `designPanel`을 new-session 흐름에 최소 배선 — picking
  화면에 generated 멤버("즉석 설계 전문가") 표시까지.
- ✅ 하드닝 — `panelMemberSchema`의 name/role/reason `.optional()`,
  `sanitizePanel` generated 폴백(`'전문가'`/`'이 분야 전문가'`) + archetypeId dedupe.
- ⏭️ **다음 할 일 = 운영자 라이브 §5.1 검증.** `/settings`에서 키 등록 후 비아키타입
  분야 고민("동물병원 SaaS 만들지, 군 전역 후 다른 창업"類)으로 1세션 → picking
  화면에서 generated 멤버 등장·stance 구체성·에러 여부 확인 (Gemini/Groq 각각, 키 하나씩).
  picking 화면까지만 — 회의 시작 누르면 generated 발언자가 회의실에서 "???" 로 뜸(§5.7 미완, 정상).
  에러 시 구분: (a) JSON 생성 자체 실패 → 스키마 평탄화 / (b) JSON 왔으나 부실 → sanitize·프롬프트 튜닝.
- ⬜ §5.1 통과 후 B-2 본체: PersonaPicker 전체 재작성·커스텀 추가 폼·temperament 뱃지(§5.6),
  렌더링 cast 전환(§5.7 — debate/summary/history 의 PERSONA_MAP 조회 → cast 조회),
  `conclusionSchema.personaId` enum 해제(§5.8).

### 트랙① Phase B-3 (선택) — Supabase `session_cast` 마이그레이션
미연결이라 블로킹 아님. 워크오더 §6.

---

## Done

### 트랙① Phase B-1 — 데이터 모델 마이그레이션 (commit 35e1433)
워크오더 `docs/workorder-persona-B-cast.md` §4. "보이는 변화 0, 데이터 배관만" 출하.
- ✅ `types/persona.ts`: `Persona` → `Archetype` 개명, `Temperament` union, `CastMember` 신규. `dynamic` 필드 제거.
- ✅ `data/personas.json`: 10명 모두 temperament 추가 (워크오더 §4.2 매핑), `dynamic` 제거, domain-expert 자리표시자 정리.
- ✅ `data/prompts.json`: `temperamentDirectives` 5개 추가 (BASE 의 굴복/벙벙함 가드와 충돌 없게 "단, …" 가드 포함).
- ✅ `lib/admin/schemas.ts`: `personaSchema`(temperament 추가, dynamic 제거), `promptsSchema`(temperamentDirectives 5종 추가).
- ✅ `components/admin/PersonaForm.tsx`: temperament 셀렉터 추가, dynamic 체크박스 제거. `PromptsEditForm` 에 5개 textarea.
- ✅ `store/sessions.ts`: `sessionPersonas` + `sessionStances` → `sessionCast: Record<sessionId, CastMember[]>`. `persist` `version: 1` + `migrate` (v0→v1). 알 수 없는 아키타입 id 는 드롭하되 앱은 살림.
- ✅ `composePersonaPrompt(cast: CastMember, { concern })`: temperament 지시 + stance + characterPrompt 라이브/스냅샷 분기 + 미존재 아키타입 방어.
- ✅ `useDebate`: `EMPTY_CAST` 모듈 const, `cast` 구독, `activePersonas: CastMember[]`, `addCastMember`. `composePersonaPrompt` / `buildDebateContext` / `generateConclusion` 호출 모두 cast 전환.
- ✅ `orchestrator.ts`: `decideNextSpeaker(activeCast)`, `buildDebateContext`/`buildConclusionPrompt` 인자 cast로. `conclusionSchema.personaId` enum 은 그대로(B-2 에서 해제).
- ✅ `session/new/page.tsx` `handleStart`: `safe.ids` + `stances` → `CastMember[]` 변환 후 `createSession({ cast })`.
- ✅ 렌더링은 그대로 — debate UI 는 PERSONA_MAP 조회 유지 (`m.archetypeId` 로 매핑). B-1 통찰에 따라 generated/custom 등장하는 B-2 에서만 cast 직접 조회로 전환.

### 트랙① Phase A — stance 도입 (commit 0fb8a73)
워크오더 `docs/workorder-persona-A-stance.md` 기반.
- ✅ `recommendationSchema.recommended` 에 `stance: string` 추가. enum personaId 유지(고정 10명).
- ✅ `buildRecommenderPrompt` 에 "추진/반대/제3 각도로 입장 갈리게" 강제 지시.
- ✅ `store/sessions.ts`: `sessionStances` 가산 필드 + `createSession({ stances })` + `getStances()` + `deleteSession` 정리. zustand persist version 동결 → 기존 LocalStorage 호환.
- ✅ `composePersonaPrompt({ stance })` — 빈 문자열이면 블록 생략. "입장을 견지하라" 블록 삽입 (사용자 굴복 금지와 별개 — 페르소나 간 토론용 내적 일관성).
- ✅ `useDebate`: store 에서 stances 구독, 호출 시 `stances[speaker.id] ?? ''` 전달. `EMPTY_STANCES` 모듈 const 로 reference 안정성 확보.
- ✅ `session/new/page.tsx`: 추천 응답 → stanceMap 추출 → state 보관 → `handleStart` 에서 createSession 에 전달. 풀에서 추가한 페르소나는 stance 없음(중립) — 정상.
- ✅ `PersonaCard` + `PersonaPicker`: 추천 카드에 "입장: ___" 한 줄 표시 (accent 색, 추천 사유 칩과 구분).

Phase B (CastMember 모델·동적 생성·temperament 등)는 Opus가 별도 워크오더로 작성 — A와 묶지 않음.

### E-1. ADMIN_PASSWORD 미설정 시 /admin/login 안내 (commit 7b490a2)
- ✅ `app/admin/login/page.tsx` 를 server component 로 변환 + 비활성 상태면 안내 카드, 활성이면 client `LoginFormBoundary` 렌더.
- ✅ `LoginForm + LoginShell` 을 `LoginForm.tsx` 로 분리. 'use client' 격리.
- 효과: ADMIN_PASSWORD 없는 환경에서 `/admin` 직접 접근 시 빈 폼 대신 명시적 비활성 안내 + GITHUB_TOKEN/REPO 함께 설정 가이드.

### D-1. Session.aiProvider 동기화 (commit 3efccdf) — 옵션 (I) 채택
- ✅ `store/sessions.ts` 에 `updateSessionProvider(id, provider)` 추가. 기존 값과 같으면 no-op (zustand persist write 안 일어남).
- ✅ `runWithFallback` 반환에 `usedProvider` 포함 (`RunWithFallbackResult<T>`). 호출자가 실제 성공한 공급사를 정확히 알 수 있게.
- ✅ useDebate 가 generateSpeech / generateConclusion 성공 직후 `updateSessionProvider(sessionId, usedProvider)`.
- 결정 근거: CLAUDE.md ❷ "단순함 우선". 운영자 본인용이라 fallbackHistory 같은 추가 필드는 과함. /history 라벨이 "실제 마지막 사용 공급사"를 보여주는 게 사실에 부합.

### B-3. 변경 이력 페이지 (commit 현재)
- ✅ `lib/admin/github.ts` 에 `listCommits(path, perPage)` 추가. `next: { revalidate: 300 }` 로 5분 캐시 → GitHub rate limit (5000/h) 보호.
- ✅ `/admin/history` 서버 페이지. `data/personas.json` + `data/prompts.json` 두 path 의 commit 을 합쳐 시간 역순 최근 50개 표시.
- ✅ 각 commit: SHA(short), 메시지(title+body), 시각, 작성자, 어느 파일 변경인지 라벨, GitHub 링크.
- ✅ 어드민 대시보드(`/admin`)에 변경 이력 카드 추가 (isEditEnabled() 가드).

### B-4. 추천 로직의 페르소나 fallback (commit 99d86b6)
- ✅ 이미 처리돼 있던 것: `personaIdSchema = z.enum(PERSONAS.map(p=>p.id))` — Zod가 환각 id를 generateObject 단에서 차단. 빌드 시점에 PERSONAS와 동기화.
- ✅ 이미 처리돼 있던 것: `PERSONA_CATALOG` — 추천 프롬프트에 현재 페르소나 목록을 명시 주입.
- ✅ 추가: `lib/persona-safety.ts` — 추천 응답·선택 ids 두 지점에서 stale id 가드.
  - `sanitizeRecommendedIds`: unknown drop + 부족분 무작위 보충 (facilitator/domain-expert 제외)
  - `sanitizeSelectedIds`: handleStart 직전 마지막 검증
  - 보충·드롭 발생 시 `toast.info` 로 사용자 안내

### B-2. 어드민 진입점 노출 (commit d7d799c)
- ✅ 메인 푸터에 작은 "운영자" 링크 추가 (`app/(main)/layout.tsx`).
- ✅ `isAdminEnabled()` true 일 때만 노출 — 일반 사용자에게는 숨김.
- 톤: 회색·작음(11px)·ShieldCheck 아이콘. 일반 푸터 정보 옆에 자연스럽게.

### B-1. 토론 중 발언 생성에도 quota fallback 확장 (commits 2eebde3, cbd05cc)
- ✅ Phase C `runWithFallback` 로 자동 처리. 토스트 액션 클릭 흐름 대신 "조용한 자동 폴백" 으로 정책 변경 (더 매끄러움).
- ✅ 진행 중 메시지 손실 없음 — 실패한 턴만 재시도.
- ✅ 폴백 발생 시 `onFallback` 콜백으로 사용자에게 `toast.info` 알림 ("Groq 한도 → Cerebras 로 자동 전환").
- ✅ 모든 후보 소진 시 `showAiError` 로 친절한 안내 + `status='error'` 로 정지. 사용자가 /settings 손보고 "다시 시작" 누르면 재개 가능.
- ➡️ 남은 한 가지 (`Session.aiProvider` 동기화) 는 정책 결정 필요해 **D-1 로 분리**.
