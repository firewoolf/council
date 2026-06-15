# 작업 의뢰서 — 트랙 I-3: 결정 지도 심화 (핀·근거 추적)

> 담당: Claude Code (Sonnet) — 구현
> 작성: Fable (설계 + 부록 A 결론 프롬프트 재박제)
> 검수: Opus (PR 검수) / 운영자 (결론 정밀도 전후 비교)
> 대상 레포: `council/`
> 선행 문서: `meeting-2026-06-10-content-pivot.md` §3 I-3, `workorder-insight-I2-pin.md` §6, `workorder-debate-2-decision-map.md`(출하분)
> 선행 상태: **I-1·I-2 출하 후 착수** — 핀(I-2) 데이터와 풍부해진 concern(I-1)을 입력으로 받는다. 둘 없이도 동작(현행 폴백)하나, 효과는 둘 위에서 나온다.

---

## 0. 한 줄 목표

결정 지도(트랙 ②)를 한 단계 정밀화한다 — 사용자가 핀한 발언을 우선 가중하고, "끝내 갈린 것" 각 입장에 **근거 발언**을 매달아 추적 가능하게. 결론이 "AI가 요약한 판결"에서 "내가 건진 것 + 근거가 보이는 분기 지도"로.

## 1. 배경

트랙 ②(consensus/divided/openQuestions)는 출하됐고 방향이 옳다. 두 가지가 빈다:

- **사용자 판단 미반영** — 결론은 전체 transcript에서 AI가 알아서 추린다. I-2 핀으로 사용자가 "이게 중요"라 표시했는데 결론이 그걸 모른다.
- **근거 단절** — `divided.positions`는 "어느 멤버가 어느 쪽"까지만 안다. *어느 발언이* 그 입장의 근거였는지 연결이 없어, 사용자가 "왜 갈렸지?"를 다시 토론에서 찾아야 한다. 인사이트는 결론과 근거가 한눈에 이어질 때 산다.

## 2. 절대 원칙

1. **하위호환 불변** — v1(옛 4섹션)·v2(현 3분류) 기존 세션 결론은 옛 UI 그대로(회귀 0). 신규 결론만 v2.1.
2. **결론 프롬프트 원문 박제** — 부록 A는 Fable 박제. 굴복 금지·강제 수렴 금지 가드 유지. Sonnet 수정 금지.
3. **핀 없으면 현행** — `pinnedMessages` 0개면 전체 transcript 기반(I-2 미출하 환경 안전).
4. **근거는 기존 messageId 참조** — 새 본문 생성 금지. `divided.positions[].evidenceMessageIds`는 transcript에 실재하는 id만(환각 차단은 sanitize에서).

## 3. 작업 범위

### A. 스키마 — v2.1 (근거 추적)

`lib/prompts/orchestrator.ts` `conclusionSchema`:

- `divided[].positions[]`에 `evidenceMessageIds: z.array(z.string())` 추가 — 이 입장을 뒷받침한 발언 id(0~3개). describe: "이 입장의 근거가 된 발언 id. [전체 토론 내용]에 붙은 (id:xxx) 에서 가져온다. 없으면 빈 배열."
- `Conclusion` 인터페이스에 동일 옵셔널 필드. (v2 기존 결론은 이 필드 없음 → 옵셔널이라 안전.)
- 판별: v2.1은 별도 플래그 불요 — `evidenceMessageIds` 유무로 자연 분기. UI는 있으면 근거 칩 렌더, 없으면 현행.

### B. 결론 호출 — 핀 입력

`lib/ai/client.ts` `generateConclusion` args에 `pinnedMessages?: readonly Message[]` 추가(I-2 §E가 통로는 이미 열어둠). `buildConclusionPrompt(concern, messages, cast, pinnedMessages)`로 전달.

### C. 프롬프트 — 부록 A 적용

`buildConclusionPrompt`를 부록 A 원문으로 교체:
- `[전체 토론 내용]`의 각 발언에 `(id:메시지id)` 부착(현재 cast id만 붙음 → message id로 변경, 근거 참조용).
- 핀 블록 신설(핀 있을 때만): `[사용자가 직접 표시한 핵심 발언]` + 본문·메모.
- divided 추출 시 근거 id 채우기 지시 + 핀 우선 가중 지시.

### D. sanitize — 근거 id 무결성

`generateConclusion` 결과 후처리(신규 `sanitizeConclusion` 또는 client 내 인라인):
- `evidenceMessageIds`에서 transcript에 없는 id 드롭(환각 차단).
- `divided.positions[].memberIds`도 cast에 없는 id 드롭(기존 가드 있으면 재사용).
- 빈 배열·누락은 허용(근거 못 찾은 분기 = 정상).

### E. UI — summary 근거 칩

`app/(main)/session/[id]/summary/page.tsx` v2 렌더(divided 카드):
- 각 position에 `evidenceMessageIds`가 있으면 근거 칩 — 발언자 아바타 + 본문 프리뷰(24자) 칩. 탭 → 해당 발언 펼침/스크롤(또는 모달 프리뷰). messages를 id로 조회.
- 핀이 결론에 반영됐음을 알리는 미세 신호: 핀된 발언이 근거로 쓰였으면 칩에 핀 아이콘.
- 근거 없는 position은 현행 그대로(칩 영역 생략).

## 4. 출하 단위 — PR 1개

A~E 한 PR. 스키마·프롬프트·UI가 한 흐름.

## 5. 검증

### 합격 지표

| 지표 | 합격선 |
| --- | --- |
| 핀 가중 | 핀한 발언의 논점이 divided/openQuestions에 반영(운영자 판정) |
| 근거 추적 | divided 각 입장에 실재 발언 근거 칩(환각 id 0) |
| 강제 수렴 금지 유지 | divided ≥1, 합의 위장 0 (트랙 ② 가드 계승) |
| 하위호환 | 기존 v1·v2 세션 결론 UI 회귀 0 |
| 핀 0개 | 전체 transcript 기반 현행 동작 |

### 측정 (운영자)
동일 토론으로 (a) 핀 없이 (b) 핵심 3발언 핀 후 결론 생성 → divided·openQuestions가 핀 쪽으로 더 정밀해지는지 비교.

### 기계 검증
- typecheck / lint / build. 환각 evidence id 드롭 단위 확인.

---

## 부록 A — 결론 프롬프트 v2.1 (원문 박제)

> 트랙 ② 부록 A를 계승·확장. 굴복 금지·강제 수렴 금지 가드 유지. 추가분: message id 부착, 핀 블록, 근거 추적 지시.

### A-1. `buildConclusionPrompt` 시그니처·본문

```ts
export function buildConclusionPrompt(
  concern: string,
  messages: readonly Message[],
  cast: readonly CastMember[],
  pinnedMessages: readonly Message[] = [],
): string
```

- `[전체 토론 내용]` 라인 포맷: `[이름 (id:메시지id)] 본문` — 페르소나 발언만 id 부착(사용자/intro 발언은 근거 대상 아님이나 표시는 유지). memberDirectory(멤버 id↔이름)는 현행 유지.
- 핀 블록 (pinnedMessages.length > 0일 때만 본문에 삽입):

```text
[사용자가 직접 표시한 핵심 발언 — 결론에서 우선 가중]
${pinnedMessages.map(m => `(id:${m.id}) [${name}] ${m.content}${note?` — 사용자 메모: ${note}`:''}`).join('\n')}
사용자가 이 발언들을 *직접* 중요하다고 표시했다. consensus·divided·openQuestions
를 뽑을 때 이 발언들이 가리키는 논점을 우선 반영하라. 단, 핀이 곧 정답은
아니다 — 핀된 주장이 토론에서 반박당했다면 그 갈림을 divided 에 박제하라.
```

- 작업 지시에 근거 추적 추가:

```text
[근거 추적 — divided 각 입장]
divided 의 각 position 에 evidenceMessageIds 를 채운다 — 그 입장을 뒷받침한
발언의 (id:xxx) 를 [전체 토론 내용]에서 골라 0~3개. 실재하는 id 만. 근거가
명확한 발언이 없으면 빈 배열. *지어내지 마라* — 없는 id 를 채우면 추적이 거짓이
된다.
```

- 기존 금지 사항(강제 수렴·일반론·굴복·입장 1개 divided) 블록 그대로 유지.

### A-2. 핀-divided 상호작용 규칙 (본문에 포함)

```text
[핀과 갈림의 관계]
- 핀된 발언이 합의 영역이면 → consensus 로.
- 핀된 발언이 반박당했으면 → 그 충돌을 divided 로 박제하고, 핀 발언을 한 입장의
  근거로 단다. "사용자가 중요하다고 본 것이 사실은 갈린 지점이었다" 는 가장 값진
  인사이트다 — 숨기지 마라.
```
