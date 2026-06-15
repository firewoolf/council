# 작업 의뢰서 — 트랙 ④ 거울 MVP (M-1~M-3)

> 담당: **Sonnet**(store·util·배관) + **Fable**(M-2·M-3 프롬프트 박제 — 본 문서) + Opus(PR 검수).
> 결정(David 2026-06-15): **device 단일 프로필 / 직설 톤 / M-1~M-3 풀스코프.**
> 선행: R-3' 항로(✦ 데이터), I-1 `concern-shaping.ts`(buildClarifyPrompt). 설계: `plan-2026-06-15-track4-mirror.md`.
> 앱 전제: 계정 없음 — `device_id`(localStorage) 익명 동기화. 프로필 = device 단일 객체.

---

## 0. 한 줄

세션 간 ✦ 회피 패턴을 누적해 새 세션 입구(I-1)에서 **직설로** 되비춘다. 굴복 금지 — 거울은 위로 기계가 아니라 맹점을 찌르는 존재다.

## 1. 데이터 설계 — 파생 vs 영속 (설계 노트 정제)

- **결정론 신호 = 파생(영속 X)**: ✦ offered/taken·회피율·반복 openQuestions는 store의 `sessionChunks`·`conclusions`에서 **매번 계산**한다. 카운터를 따로 저장하지 않음 → 이중집계·마이그레이션·정합성 버그 0.
- **LLM 의미 패턴 = 영속**: `observedPatterns`만 저장(LLM 출력은 재계산 불가).

## §M-1. 결정론 거울 통계 (Sonnet · LLM 0)

신규 `lib/mirror/stats.ts` — 순수 함수(store 의존 0, 인자로 받음):

```ts
interface MirrorStats {
  sessionCount: number;          // 결론까지 간 세션 수
  blindSpotOffered: number;      // ✦가 제시된 총 횟수
  blindSpotTaken: number;        // 그중 사용자가 택한 횟수
  avoidanceRate: number | null;  // offered>0 ? 1 - taken/offered : null
  recurringOpenQuestions: string[];
}
function computeMirrorStats(
  chunksBySession: Record<string, ChunkMeta[]>,
  conclusionsBySession: Record<string, Conclusion>,
): MirrorStats;
```

- `blindSpotOffered` = Σ(각 청크 `nextTopics` 중 `isBlindSpot===true` 개수).
- `blindSpotTaken` = 그중 `chunk.chosenNextLabel === 그 ✦ 후보.label` 인 횟수.
- `recurringOpenQuestions` = 모든 `conclusions[].openQuestions` 정규화(소문자·공백/문장부호 제거) 후 2회 이상 등장한 원문.
- `sessionCount` = conclusions 가 존재하는 세션 수.
- 테스트: 항로 수기 대조와 일치. store 미사용이라 단위 테스트 용이.

## §M-2. 입구 주입 — I-1 역질문에 거울 한 줄 (Fable 박제 + Sonnet 배관)

**M-2-a. `buildClarifyPrompt`(concern-shaping.ts:29) 시그니처 확장** — `(rawConcern, mirror?: string)`. mirror 있을 때만 블록 삽입(없으면 현행 = 회귀 0). 박제 텍스트:

```
[거울 — 이 사람의 누적 패턴]
{mirror}
위 패턴을 의식하되 *위로하지 마라*. 역질문 2~3개 중 최소 하나는 이 맹점을 정면으로 건드려라.
```

**M-2-b. mirror 문자열 생성**(클라이언트, `new/page.tsx` clarify 호출 직전, computeMirrorStats 결과로):

- 조건: `sessionCount >= 2 && avoidanceRate !== null && avoidanceRate >= 0.5`(임계 0.5 = 상수, 후속 어드민 튜닝). 미달 → `mirror = undefined`(거울 침묵 — 빈 거울 UI 금지).
- **직설 톤**(David 결정):
  ```
  지난 {sessionCount}세션에서 패널이 띄운 '못 본 각도(✦)'를 {offered-taken}번 피했습니다.
  ```
  M-3 있으면 `observedPatterns[0]` 한 줄 append: `… 반복 맹점: {pattern}`.

**M-2-c. 배관**: `clarifyConcern`(client.ts:490) → `buildClarifyPrompt` 에 mirror 인자 전달. `new/page.tsx`(clarify 호출 :147)에서 store 읽어 computeMirrorStats → mirror 문자열 → clarifyConcern 에 전달.

## §M-3. LLM 의미 병합 (Fable 박제 + Sonnet · sessionCount>=3)

**M-3-a. `store/profile.ts` 신설**: `{ observedPatterns: string[]; updatedAt: string }` — zustand persist(localStorage) + Supabase `user_profile` device_id row(기존 sync.ts device_id 패턴 복제).

**M-3-b. 병합 호출**: 결론 생성 직후(`useDebate.ts:665` generateConclusion resolve 후) 작은 LLM 1회. 입력 = 이번 세션 요약(concern·✦ 회피 여부·divided 제목·openQuestions) + 기존 observedPatterns. 출력 = 갱신 observedPatterns(1~3줄). 라우팅 = conclude/recommend 모델 재사용(가벼움, 세션당 1회).

**박제 프롬프트(굴복 금지 — 거울의 본질)**:

```
당신은 이 사용자의 의사결정 거울이다. 아래 [이번 세션]과 [기존 관찰]을 병합해,
이 사람의 *반복되는 사고 맹점*을 1~3줄로 갱신하라.
- 위로·합리화·칭찬 금지. 사실에 근거해 맹점만 짚어라.
- 1회성 특징은 버리고 *반복되는 것*만 남겨라. ("매번 검증을 건너뜀" 류)
- 데이터에 없는 추측 금지. 근거가 약하면 기존 관찰을 유지하라.
- 한국어로만.
```

- `sessionCount < 3` 또는 반복 신호 없음 → observedPatterns 유지/빈 배열(거울 침묵).

## 2. 합격선

| 지표 | 합격선 |
| --- | --- |
| computeMirrorStats 정확성 | 항로 수기 대조 일치(✦ offered/taken) |
| 입구 발화 조건 | sessionCount<2 또는 회피율<0.5 → 침묵 / 충족 시 직설 한 줄 |
| 굴복 금지 | M-2·M-3 거울 발화에 위로·합리화·칭찬 0 — 맹점 지적만 |
| 비용 | M-1·M-2 LLM 0 / M-3 세션당 1회(경량 모델) |
| 회귀 | 프로필·통계 없는 기존 흐름 무영향(mirror=undefined → buildClarifyPrompt 현행) |

## 3. 검증

- **시각(운영자)**: 3세션 이상 돌려 ✦를 의도적으로 피한 뒤, 새 세션 입구에서 거울이 직설로 짚는지 / 위로하지 않는지. 1세션째 침묵 확인.
- **기계**: typecheck/lint/build. computeMirrorStats 단위 테스트(✦ 0개·전부 택함·전부 피함 케이스). mirror=undefined 시 buildClarifyPrompt 바이트 동일.

## 4. 비범위 / 순서

- **나의 대리인 페르소나** — 토론 메커닉(보여주기), 거울 출하·검증 후 재론.
- **거울 페이지 대시보드(M-4)** — 별도 워크오더(누적 패턴 시각화 + 내보내기/삭제).
- 프라이버시: 프로필은 device 로컬+본인 Supabase row, 외부 노출 0. 삭제 경로는 M-4.
- 순서: M-1 → M-2(M-1 데이터 필요) → M-3(M-1 위). M-1·M-2만으로도 "✦ 회피율을 입구에서 직설로 되비추는" 거울 최소 기능이 선다 — M-3은 같은 PR 또는 후속.

## 5. 분담

- **Sonnet**: §M-1 전부, §M-2 배관(시그니처·mirror 생성·전달), §M-3 store/profile.ts·Supabase sync·병합 호출 배관.
- **Fable**: §M-2-a·§M-3-b 프롬프트 박제(본 문서) — 임의 수정 금지.
- **Opus**: PR 검수(특히 M-3 LLM 호출이 결론 경로를 막지 않는지 — 비동기·실패 무해).
- **운영자**: 다세션 라이브 — 거울 톤/정확성/굴복금지 판정.
