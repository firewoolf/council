# 후속 작업 백로그

> 단일 워크오더(`workorder-*.md`)로 묶기 어려운, 우선순위·근거가 명확한 후속 작업 큐.
> 새 후보는 가장 위 섹션에 누적. 처리 완료 시 PR 링크를 적고 아래 "Done" 으로 이동.

---

## Active

(현재 active 항목 없음)

---

## Done

### D-1. Session.aiProvider 동기화 (commit 현재) — 옵션 (I) 채택
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
