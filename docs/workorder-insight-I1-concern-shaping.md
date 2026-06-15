# 작업 의뢰서 — 트랙 I-1: AI 가이드 고민 다듬기

> 담당: Claude Code (Sonnet) — 구현
> 작성: Fable (설계 + 부록 A 역질문 프롬프트 박제)
> 검수: Opus (PR 검수) / 운영자 (입력 흐름 체감 + 토론 품질 전후 비교)
> 대상 레포: `council/`
> 선행 문서: `meeting-2026-06-10-content-pivot.md` §3 I-1, 로드맵 "개선 2b 고민 다듬기"
> 선행 상태: P-A·R-1·R-2a·R-1.5a 출하. **R-1.5b′와 병행 가능** — 본 워크오더는 `session/new` 입구만 건드린다(토론 화면 불가침).

---

## 0. 한 줄 목표

빈 1000자 텍스트박스를, AI가 날카로운 역질문 2~3개로 고민을 캐내는 **대화형 입구**로 바꾼다. 입력 품질이 토론 품질을 좌우한다 — 가장 앞단의 인사이트 지렛대.

## 1. 배경 — 진단

현재 `ConcernInput`은 자유 텍스트 최소 20자. 사용자가 "무엇을 결정해야 하는지, 왜 망설이는지, 무엇을 시도했는지"를 *스스로 정리해* 쏟아내야 한다. 두 가지 실패:

- **인지부하** — 빈 화면 앞에서 자기 고민을 구조화하는 건 어렵다. 많은 사용자가 한두 문장만 적고 만다 → `designPanel` 입력이 얕다 → 패널이 일반론으로 흐른다.
- **자각 부재** — 운영자 지적: "사용자가 스스로 뭘 고민하는지도 판단하기 어렵다." 진짜 결정 지점이 입력에 안 담기면 토론이 엉뚱한 곳을 판다.

전환: 한 줄만 받아도 AI가 **되묻는다**. 굴복 금지 톤의 역질문이 사용자가 안 적은 맥락(제약·기한·시도·진짜 두려움)을 끌어낸다. 답하는 과정에서 concern이 저절로 풍부해지고, 사용자도 자기 고민을 자각한다.

## 2. 절대 원칙

1. **토론 화면 불가침** — `hooks/useDebate.ts`, `components/debate/**` 수정 금지. 범위는 `session/new` + `lib/prompts/recommender`(또는 신규 `lib/prompts/concern-shaping.ts`) + `lib/ai/client`.
2. **역질문 프롬프트 원문 박제** — 부록 A는 Fable 박제 원문. Sonnet 수정 금지. 이 프롬프트 품질이 입력 품질을, 입력 품질이 토론 품질을 결정한다.
3. **스킵 가능** — 다듬기는 *강제가 아니다*. "바로 시작" 경로를 항상 남긴다(긴 고민을 이미 적은 사용자, 급한 사용자). 운영자 선택은 "AI 가이드 대화형"이되, 스킵은 UX 안전장치.
4. **무료 LLM 1호출** — 역질문 생성은 가벼운 generateObject 1회. 답변 후 concern 합성은 *LLM 없이* 템플릿 결합(토큰 절약). 답변을 다시 LLM에 넣어 재작성하지 않는다 — 사용자 언어를 보존.
5. **굴복 금지 톤 계승** — 역질문은 안심·격려가 아니라 *찌르는* 질문. "좋은 고민이네요" 금지. BASE_PROMPT 정신 계승.

## 3. 작업 범위

### A. 역질문 생성 — `lib/prompts/concern-shaping.ts` (신규)

- `clarifyQuestionsSchema` (zod): `{ questions: { key: string; question: string; why: string; placeholder: string }[] }` — 2~3개. `key`는 슬롯 식별자(`decision`/`tried`/`constraint` 등 자유), `why`는 "왜 이걸 묻는지" 한 줄(사용자에게 보여 신뢰 형성), `placeholder`는 답변 입력 힌트.
- `buildClarifyPrompt(rawConcern: string): string` — 부록 A 원문.

### B. 호출 함수 — `lib/ai/client.ts`

- `clarifyConcern(args: { provider; apiKey; concern })`: generateObject(`clarifyQuestionsSchema`), temperature `TEMPERATURE.recommend`(0.45 — 질문은 안정적이어야), maxRetries 1, maxTokens ~600. 실패 시 AiCallError throw (호출자가 스킵으로 폴백 가능).

### C. concern 합성 — `lib/prompts/concern-shaping.ts`

- `composeConcern(raw: string, answers: { question: string; answer: string }[]): string` — **LLM 없이** 결합:

```ts
export function composeConcern(raw, answers) {
  const filled = answers.filter((a) => a.answer.trim());
  if (filled.length === 0) return raw.trim();
  const block = filled.map((a) => `· ${a.question}\n  → ${a.answer.trim()}`).join('\n');
  return `${raw.trim()}\n\n[다듬기 — 사회자 질문에 대한 답]\n${block}`;
}
```

이 합성본이 `designPanel`·세션 `concern`으로 들어간다. 사용자 원문이 맨 앞에 보존되고, 답변이 구조화 블록으로 덧붙는다.

### D. UX 흐름 — `session/new` + `ConcernInput` 확장

신규 step 추가: `input → clarifying → analyzing → picking`.

- **input 단계** (`ConcernInput` 수정):
  - 최소 글자 가드 20 → **8자**로 완화 (한 줄로 시작 가능). placeholder를 "한 줄로 시작해도 됩니다 — AI가 되물어 함께 다듬습니다"로.
  - 버튼 2개: **"AI와 다듬기"**(주 버튼 → clarifying) / **"바로 시작"**(보조 → analyzing 직행, 현행 동작). 원칙 3.
- **clarifying 단계** (신규 `ConcernClarify.tsx`):
  - 진입 시 `clarifyConcern` 호출 → 역질문 2~3개. 로딩 중 "사회자가 질문을 고르는 중…".
  - 각 질문을 카드로: 질문 + `why`(작게, 신뢰용) + 답변 textarea(placeholder). 답변은 *선택* — 빈 칸 허용(원칙 3, 모르면 건너뜀).
  - 하단: **"이대로 토론 시작"** → `composeConcern` → analyzing. **"질문 없이 진행"**(스킵) → raw concern으로 analyzing.
  - `clarifyConcern` 실패 시 toast + 자동으로 analyzing 폴백(다듬기 없이) — 입구가 막히면 안 된다.
- **analyzing/picking**: 현행 유지. 입력만 `composeConcern` 결과로 교체.

### E. 세션 저장

- `createSession`에 들어가는 concern = `composeConcern` 결과(다듬기 시) 또는 raw(스킵 시). 세션 화면 헤더·`buildChunkPrompt`·결론이 전부 이 풍부해진 concern을 받는다 — 별도 작업 없이 품질 상승이 파이프 전체로 전파.

## 4. 출하 단위 — PR 1개

작은 트랙. A~E 한 PR. 단 §A 프롬프트 본문은 부록 A 그대로.

## 5. 검증

### 합격 지표

| 지표 | 합격선 |
| --- | --- |
| 한 줄(예: "유료 전환할지 고민") 입력 → 역질문 품질 | 3개 모두 *이 고민에만* 들어맞음(일반론 0) |
| 다듬기 후 concern 길이·구체성 | raw 대비 결정지점·제약·시도 중 2+ 추가 |
| 스킵 경로 | "바로 시작"·"질문 없이 진행" 모두 작동 |
| 역질문 호출 실패 | analyzing 자동 폴백 — 입구 안 막힘 |
| 토론 품질 전후 (동일 raw 한 줄) | 다듬기 경유 토론이 raw 직행보다 구체적(운영자 판정) |

### 측정 (운영자)

표준 raw 한 줄 3개로 (a) 바로 시작 (b) AI 다듬기 경유 각각 첫 청크 생성 → 발언 구체성 비교. 다듬기 경유가 이겨야 트랙 성립.

### 기계 검증

- typecheck / lint / build. `clarifyConcern` 실패 시 폴백 경로 단위 확인.

---

## 부록 A — 역질문 생성 프롬프트 (원문 박제)

### A-1. `buildClarifyPrompt` 본문

```text
당신은 COUNCIL의 사회자입니다. 사용자가 전문가 패널 토론에 들고 온 고민이
아직 한두 줄로 짧습니다. 패널이 *날카롭게* 토론하려면 맥락이 더 필요합니다.

당신의 일은 답을 주는 것이 아니라, *되묻는* 것입니다. 사용자가 아직 말하지
않았지만 결정에 결정적인 것들을 끌어내는 질문 2~3개를 만드세요.

[사용자가 들고 온 한 줄]
{rawConcern}

[질문 설계 규칙]
1. 이 고민에만 들어맞는 질문. "목표가 무엇인가요?" 같은 아무 고민에나 붙는
   질문은 금지. 위 문장에서 *빠진 구체적 정보*를 집어 묻는다.
2. 다음 중 빠진 것을 우선해 묻는다:
   - 진짜 결정 지점 — 사용자가 "A냐 B냐"로 적었지만 실은 C가 진짜 분기일 때.
   - 제약·기한 — 언제까지, 돈·사람·시간의 한계.
   - 이미 시도/관찰한 것 — 어떤 반응, 어떤 데이터를 이미 봤는가.
   - 망설임의 진짜 이유 — 표면 이유 뒤의 두려움·매몰비용.
3. 굴복 금지 톤. "좋은 고민이네요" 같은 추임새 금지. 질문은 정중하되 *찌른다*.
   사용자가 피하고 있던 곳을 정확히 묻는다.
4. 각 질문에 why 한 줄 — "왜 이걸 묻는지". 사용자가 질문의 의도를 알면 더
   정직하게 답한다. why 도 일반론 금지.
5. placeholder — 답변 입력칸에 띄울 힌트. 답변의 *형식*을 보여주는 짧은 예시.

[좋은 예 — raw: "사이드 프로젝트를 유료로 전환할지 고민"]
- question: "지금 무료로 쓰는 사람이 몇 명이고, 그중 돈 낼 것 같은 사람은 몇 명인가요?"
  why: "전환 결정은 '얼마나 많은가'가 아니라 '얼마나 절실한가'에서 갈립니다."
  placeholder: "예) 무료 300명, 그중 '유료여도 쓴다'고 한 사람 5명"
- question: "유료로 바꾼 뒤 무료 사용자가 떠나면, 그게 당신에게 어떤 손해인가요?"
  why: "이탈을 감당할 수 있는지가 전환 시점을 정합니다."
  placeholder: "예) 입소문이 끊긴다 / 별 영향 없다 / 잘 모르겠다"

[나쁜 예 — 일반론이라 금지]
- "비즈니스 목표가 무엇인가요?"   ← 아무 고민에나 붙음
- "리스크는 무엇인가요?"          ← 사용자가 답을 모름, 그게 토론거리
- "예산은 얼마인가요?"            ← 위 문장과 무관할 수 있음

[출력]
스키마의 JSON. 질문 2~3개. 사용자의 한 줄이 이미 충분히 구체적이면 2개,
맥락이 거의 없으면 3개.
```

### A-2. 합성 결과 형태 (composeConcern 출력 예)

```text
사이드 프로젝트를 유료로 전환할지 고민

[다듬기 — 사회자 질문에 대한 답]
· 지금 무료로 쓰는 사람이 몇 명이고, 그중 돈 낼 것 같은 사람은 몇 명인가요?
  → 무료 300명, '유료여도 쓴다'고 한 사람 5명
· 유료로 바꾼 뒤 무료 사용자가 떠나면, 그게 당신에게 어떤 손해인가요?
  → 입소문이 끊길까 봐 무섭다
```

이 형태가 `designPanel`과 세션 concern으로 흐른다 — 원문 보존 + 구조화 답변.
