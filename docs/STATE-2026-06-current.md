# COUNCIL (AI 회의) — 현재 상태 보고 (2026-06)

> 목적: 아뜰 통합 판단을 위한 현 기능·메뉴·운영 시나리오 스냅샷. 실제 코드(app 라우트·components·lib/ai) 기준.

---

## 0. 한 줄 정의 + 스택

**N명의 AI 전문가 패널이 사용자의 고민을 *토론*해주고, 그 결과를 *결정 지도*로 정리해주는 앱.**
Next.js(App Router) · Tailwind · shadcn · Zustand · Supabase(익명 device_id) · LLM은 **BYO 키 클라이언트 호출**(Groq·Cerebras·Gemini·OpenRouter·Claude).

---

## 1. 메뉴 / 라우트 구성

### 사용자 영역 `app/(main)/`

| 라우트 | 화면 | 핵심 |
|---|---|---|
| `/` | 홈 | Hero + 최근 세션(RecentSessions) |
| `/session/new` | 새 회의 | 고민 입력 → (AI 다듬기/바로 시작) → 패널 설계 → 시작 |
| `/session/[id]` | 회의실 | 토론 재생·갈림길·핀·디렉션 (심장) |
| `/session/[id]/summary` | 결정 지도 | 결론 3분류 + 근거칩 + **항로 뷰** |
| `/history` | 기록 | 지난 세션 목록 |
| `/settings` | 설정 | API 키 관리(공급사별) |

### 운영자 영역 `app/admin/`

| 라우트 | 용도 |
|---|---|
| `/admin` · `/admin/login` | 대시보드 · 로그인 |
| `/admin/personas` (+ new·[id]·edit) | 페르소나 편집(아키타입 10종) |
| `/admin/prompts` (+ edit) | 청크/시스템 프롬프트 어드민 편집 |
| `/admin/history` | 전체 세션 열람 |

---

## 2. 기능 구성

| 영역 | 기능 | 상태 |
|---|---|---|
| **입력 I-1** | 고민 다듬기 — AI 역질문 2~3개 → concern 합성 (`concern-shaping.ts`) | ✅ |
| **패널 설계** | designPanel — 아키타입 10종(투자자·개발자·잡스형·현실주의자·사회자 등) + generated/custom, 보이스 카드 | ✅ |
| **토론 엔진** | 청크 기반(1호출=3~5턴+갈림길), **R-2 스트리밍**(streamChunk·타이핑 reveal), **moveType**(strike/counter/concede/escalate/probe) | ✅ (main) |
| **조향(갈림길)** | nextTopics 후보(✦ 못 본 각도 포함)·직접 입력·**R-2 §G**(선택 hook→사용자 발언 타이핑+다음 청크 프리페치) | ✅ (거울 브랜치) |
| **마킹 I-2** | 핀(PinBoard) — 발언 저장 → 결론 우선 입력 | ✅ |
| **디렉션** | 카드별 감독 지시(DirectionMenu)·메타 지시(SpeechComposer) | ✅ |
| **결론 I-3** | 결정 지도 — consensus / **divided(끝내 갈린 것)** / openQuestions + evidenceMessageIds **근거칩** + 핀 표시 | ✅ |
| **항로 R-3'** | summary에 분기 트리(선택/안 가본 길/✦ 못 본 각도) | ✅ |
| **거울 ④** | 세션 간 ✦ 회피율 누적 → 다음 세션 입구(I-1)에 직설 주입 + 3세션+ LLM 의미 병합 | 🟡 브랜치(codex/track4-mirror) |
| **연출** | 사운드(Web Audio)·페르소나 orb·TypingIndicator·페르소나 상세 드로어 | ✅ |
| **공급사** | gemini·groq·openrouter·cerebras·claude, 폴백 체인(runWithFallback) | ✅ |

> 폐기됨: 무대(DebateStage) — R-1.5b′로 제거. 웹=피드+디렉터 콘솔 2단, 모바일=GPT식 챗. (BackgroundPicker·stage store는 일부 잔재 가능 — 점검 대상)

---

## 3. 운영 시나리오 (end-to-end)

```
홈 → 새 회의
 │
[입력] 고민 한 줄 입력
 ├─ "AI와 다듬기" → 역질문 2~3개 → 답하며 concern 풍부해짐
 │                  (거울: 누적 ✦ 회피 있으면 "지난 N세션에서 ✦를 M번 피함" 직설 주입)
 └─ "바로 시작"
 │
[설계] 패널 자동 설계(아키타입+생성) → 페르소나 확정
 │
[회의실] 시작 → 사회자 모두 발언(intro) → 청크 토론 재생
 │   · 발언이 한 명씩 글자 단위로 흘러나옴(스트리밍)
 │   · 각 턴에 수(手) moveType — counter면 "↩반박" 등
 │   · 중간: 핀(I-2) / 카드 디렉션 / 메타 지시
 │
[갈림길] 후보 2~4개 중 선택(✦ 못 본 각도 포함) 또는 직접 입력
 │   · 내 선택이 "내 발언"으로 타이핑되는 동안 다음 청크 백그라운드 생성
 │   └─ (반복) 다음 청크 → 갈림길 → …
 │
[결론] "결론 내기" → 결정 지도
 │   · 합의된 것 / 끝내 갈린 것(★ 근거칩·핀) / 내가 답할 질문
 │   · 항로 뷰 — 내가 항해한 갈림길 트리(안 가본 길·✦)
 │
[메타] 결론 후 거울 프로필 갱신 → 다음 세션 입구를 벼림
```

핵심 루프: **입력(I-1) → 토론(I-2·moveType) → 결론(I-3) → 항로(R-3') → 거울(④) → 다시 입력.** 인사이트가 한 바퀴 돈다.

---

## 4. 현재 상태 / 미해결

| 항목 | 상태 |
|---|---|
| main 브랜치 | 인사이트 루프(I-1~I-3)·R-2 스트리밍·언어락·R-3' 항로·**P-B′ moveType** 머지 완료 |
| 거울(④) | `codex/track4-mirror` 브랜치 커밋, 검수 통과, **미머지**. Supabase migration(0002) 적용·3세션 라이브 톤 미검증 |
| **🔴 미해결 버그** | **회의 시작+페르소나 선택 직후 "Maximum update depth exceeded"(무한 setState 루프) 크래시.** 정적 검토로 useDebate 효과·페이지·거울 코드에선 동기 루프 안 나옴 → dev 모드 스택 또는 base 브랜치 가르기로 원인 특정 필요(진행 중단됨) |
| 잔재 점검 | 무대 폐기 후 BackgroundPicker·stage store 잔존 여부 |

---

## 5. 아뜰 통합 관점 (한 줄)

COUNCIL의 결론(결정 지도)·항로는 **그대로 아뜰의 Decision(ADR) 자산**이 된다 — 아뜰 오케스트레이션 허브(ADR-015)의 "AI가 결정을 생성·자산화" 기둥과 정렬. 단 데이터/인증/LLM 레이어가 달라(Supabase·익명·BYO vs Convex·Clerk·서버), iframe=프로토타입 / 네이티브 포팅=목적지. (별도 검토 노트 참조)
