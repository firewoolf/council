# 작업 의뢰서 — R-3': 항로 뷰 (선택의 기록)

> 담당: **Sonnet** (순수 렌더, LLM 호출 0, 저위험). 작성: Fable. 검수: Opus PR + 운영자 시각.
> 대상 레포: `council/`. 선행: I-3 결정 지도(summary/page.tsx) 출하됨, R-2 §G(user-choice 카드) 구현됨.
> 선행 문서: `meeting-2026-06-10-game-loop-prompts.md` §4(항로가 보상), `meeting-2026-06-10-content-pivot.md`(R-3' = 인사이트 루프 완성).

---

## 0. 한 줄 목표

이번 세션에서 사용자가 *어느 갈림길에서 무엇을 골랐는가*(선택의 기록)를 결정 지도 위에 분기 트리로 그린다. 결론이 '받은 답'이 아니라 **'내가 항해한 결과'**가 되게 한다. LLM 호출 0 — 이미 저장된 데이터의 렌더.

## 1. 인사이트 루프에서의 위치

입력 I-1(고민 다듬기) → 토론 I-2(핀) → 결론 I-3(결정 지도)까지 깔렸으나, **"어떻게 거기까지 갔는가"가 비어 있다.** 항로 뷰가 그 마지막 칸을 채운다. 게임 루프 매핑상 *보상/엔딩*이고, 트랙 ④ 누적 프로필의 씨앗이다.

## 2. 데이터 — 전부 존재 (신규 호출 0)

`ChunkMeta`(types/debate.ts:62)에 항로가 이미 다 있다:

```ts
interface ChunkMeta { id; sessionId; topic; nextTopics: NextTopicChoice[]; chosenNextLabel?; createdAt }
interface NextTopicChoice { label; hook; isBlindSpot }   // isBlindSpot = ✦ 못 본 각도, 배열당 1개
```

- store 셀렉터: **`useSessionsStore((s) => s.sessionChunks?.[id] ?? [])`** (addChunk/updateChunkChoice가 쓰는 그 필드. store/sessions.ts:316).
- 항로 = `sessionChunks`를 createdAt 순 정렬. 각 청크가 한 마디(topic)를 다루고, 끝에 `nextTopics` 갈림길을 제시했으며, 사용자가 `chosenNextLabel`을 골랐다.
- 청크 N+1의 `topic`은 청크 N의 `chosenNextLabel`과 사실상 같다(chooseTopic이 label을 다음 topic으로 넘김). **각 청크는 자족적으로 렌더** — 청크의 topic + 그 nextTopics + chosenNextLabel만 본다.

## 3. 작업 범위 (Sonnet)

### 3-A. `RouteView` 컴포넌트 신설

위치: `app/(main)/session/[id]/summary/page.tsx` 내부 로컬 함수(DecisionMapView·DividedCard 옆) 또는 `components/debate/RouteView.tsx`. 입력 props: `chunks: readonly ChunkMeta[]`, `concernTitle: string`.

세로 분기 트리(모바일 퍼스트):

```text
[고민]  session.title
  │
[장면 1]  topic ("_first" → "오프닝")
  ├─ 안 가본 길: {label}        ← 흐리게 (muted)
  ├─ ✦ {label} (못 본 각도)     ← isBlindSpot. 골랐으면 강조, 안 골랐으면 muted+"안 가본 각도"
  └─ ▶ {chosenNextLabel}        ← 선택한 길 강조 (primary)
  │
[장면 2]  topic = 직전 선택
  └─ …
  │
[결론]  (chosenNextLabel 없는 마지막 청크 = 여기서 결론으로)
```

규칙:
- 각 청크 노드: `topic` 칩(`_first` → "오프닝"; chunkLabel 패턴 = DebateFeed.tsx:316 재사용/복제). 그 아래 `nextTopics` 후보 나열.
- **선택한 후보**(label === chosenNextLabel): primary 강조 + ▶. **안 고른 후보**: muted "안 가본 길".
- **✦ isBlindSpot 후보**: accent 마커(✦). 골랐으면 "못 본 각도를 택함"(히든 루트 달성 톤), 안 골랐으면 muted + 다음 세션 훅으로 `hook` 한 줄 노출("안 가본 각도: {hook}").
- **직접 입력**(chosenNextLabel이 nextTopics에 없음): "직접 입력한 길" 표시.
- **마지막 청크**(chosenNextLabel undefined): "여기서 결론" 노드로 닫고 결정 지도로 연결되는 느낌.
- 시각 위계: 선택한 길 > ✦ > 안 가본 길. ✦ 마커는 ⑤-5b 결정 무게 톤 재사용(신규 모션 금지).

### 3-B. summary 페이지 삽입

- `summary/page.tsx`에 chunks 셀렉터 추가(§2). `isV2 ? DecisionMapView : LegacyConclusionView`(:105~114) **위에** `RouteView`를 삽입 — 항로는 결론 버전(v1/v2) 무관하게 chunks만 있으면 표시.
- `chunks.length === 0`(옛 세션·청크 없음)이면 RouteView 렌더 생략 — 회귀 0.
- 섹션 제목 예: "내가 항해한 길" / 짧은 설명 "이번 회의에서 당신이 고른 갈림길들."

## 4. 비범위

- 신규 위젯·게임화 연출(컷신·게이지) 금지 — 정적 트리 렌더.
- 다음 세션 자동 시작/딥링크는 트랙 ④(거울)에서. 여기선 ✦ 안 가본 각도의 hook을 *텍스트로 노출*만.
- LLM 호출·스키마 변경 0.

## 5. 합격선

| 지표 | 합격선 |
| --- | --- |
| 종료 화면에서 항로 확인 | summary 진입 즉시(스크롤 내) — 0~1탭 |
| 항로 정확성 | concern → 각 청크 topic → 선택 → 결론, sessionChunks 순서 그대로 |
| 선택/안 가본 길/✦ 구분 | 시각적으로 3단 구분 |
| 직접입력·마지막 청크 엣지 | 깨지지 않음("직접 입력한 길"·"여기서 결론") |
| 회귀 | 결정 지도(v2)·레거시(v1)·청크 0개 세션 무영향 |

## 6. 검증

- **시각(운영자)**: 갈림길 2~3회 탄 세션 종료 → 항로가 실제 선택과 일치, ✦ 고른/안 고른 표시 정확, 모바일 폭에서 트리 안 깨짐.
- **기계**: typecheck/lint/build. chunks 0개·undefined 가드. 직접입력 세션 1개.

## 7. 출하 — PR 1개 (Sonnet)

`route-view-R3prime` 단독. 데이터 무변경이라 다른 트랙과 충돌 없음. 언어락·R-2 머지와 독립.

> 시너지 메모: R-2 §G의 user-choice 카드(피드 내)와 항로 뷰(요약 내)는 같은 선택을 두 곳에서 보여주는 보완 관계 — 항로는 ChunkMeta를 단일 진실원으로 쓴다(메시지 카드 아님).
