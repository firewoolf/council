# 작업 의뢰서 — 트랙 I-2: 토론 중 인사이트 마킹 (핀)

> 담당: Claude Code (Sonnet) — 구현
> 작성: Fable (설계)
> 검수: Opus (PR 검수) / 운영자 (핀 흐름 체감 + 결론 반영 확인)
> 대상 레포: `council/`
> 선행 문서: `meeting-2026-06-10-content-pivot.md` §3 I-2, 로드맵 트랙 ② "발언 핀 → 결론을 핀에서 빌드"
> 선행 상태: I-1·R-1.5b′ 출하 후 착수 권장(병행 시 store 충돌만 주의). **I-3와 데이터 계약을 공유** — 핀 구조가 I-3 결론 입력이 된다.

---

## 0. 한 줄 목표

토론 중 사용자가 "이건 중요하다" 싶은 발언을 **핀(저장)**하고, 그 핀이 결론(I-3)의 1순위 입력이 된다. 지나가는 통찰을 사용자가 직접 붙잡는다 — 인사이트의 능동화.

## 1. 배경

스트리밍 토론은 빠르게 지나간다. 사용자가 "방금 그 말이 핵심인데" 싶어도 흘러가 버리고, 결론은 AI가 전체 transcript에서 *알아서* 추린다 — 사용자의 판단이 결론에 반영될 통로가 없다. 핀은 그 통로다: ① 사용자가 중요하다고 *선언*한 발언이 결론 생성의 가중 입력이 되고, ② 핀 목록 자체가 "내가 이 토론에서 건진 것"이라는 산출물이 된다.

게임 루프의 "선택의 기록"을 인사이트 쪽으로 흡수한 형태 — 항로 뷰(R-3′)가 *방향 선택*의 기록이라면, 핀은 *통찰 포착*의 기록이다.

## 2. 절대 원칙

1. **재생 엔진 불가침** — `useDebate`의 스트림·큐·phase 머신 무수정. 핀은 store 액션 + 메시지 메타 1필드 추가로 끝낸다.
2. **LLM 호출 0** — 핀은 순수 상호작용. 토큰을 쓰지 않는다.
3. **I-3 계약 고정** — 핀 데이터 형태(§3-A)는 I-3가 소비한다. 이 워크오더가 그 형태의 단일 진실원. 변경 시 I-3 워크오더도 갱신.
4. **마이그레이션 무중단** — 기존 세션(핀 없음)은 그대로 동작. persist version 올릴 필요 없음(가산 필드는 옵셔널).

## 3. 작업 범위

### A. 데이터 — 핀 상태

핀은 메시지에 박지 않고 **세션별 핀 집합**으로 분리 저장한다(메시지는 불변 유지, 핀은 토글되는 사용자 상태라 분리가 깔끔):

- `types/debate.ts`: 신규
```ts
export interface Pin {
  messageId: string;
  sessionId: string;
  /** 선택 — 사용자가 핀에 단 한 줄 메모 ("이게 진짜 리스크") */
  note?: string;
  createdAt: string; // ISO
}
```
- `store/sessions.ts`:
  - state `pins: Record<string /*sessionId*/, Pin[]>` (초기값 `{}`).
  - `togglePin(sessionId, messageId)` — 있으면 제거, 없으면 추가(note 없이).
  - `setPinNote(sessionId, messageId, note)` — 핀에 메모 결합(핀 없으면 무시).
  - `getPins(sessionId): Pin[]`.
  - `deleteSession`이 `pins[id]`도 정리.
  - persist: `pins`를 partialize에 포함. version 유지(가산이라 기존 hydrate 안전 — `pins` 누락 시 effect/selector에서 `?? []`).

### B. UI — 카드 핀 토글

- `MessageCard`: 페르소나 발언 카드에 핀 버튼 추가(아이콘 `Pin`/`PinOff` lucide). 위치는 기존 디렉션 ⋯ 버튼 옆 또는 카드 하단 액션 줄. 핀 상태면 채워진 아이콘 + accent.
  - 사용자 발언(speakerId null)·intro 카드는 핀 대상 아님.
  - props: `isPinned: boolean`, `onTogglePin: (messageId) => void`. DebateFeed가 store에서 핀 집합을 받아 카드별로 내려준다.
- 핀 클릭 → `togglePin` + 가벼운 사운드(`playSound('confirm')` 재사용, mute 존중) + `toast` 없이 즉각 시각 피드백만(빠른 토론 흐름 방해 금지).
- 메모는 1차 범위에서 **선택 기능** — 핀 길게 누르거나(모바일) 핀된 카드의 작은 "메모 추가" 인라인. 구현 부담되면 메모는 §D 핀 보드에서만 편집 가능으로 미뤄도 됨(스키마는 지금 넣어둔다).

### C. DebateFeed·페이지 배선

- `DebateFeed`에 `pinnedIds: Set<string>` + `onTogglePin` props. 카드 렌더 시 `pinnedIds.has(m.id)` 전달.
- 세션 페이지: `useSessionsStore`에서 `pins[id]` 구독 → `Set` 파생 → DebateFeed에 전달. `togglePin` 액션 연결. (useState 증가 금지 — 스토어 구독만.)

### D. 핀 보드 — "내가 건진 것"

- `components/debate/PinBoard.tsx` (신규, 소형): 현재 세션의 핀 목록을 모아 보여주는 패널.
  - 각 핀: 발언자 아바타·이름 + 발언 본문 + (있으면) 메모 + 핀 해제 버튼 + 메모 편집.
  - 빈 상태: "중요한 발언에 핀을 꽂아보세요. 결론을 만들 때 우선 반영됩니다."
  - 배치: **웹** 디렉터 콘솔(R-1.5b′) 안에 탭/섹션으로(갈림길·발언작성 옆 ③ 자리 근처) — 콘솔에 "핀 N" 섹션 추가. **모바일** 입력바 위 "핀 N ▲" 칩 → bottom sheet(SteeringSheet 패턴 재사용).
  - 핀 개수 뱃지는 컨트롤/콘솔 헤더에 상시 노출(사용자가 몇 개 건졌는지 자각).

### E. 결론 입력 연결 (I-3 핸드오프 지점만)

- 본 워크오더에서는 **데이터만 준비**. `generateConclusion` 호출부(`useDebate`)가 핀을 인자로 받을 수 있게 통로만 연다:
  - `getPins(sessionId)` → 핀된 메시지 본문 배열을 `generateConclusion` args에 `pinnedMessages?: Message[]`로 추가(옵셔널, 미사용 시 현행).
  - 프롬프트에서의 *활용*은 I-3 범위 — 여기서는 args 전달까지만. (I-2 단독 출하 시 핀은 보드까지만 작동, 결론 반영은 I-3 출하 후.)

## 4. 출하 단위 — PR 1개

A~E 한 PR. §E는 통로만(프롬프트 변경 없음).

## 5. 검증

### 합격 지표

| 지표 | 합격선 |
| --- | --- |
| 토론 중 핀 토글 | 재생 흐름 끊김 없이 즉각 반영 |
| 핀 영속 | 새로고침·세션 재진입 후 핀 유지 |
| 핀 보드 | 웹 콘솔 / 모바일 시트에서 핀 목록·해제·메모 |
| 기존 세션(핀 없음) | 회귀 0, 핀 버튼 정상 노출 |
| I-3 통로 | `generateConclusion`이 핀 인자 받는 시그니처 |

### 기계 검증
- typecheck / lint / build. `togglePin` persist 왕복 확인.

## 6. I-3 핸드오프 메모

I-3는 `pinnedMessages`를 결론 프롬프트에서 "사용자가 직접 중요하다고 표시한 발언 — consensus/divided/openQuestions 추출 시 우선 가중"으로 쓴다. 핀이 0개면 현행 전체 transcript 기반. 핀 본문 + note(있으면)를 함께 넘긴다 — note는 "사용자가 왜 중요하다 봤는지"라 결론 정밀도에 직접 기여.
