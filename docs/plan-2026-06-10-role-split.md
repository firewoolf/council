# 작업 분담 계획 — Fable / Opus / Sonnet (2026-06-10)

> 근거: `meeting-2026-06-10-ui-replan.md` (R 시리즈) + `meeting-2026-06-10-game-loop-prompts.md` (P 시리즈)
> 이 문서는 개별 워크오더(`workorder-*.md`)를 발행하기 위한 상위 분담표다.
> 분담 원칙:
> - **Fable** — 판단·창작·박제. 설계 결정, 프롬프트 본문, 워크오더 작성, 합격 기준. (이번 세션들의 코드 컨텍스트 전체 보유 — 기존 "Opus 박제" 관례를 승계)
> - **Opus** — 고위험 코드 직접 구현 + Sonnet PR 검수. (B-2 "Opus 직접 구현" 선례)
> - **Sonnet** — 명세가 닫힌 구현. 배관·UI 조립·데이터·CSS.
> - **운영자(David)** — 라이브 검증, 시각 검수, 프롬프트 전후 품질 비교 최종 판정.

---

## 진행 순서 / 병행 규칙

```text
P-A (프롬프트 1차)  ──┐  R-1과 병행 가능 (프롬프트·데이터만, UI 불가침)
R-1 (무대 단일화)   ──┤
                      ▼
R-2 (⑤-6 스트리밍)  ── R-1 합격 후. P-B와 같은 PR 금지.
                      ▼
P-B (moveType)      ── P-A·R-1 합격 후. R-2와 독립 PR.
                      ▼
R-3' (항로 뷰)      ── 트랙 ② 결정 지도 위에 렌더.
                      ▼
R-4 (거울/누적)     ── 항로 데이터 축적 후 설계 재개.
```

---

## R-1 — 무대 단일화 (순수 UI, LLM 코드 불가침)

| 작업 | 담당 | 비고 |
| --- | --- | --- |
| 워크오더 작성 — 컴포넌트 통폐합 명세, 최종 레이아웃 골격, 회귀 체크리스트 6항목 | **Fable** | 다음 산출물 |
| `SpeakerSpotlight` 폐기, `PersonaStageStrip` → `DebateStage` 흡수 | Sonnet | 명세 닫힘, 저위험 |
| `DebateFeed` 순수 기록 뷰 강등 (stageHeader 제거), 렌더 1곳 통합 | Sonnet | |
| 대화록 오버레이 삭제 → 무대 아래 고정 회의록 패널 (종료 시 자동 펼침) | Sonnet | |
| idle/concluded 무대 골격 유지 (정적 단체샷 + CTA) | Sonnet | |
| SteeringPanel·WaitingMemoArea 무대 하단 슬롯 교대 배치 | Sonnet | |
| 세션 페이지 useState 6개 → UI 스토어 이관 (시트 동시 1개 보장) | Sonnet | |
| PR 검수 (회귀 체크리스트 + 합격 지표: 화자 표시 1개·경로 1개·useState ≤2) | **Opus** | |
| 시각 검수 (모바일 실기기) | 운영자 | |

## R-2 — 트랙 ⑤-6 스트리밍 발화 ★고위험

| 작업 | 담당 | 비고 |
| --- | --- | --- |
| 워크오더 작성 — 턴 확정 규칙("다음 턴 시작 또는 스트림 종료 시 직전 턴 확정"), 큐 소비 재생 설계, 폴백 정책(청크 단위 재생성), 무결성 원칙(스트림=표시용/저장=완성본) | **Fable** | |
| `generateChunk` → `streamChunk` (`streamObject` partialObjectStream 파싱) | **Opus 직접 구현** | useDebate 심장부 + 파싱 엣지케이스 — Sonnet 위임 부적합 |
| `useDebate` 재생 엔진 전환: 완성 배열 timer → 턴 큐 소비 (readingTime·skipTurn·speed·쿨타임 계승) | **Opus 직접 구현** | |
| `providers.ts` `supportsStream` 플래그 + generateObject 폴백 경로 | Sonnet | 저위험 배관 |
| 대사 박스·MessageCard 글자 단위 타이핑 reveal (탭=즉시 완성) | Sonnet | CSS/컴포넌트 |
| 큐 공백 시 '다음 화자 준비 중' 무대 내 연출 | Sonnet | |
| WaitingMemoArea 노출 조건 축소 (첫 턴 도착 전까지만) | Sonnet | |
| 합격 판정: 첫 발언 체감 5초 이내, 공급사 3종(Groq/Cerebras/Gemini) 라이브 검증 | 운영자 + Opus | |

## P-A — 프롬프트 고도화 1차 (R-1과 병행)

| 작업 | 담당 | 비고 |
| --- | --- | --- |
| **보이스 카드 본문 10명분 박제** (아키타입 전원 — 화법·단골 프레임·금지어 3~4줄) | **Fable** | 프롬프트 품질 = 성패. 워크오더 부록 A |
| **장면 비트 본문 박제** (beat 1~4 + 패턴 반복 금지 한 줄) — `CHUNK_SYSTEM_PROMPT`·`buildChunkPrompt` 수정안 원문 | **Fable** | 부록 B |
| **designPanel 스키마 확장 지시문** (generated/custom의 voiceCard 동시 생성 — 추가 호출 0) | **Fable** | 부록 C |
| temperature 0.75·maxTokens 재산정·chunk 라우팅 값 결정 | **Fable** | 워크오더 본문 |
| **품질 체크리스트 5항목 박제** (상호 인용 반박 ≥2 / 화법 구분 / 벙벙함 0 / ✦ 성립 / 사회자 진행) | **Fable** | 부록 D |
| `personas.json` `voiceCard` 필드 + `types` + `schemas.ts` + 어드민 폼 | Sonnet | 배관 |
| `buildChunkPrompt` 보이스 카드 주입 + `useDebate` panel 매핑 확장 | Sonnet | |
| 청크 프롬프트 `data/prompts.json` 이관 + 어드민 편집 UI | Sonnet | 기존 패턴 복제 |
| PR 검수 | **Opus** | |
| 전후 품질 비교 (동일 고민 3개 × 체크리스트, 블라인드 화법 구분 테스트) | 운영자 (Fable이 평가 시트 제공) | |

## P-B — moveType (P-A·R-1 합격 후)

| 작업 | 담당 | 비고 |
| --- | --- | --- |
| 워크오더 작성 — moveType 5종 정의, sanitize 보정 규칙(counter+replyToIndex null→strike 강등 등), 시각 위계 3종 압축 명세 | **Fable** | |
| **원샷 장면 예시 본문 박제** (moveType 라벨 포함 6턴 미니 장면, ~500토큰) | **Fable** | 창작 품질 핵심. 부록 A |
| `chunkTurnSchema` moveType 추가 + `sanitizeChunk` 보정 | Sonnet | |
| 무대 연출 3종 (반격 펄스 / 크리티컬 / 질문 비네트) — CSS only | Sonnet | ⑤-5 부록 자산 재사용 |
| counter 인용률 측정 (80% 합격선) | 운영자 + Opus | |

## R-3' — 항로 뷰 + 갈림길 위계 (구 R-3 재정의)

| 작업 | 담당 | 비고 |
| --- | --- | --- |
| 워크오더 작성 — 항로 트리 정보구조, 안 가본 길 훅, ✦ 시각 위계 | **Fable** | |
| 항로 뷰 구현 (chunks 데이터 렌더링, LLM 호출 0) + SteeringPanel ✦ 위계 | Sonnet | 전체 저위험 |
| PR 검수 | **Opus** | |

## R-4 — Phase E 잔여 + 트랙 ④ 거울 (보류)

R-3' 출하 후 Fable이 설계 재개. 항로 데이터가 누적 프로필의 입력이 되는지 먼저 검증.

---

## 워크오더 발행 순서 (Fable 산출물 큐)

> ⚠️ 아래 1~5는 2026-06-10 *콘텐츠 피벗 이전* 큐다. 피벗(`meeting-2026-06-10-content-pivot.md`)으로 P-B·R-3'는 동결, 인사이트 트랙 I가 선행. 현재 활성 큐는 하단 **발행 현황(2026-06-14)** 참조.

1. `workorder-prompt-A-voicecard.md` — P-A (부록 A~D 박제 포함) ✅ 발행·구현 완료
2. `workorder-stage-R1-consolidation.md` — R-1 ✅ 발행·구현 완료(피벗으로 무대 폐기 후속)
3. `workorder-debate-5-6-streaming.md` — R-2 ✅ 발행, R-2a 구현(미커밋). **rev2(2026-06-14) 추가** — 분기 경계 프리페치 §G
4. `workorder-prompt-B-movetype.md` — P-B ❄️ 보여주기 동결
5. `workorder-route-view.md` — R-3' ❄️ 보여주기 동결

## 발행 현황 (2026-06-14, Fable 인계자)

활성 발행 큐 — 우선순위 순:

1. **`workorder-prompt-language-lock.md`** — 출력 언어 락 ★발행 완료, **Sonnet 즉시 착수 가능(독립·저위험)**
   실기기 검증에서 나온 확정 수정사항. 결론/청크 제목 영어 혼용·✦ 마커 차단. 프롬프트 텍스트 삽입만.
2. `workorder-debate-5-6-streaming.md` **rev2 §G** — 분기 경계 프리페치 + 사용자 발언화
   R-2c(Opus, chooseTopic 게이트) / R-2d(Sonnet, 사용자 발언 카드 + 피드 TypewriterText 재바인딩). R-2a(미커밋) 위에 적층.
3. 인사이트 트랙 I-1~I-3 + R-1.5b′ — ✅ 구현 완료(미커밋), 운영자 실기기 1회 검증함. 트랙별 분리 커밋 권고.

## 역할 경계 요약

| 산출물 유형 | 담당 |
| --- | --- |
| 설계 변경·우선순위 재조정·회의 | Fable (+운영자 승인) |
| 워크오더·프롬프트 본문·예시·합격 기준 | Fable |
| useDebate 재생 엔진·스트림 파싱 등 고위험 코드 | Opus 직접 구현 |
| Sonnet PR 코드 검수 | Opus |
| 명세 닫힌 구현 (UI·배관·데이터·CSS) | Sonnet |
| 라이브 검증·시각 검수·품질 최종 판정 | 운영자 |
