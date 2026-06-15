# 검증·커밋 키트 — 2026-06-14 (Fable)

> 목적: 미커밋으로 쌓인 인사이트 루프 + 스트리밍 + 항로 배치를 **안전하게 고정**한다. 새 보여주기 트랙(P-B·⑤-5) 동결 해제 전의 게이트.
> 대상: `council/` (branch `main`, 마지막 커밋 `993abb5 feat(R-1.5)`).

---

## 1. 현실 진단 — 트리가 트랙을 횡단해 엉켜 있다

미커밋 변경(working tree)을 트랙에 매핑하면, **여러 파일이 한 파일 안에서 여러 트랙을 동시에 담고 있다.** 깨끗한 트랙별 커밋은 whole-file `git add`로 불가 — `git add -p` 헝크 수술이 필요하고, 엉킨 파일(useDebate·orchestrator·summary·types)에선 분리 자체가 리스크다.

| 파일 | 담긴 트랙 | 분리 가능? |
| --- | --- | --- |
| `hooks/useDebate.ts` | R-2(stream)·I-2(핀)·R-2c·R-2d 게이트 | ✗ 깊게 인터리브 |
| `lib/prompts/orchestrator.ts` | I-3(evidenceMessageIds)·언어락 | ✗ 인터리브 |
| `app/.../summary/page.tsx` | I-3(근거칩)·R-3'(RouteView) | ✗ 인터리브 |
| `types/debate.ts` | I-2(Pin)·I-3·R-2d('user-choice') | ✗ 인터리브 |
| `components/debate/MessageCard.tsx` | I-2(핀버튼)·R-2d(타이핑) | ✗ |
| `components/debate/DebateFeed.tsx` | I-2·R-1.5b′·R-2d | ✗ |
| `app/.../page.tsx`·`DirectorConsole`·`store/session-ui.ts` | R-1.5b′(레이아웃) | △ 대체로 단일 |
| `lib/supabase/sync.ts` | R-2d('user-choice'→'speech') | ○ 단일 |
| `store/sessions.ts` | I-2(핀)·chunks | △ |
| `StagePanel.tsx` (삭제) | R-1.5b′ 무대 폐기 | ○ |
| (신규) `concern-shaping.ts`·`ConcernClarify.tsx` | I-1 | ○ |
| (신규) `PinBoard.tsx` | I-2 | ○ |
| `docs/*` | Fable 산출물 | ○ 무위험 |

→ **결론: "트랙별 분리 커밋"은 이 트리에선 비현실적.** 메모리의 기존 권고를 현실에 맞춰 갱신한다(아래 §2).

### ⚠️ 커밋 금지

- `.claude/settings.local.json` — 로컬 설정, 추적 금지. **`.gitignore`에 `.claude/settings.local.json` 추가** 후 커밋에서 제외.

## 2. 권고 커밋 계획 (실용)

순서대로 2~3개 커밋. bisect 가치는 줄지만 트리 현실에 맞고 안전하다.

1. **C1 — docs** (`git add docs/`): Fable 계획·워크오더 일괄. 코드 무관·무위험. 먼저 떼면 코드 diff가 깨끗해진다.
   - `git commit -m "docs: 2026-06-14 인사이트 피벗 워크오더 일괄(I-1~I-3·R-2 §G·R-3'·언어락) + 회의록"`
2. **C2 — 코드 배치** (검증 통과 후): 인사이트 루프 + 무대폐기 + 스트리밍 분기 + 항로 + 언어락. 파일들이 엉켜 있어 한 배치가 정직하다.
   - `git commit -m "feat: 인사이트 루프(I-1 고민다듬기·I-2 핀·I-3 결정지도 근거추적) + R-1.5b′ 무대폐기 2단 + R-2 §G 분기 hook 발언화·게이트 + R-3' 항로 뷰 + 결론 언어락"`
   - StagePanel.tsx 삭제도 이 커밋에 포함(`git add -A`).
3. (옵션) bisect를 정말 원하면 **C2를 둘로**만 쪼갠다 — 헝크 수술 최소화 선:
   - C2a: I-1 신규 파일(`concern-shaping.ts`·`ConcernClarify.tsx`·`new/page.tsx`·`ConcernInput.tsx`) — 입력 단계, 비교적 독립.
   - C2b: 나머지(토론·결론·항로·언어락) — 엉킨 본체.

> 핵심: 파일이 안 갈라지면 커밋도 안 갈라진다. 그 이상의 분리는 `git add -p` 수작업이고, 검증 1회로 배치가 통과하면 굳이 칠 필요 없다.

## 3. 실기기 통합 검증 체크리스트 (운영자, 공급사 3종)

한 세션을 끝까지 돌리며 칸을 채운다. 공급사: Groq → Cerebras → Gemini 각 1회(스트리밍 경로), openrouter 1회(레거시 generateObject 경로).

**입력 — I-1 고민 다듬기**
- [ ] 한 줄 입력 → AI 역질문 2~3개 → 답하며 concern 풍부해짐
- [ ] 빈/짧은 입력 가드, 역질문 스킵 가능

**토론 재생 — R-1.5b′ + R-2**
- [ ] 무대 패널 없음. 웹=피드+콘솔 2단 / 모바일=챗(상시 입력바)
- [ ] 갈림길 선택 → **내 발언(hook) 카드 글자단위 타이핑** → 그 사이 다음 장면 생성
- [ ] 게이트: hook 타이핑 끝나기 전 다음 턴 안 끼어듦 / 두 카드 동시 타이핑 0
- [ ] 짧은 hook → thinking 비트로 자연 전환 (빈 화면 0)
- [ ] 2x 속도에서 hook·게이트 같이 빨라짐 / 탭 스킵 즉시
- [ ] watchpoint: hook 타이핑 중 사회자 TypingIndicator 동시 노출이 거슬리지 않는지

**마킹 — I-2 핀**
- [ ] 발언 핀 토글 → 결론에서 핀 논점 우선 반영 + 근거칩에 핀 아이콘

**결론 — I-3 결정지도 + 언어락**
- [ ] divided(끝내 갈린 것) 양쪽 입장 + memberIds + 근거칩(발언자 orb+프리뷰)
- [ ] **언어: divided.topic·side·openQuestions에 영어 단어 0 / 제목 ✦·★ 마커 0** (nextTopics label의 ✦는 의도 — 결론엔 없어야)
- [ ] 동일 고민 3개 재생성으로 언어 0건 재확인

**항로 — R-3'**
- [ ] 결정지도 위 "내가 항해한 길" 트리: 고민 → 청크 → 선택 → 결론
- [ ] 선택/안 가본 길/✦ 못 본 각도 3단 시각 구분
- [ ] 모바일 폭에서 트리·연결선 안 깨짐 / 직접입력 세션 "직접 입력한 길"

**회귀**
- [ ] 옛 세션(v1 결론) LegacyConclusionView 정상 / 청크 0개 세션 항로 미표시
- [ ] skipTurn·speed·디렉션 메뉴·메타지시 정상
- [ ] 스트림 중 새로고침 → 마지막 완성 청크 기준 복원(half-state 0)

## 4. 검증 후 폴드 후보 (옵션 nit, 비차단)

- R-2d 게이트: `useDebate.ts:566` 직전 `if (revealTimerRef.current) clearTimeout(...)` (홀드 중 타이머 누적 방지).
- R-3' 항로: 직접입력 렌더를 `nextTopics.length>0` 가드 밖으로(빈 nextTopics+chosen 방어).
- 언어락(옵션): 고유명사 예외절 — 브랜드명 음차되면 "예외: 제품·브랜드 고유명사" 한 줄.

## 5. 다음 (검증 통과 후)

보여주기 동결 해제 후보 재론: **P-B moveType(충돌을 데이터로 — 결정지도 입력으로 재프레이밍하면 인사이트 정렬)** > ⑤-5 게임화(순수 보여주기). 또는 트랙 ④ 거울/누적(항로 데이터가 씨앗 — R-3' 출하로 입력 생김).
