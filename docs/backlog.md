# 후속 작업 백로그

> 단일 워크오더(`workorder-*.md`)로 묶기 어려운, 우선순위·근거가 명확한 후속 작업 큐.
> 새 후보는 가장 위 섹션에 누적. 처리 완료 시 PR 링크를 적고 아래 "Done" 으로 이동.

---

## Active

### B-1. 토론 중 발언 생성에도 quota fallback 확장
- **배경**: `lib/ai/showAiError.ts` + `session/new` 흐름에는 자동 공급사 전환을 붙였지만, 회의실 안에서 도는 `generateSpeech` 가 같은 패턴을 안 씀. 토론 도중에 quota가 터지면 진행이 끊기고 사용자가 직접 /settings 로 가서 토글해야 함.
- **할 일**:
  - `hooks/useDebate.ts` (또는 회의실 컨테이너)에서 `generateSpeech` 호출부 catch.
  - `AiCallError && kind === 'quota'` 일 때 store 의 다른 공급사 키 있으면 토스트 액션 노출 → 클릭 시 `setProvider` 후 다음 턴부터 새 공급사로 계속.
  - 진행 중 메시지 손실 X — 실패한 턴만 다시 시도.
- **주의**: `Session.aiProvider` 가 세션 단위 메타데이터로 저장돼 있음. 토론 중 전환 시 이 필드를 업데이트할지, 그대로 둘지 결정 필요.

### B-2. 어드민 진입점 노출
- **배경**: `/admin` 으로 직접 URL 입력해야만 접근 가능. 운영자 본인이 사용 동선을 외워야 함.
- **할 일**:
  - 메인 푸터에 작은 link (`isAdminEnabled()` 가 true일 때만 노출).
  - 또는 `/settings` 페이지 하단에 "운영자만" 라벨로 노출.
  - 일반 사용자 메뉴에 노출하지 않기 — 운영자만 알아보면 충분.

### B-3. 변경 이력 페이지 (`/admin/history`)
- **배경**: 어드민 편집은 GitHub commit이 진실. UI에서는 마지막 commit 링크만 보이고, 누적 변경 로그를 한 화면에서 확인 못함.
- **할 일**:
  - `/admin/history` 서버 페이지.
  - GitHub Commits API (`/repos/{owner}/{repo}/commits?path=data/personas.json`) 로 페이지네이션.
  - 각 commit의 SHA, 메시지, 시각, 변경 파일 표시 + GitHub 링크.
  - 캐시는 5분 정도 (rate limit 보호).

### B-4. 추천 로직의 페르소나 fallback
- **배경**: 어드민이 페르소나를 삭제했을 때, 모델이 추천한 `personaId` 가 더 이상 존재하지 않으면 `PERSONA_MAP[id]` 가 undefined 가 돼 회의 시작이 깨질 수 있음.
- **할 일**:
  - `recommendPersonas` 응답을 받자마자 `PERSONAS` 와 cross-check.
  - 없는 id 는 silently drop + 부족분은 random sample 로 보충.
  - 또는 추천 프롬프트에 현재 페르소나 ID 목록을 명시적으로 주입해 모델이 임의 id 생성 못하게.

---

## Done

(없음)
