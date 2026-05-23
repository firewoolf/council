# 후속 작업 백로그

> 단일 워크오더(`workorder-*.md`)로 묶기 어려운, 우선순위·근거가 명확한 후속 작업 큐.
> 새 후보는 가장 위 섹션에 누적. 처리 완료 시 PR 링크를 적고 아래 "Done" 으로 이동.

---

## Active

### B-3. 변경 이력 페이지 (`/admin/history`)
- **배경**: 어드민 편집은 GitHub commit이 진실. UI에서는 마지막 commit 링크만 보이고, 누적 변경 로그를 한 화면에서 확인 못함.
- **할 일**:
  - `/admin/history` 서버 페이지.
  - GitHub Commits API (`/repos/{owner}/{repo}/commits?path=data/personas.json`) 로 페이지네이션.
  - 각 commit의 SHA, 메시지, 시각, 변경 파일 표시 + GitHub 링크.
  - 캐시는 5분 정도 (rate limit 보호).

### D-1. Session.aiProvider 동기화 정책
- **배경**: Phase C 자동 폴백 도입 후, 토론 중 실제 사용 공급사가 세션 시작 시점과 달라질 수 있음. 그러나 `Session.aiProvider` 메타데이터는 시작 시점 그대로 — `/history` 카드 등에서 표시되는 라벨이 부정확.
- **선택지**:
  - (I) **마지막 성공 공급사로 갱신** — useDebate 가 호출 후 `updateSessionProvider(sessionId, provider)` 호출. 가장 직관적.
  - (II) **시작 공급사 유지** — 메타데이터 의미는 "사용자가 의도한 공급사". 폴백 사실은 별도 필드 (`fallbackHistory`) 로 보존.
  - (III) **별도 필드 추가** — `Session.lastUsedProvider` 신설, `aiProvider` 는 시작 표기용.
- **결정 필요**: 사용자가 `/history` 에서 무엇을 보고 싶은지에 달림. 단순함 우선이면 (I).
- **할 일** (옵션 I 기준):
  - `store/sessions.ts` 에 `updateSessionProvider(id, provider)` 추가.
  - useDebate 의 두 호출 (generateSpeech / generateConclusion) 성공 직후 호출.
  - 단 매 턴마다 호출하면 zustand persist write가 과해짐 → 마지막 사용 공급사가 바뀐 경우에만 호출하는 가드 필요.

---

## Done

### B-4. 추천 로직의 페르소나 fallback (commit 현재)
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
