# 백로그 — MI 능동성 & 피드백 루프

COUNCIL ↔ insight-out MI 연동의 다음 단계. 레벨 1(진입 시 주제 제안)·레벨 2(브리핑형)는
2026-07-15 구현됨(`components/session/TopicSuggestions.tsx` + `lib/prompts/topic-proposer.ts`).
아래는 그 다음.

---

## 레벨 3 — 앰비언트/푸시 (능동 밀기)

MI가 바뀔 때 council이 **먼저 알린다.** insight-out의 기존 인프라와 결합:

- **딥링크 심기 (저비용, 지금 가능)** — insight-out 데일리 브리핑·뉴스레터·데일리 인사이트에
  "이 주제로 토론하기" 링크를 `/dashboard/council?topic=<주제>&context=<메모>` 로 심는다.
  (딥링크 프리필은 이미 CouncilWorkspace/EmbedBridge 에 구현됨.)
- **스케줄 푸시** — insight-out cron(이미 존재: briefing/daily-insights/trending-snapshot)에
  "이번 주 토론할 이슈 N개"를 산출해 뉴스레터/브리핑에 첨부. 또는 별도 스케줄 태스크.
- **중요도 랭킹** — `importance_score`·trending 으로 제안 우선순위. (레벨 2 정렬을 서버 신호로 강화.)

작업 위치: 주로 insight-out(브리핑·cron·뉴스레터 템플릿). council은 딥링크 수신만 하면 됨(완료).

---

## 피드백 루프 — MI → 토론 → 인사이트 → MI

토론 결론을 다시 insight-out으로 흘려 순환을 만든다. **회신 채널은 이미 있음** —
council summary 페이지가 `postMessage('result', {sessionId,title,concern,conclusion})` 를 호스트로 보냄.

- **호스트 싱크** — insight-out CouncilWorkspace 의 `result` 수신부(현재는 배너 표시만)를
  확장해, 토론 결론을 insight-out에 저장(예: `council_insights` 테이블 / ai_reports 초안).
  → 팀이 "MI에서 촉발된 토론의 결론"을 자산으로 축적.
- **MI 반영** — 축적된 결론을 다음 주제 제안(topic-proposer)·페르소나 설계 컨텍스트에 재주입
  → "지난번 이 결론을 냈는데, 이번엔…" 형태의 연속성.
- **루프 완성** — MI(데이터) → 제안 → 토론 → 결론(인사이트) → insight-out 반영 → 다음 MI에 반영.

전제: 결론 저장은 인증/스코프 필요(로그인 사용자 귀속). 서버키 티켓(`sub=userId`)을 재사용 가능.

---

## 알려진 한계 (정리 필요)

- **클라이언트 공급사 라우팅 4/9** — 서버 프록시는 9개 공급사를 지원하지만, 클라이언트
  `runWithFallback` 이 `listAvailableProviders`(= `BYOK_PROVIDERS` ∩ keys = groq/gemini/cerebras/openrouter 4개)
  로 후보를 좁혀, 서버 전용 5개(mistral/sambanova/nvidia/together/github)는 env 키를 넣어도
  실제 라우팅되지 않는다. → `listAvailableProviders`/`runWithFallback` 를 서버 모드에서
  `SERVER_PROVIDERS` 기준으로 넓히면 9개 전부 사용 가능. (소규모 수정.)
