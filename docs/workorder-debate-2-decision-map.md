# 작업 의뢰서 — 트랙 ②: 결정 지도형 결론

> 담당: Claude Code (Sonnet)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `roadmap.md` 트랙 ②, `workorder-debate-5-1-chunk-engine.md` (출하 완료), `example-target-discussion.md` (gold standard — §2 결론 단편)
> 선행 상태: 트랙 ⑤ 1/2 완료, ⑤-5a-1 완료, 트랙 ③-a 완료, Phase E 완료. 현재 결론은 4섹션 *판결문* 형식 — 강제 수렴이 인사이트를 죽인다.

---

## 0. 한 줄 목표

결론을 **AI 가 내려준 판결문** 에서 **사용자가 직접 결정할 수 있는 *지도*** 로 재설계한다. **충돌을 보존** 하는 게 가장 큰 가치.

---

## 1. 배경 — 강제 수렴이 인사이트를 죽인다

`roadmap.md` 트랙 ②: *"현재 결론(4섹션 요약)은 사실상 '판결'. 강제 수렴이 인사이트를 죽인다."*

현재 4섹션:
1. 핵심 결론 (강제 수렴된 한 줄)
2. 주요 리스크 3
3. 페르소나별 입장
4. 추천 액션 3

문제:
- *AI 가 정답을 내려줌* → ChatGPT 와 결과물 차별 없음.
- *충돌이 평탄화* → 패널이 끝내 못 합의한 *진짜 가치 있는 지점* 이 사라짐.
- *"패널 N명 → 한 결론"* 으로 압축돼 *사용자의 결정* 이 없음. 잡스: "결정 도구지 답변 도구가 아니다."

트랙 ② 의 진단: **충돌이 결론에 보존돼야 한다.** 그 충돌이 *사용자가 직접 결정해야 할 트레이드오프* 다.

---

## 2. 신규 결론 모델 — 3 분류 지도

```
✓ 합의된 것 (consensus)
  ─────────
  · 패널 N명이 *공통적으로 짚은* 사실/제약
  · 사용자가 *전제로 깔아도 안전* 한 것

⚡ 끝내 갈린 것 (divided)  ★ 가장 값짐
  ─────────
  · 패널이 *마지막까지* 못 합의한 핵심 분기
  · 각 분기점마다 *어느 멤버가 어느 쪽* 인지 명시
  · 사용자가 *직접 결정해야 할* 트레이드오프

❓ 당신이 답해야 할 질문 (openQuestions)
  ─────────
  · 패널이 사용자에게 *되돌려준* 질문
  · 답에 따라 결론이 바뀌는 *분기 조건*
```

이 3분류는 `example-target-discussion.md` §2 의 청크 결론 단편 (`합의된_것 / 갈린_것 / 당신이_답해야_할_질문`) 과 *형식 통일*. 이미 청크 엔진의 부산물로 *재료가 모이고 있음* — 트랙 ② = 그 재료를 *결론 화면에 정식 박제*.

---

## 3. 절대 원칙

1. **충돌을 *압축하지 마라*** — 갈린 지점을 *합의된 척* 포장하면 트랙 ② 본질 깨짐. `buildConclusionPrompt` 의 가드가 강제.
2. **굴복 금지 불변** — `BASE_PROMPT` 그대로. 결론도 *사용자에게 맞춰주는* 안전 모드 금지.
3. **마이그레이션 무중단** — 옛 conclusion (`keyConclusion / risks / personaPositions / recommendedActions`) 을 가진 세션은 *옛 UI* 로 정상 렌더. 새 conclusion 만 *결정 지도* 형식. zustand persist version 안 올림.
4. **공유 기능은 ②-b 로 분리** — 1차 (②-a) 는 결론 재설계 + UI 만. 공유 링크·마크다운 export 는 후속.
5. **트랙 ①·⑤·③·Phase E 회귀 금지** — picking·청크 재생·디렉션·StageStrip 모두 그대로.

---

## 4. 작업 범위 — A~E

### A. 데이터 모델 (`types/debate.ts` 또는 `lib/prompts/orchestrator.ts`)

기존 `Conclusion` 타입에 *새 필드 옵셔널 추가*. 옛 필드도 그대로 유지 (마이그레이션 무중단).

```ts
// 새 모델 — v2 결정 지도
export interface DividedPoint {
  /** 갈린 지점의 주제 한 줄 */
  topic: string;
  /** 각 입장 — 어느 멤버가 어느 쪽인지 */
  positions: { side: string; memberIds: string[] }[];
}

export interface Conclusion {
  // v1 (옛 — 기존 세션 호환을 위해 유지)
  keyConclusion?: string;
  risks?: string[];
  personaPositions?: { personaId: string; position: string }[];
  recommendedActions?: string[];

  // v2 (트랙 ②) — 새 결론 생성 시 채워짐
  consensus?: string[];
  divided?: DividedPoint[];
  openQuestions?: string[];
}
```

**판별 규칙:** `conclusion.consensus !== undefined` 이면 v2 (결정 지도), 아니면 v1 (옛 4섹션).

### B. `conclusionSchema` 재설계 (`lib/prompts/orchestrator.ts`)

기존 schema 를 *완전 교체* (생성은 v2 만, 렌더는 v1/v2 둘 다).

```ts
export const conclusionSchema = z.object({
  consensus: z
    .array(z.string())
    .min(2)
    .max(6)
    .describe('패널이 *공통적으로* 짚은 사실·제약. 사용자가 전제로 깔아도 안전한 것.'),
  divided: z
    .array(
      z.object({
        topic: z.string().describe('갈린 지점 한 줄. *합의된 척 포장 금지*.'),
        positions: z
          .array(
            z.object({
              side: z.string().describe('이 쪽 입장 한 줄'),
              memberIds: z.array(z.string()).describe('이 입장의 멤버 id 들'),
            }),
          )
          .min(2)
          .max(4)
          .describe('각 갈린 지점은 최소 2개 입장으로 분리. 합의로 위장 금지.'),
      }),
    )
    .min(1)
    .max(4)
    .describe(
      '★ 가장 값진 영역. 패널이 끝내 못 합의한 핵심 분기. ' +
        '강제 수렴 금지 — 갈렸으면 갈렸다고 박제. 사용자가 직접 결정할 재료.',
    ),
  openQuestions: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe('패널이 사용자에게 되돌린 질문. 답에 따라 결론이 바뀌는 분기 조건.'),
});

export type Conclusion = z.infer<typeof conclusionSchema>;
```

타입 export 충돌 처리 — 위 인터페이스 정의를 *interface 형태* 로 두고 zod 타입과 *호환되게 (옛 필드 옵셔널)* 설계. 또는 별도 export: `ConclusionV1` / `ConclusionV2` union.

### C. `buildConclusionPrompt` 재작성 (`lib/prompts/orchestrator.ts`)

기존 *4섹션 판결* 프롬프트 폐기. 신규 *결정 지도* 프롬프트 — **충돌 보존 강제**. 부록 A 본문 그대로.

### D. `summary/page.tsx` UI 재구성

판별 분기:
- `conclusion.consensus !== undefined` → **v2 UI** (3 카드)
- 그 외 → **v1 UI** (기존 4섹션 — 코드 그대로 유지)

v2 UI 레이아웃:

```
[헤더]
  "결정 지도 — {session.title}"

[합의된 것]              ← 작게, 안정감 톤 (primary/10)
  ✓ 항목 N개 unordered list

[끝내 갈린 것]           ← ★ 가장 크게, 강조 톤 (accent/20)
  ⚡ 각 분기점 카드:
    {topic}
    ─────
    [입장 A] {side}     ── 멤버 칩 (orb + 이름)
    [입장 B] {side}     ── 멤버 칩
    (있다면 입장 C ...)

[당신이 답해야 할 질문]    ← 중간, 액션 톤 (primary/15)
  ❓ 질문 N개 ordered list

[푸터]
  [회의 다시 보기] [새 회의 시작]
  (②-b: [공유 링크] [마크다운 다운로드])
```

핵심:
- *끝내 갈린 것* 카드의 시각 가중치가 가장 큼 (배경 강조 + 큰 폰트).
- 각 갈림점에서 *멤버 식별* — `PersonaOrb` + 이름 칩. 사용자가 *누가 어느 쪽* 인지 즉시 인식.
- v1 conclusion 호환 — 옛 세션 열어도 깨지지 않음.

### E. 옛 conclusion 호환 가드

`useDebate` 의 `generateConclusion` 호출은 v2 schema 로 생성. 저장된 conclusion 은 *v1 또는 v2 둘 다 가능*. 렌더링 분기로 호환.

**옛 conclusion 의 personaPositions** 가 v2 의 *divided* 일부와 *겹칠 수 있음* — UI 에서 양쪽 안 보이게 분기 처리. v1 만 보거나 v2 만 보거나.

---

## 5. 영향 파일 맵

```
신규: 없음 (워크오더 ②-a 한정)

갱신:
  types/debate.ts (또는 orchestrator.ts)    Conclusion 타입 v1 옵셔널 + v2 신설
  lib/prompts/orchestrator.ts                conclusionSchema 재설계 + buildConclusionPrompt 본문 교체
  app/(main)/session/[id]/summary/page.tsx   v1/v2 분기 + v2 3카드 UI
  (선택) lib/utils.ts                        conclusionToMarkdown 헬퍼 (②-b 에서 사용)

총 3~4개 파일.
```

---

## 6. 손대지 말 것

- 청크 엔진·SteeringPanel·재생 엔진 (`useDebate` 의 `'concluding'` phase 자체) — 그대로. 결과물 schema 만 바뀜.
- `BASE_PROMPT`·`CHUNK_SYSTEM_PROMPT`·directive 8개 — 절대 금지.
- 자율 스크롤·StageStrip·DirectionMenu·WaitingMemoArea — 무관, 유지.
- v1 conclusion 데이터 자체 — 마이그레이션 안 함. 옛 세션은 옛 UI 그대로.
- 공유 기능·마크다운 export — ②-b 로 분리.

---

## 7. 검증 기준

### 7.1 자동 검증

- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` 통과.
- [ ] **옛 conclusion 호환** — v1 데이터 (keyConclusion 있고 consensus 없음) 가진 세션의 summary 페이지가 옛 4섹션 UI 로 정상 렌더.
- [ ] **새 conclusion 생성** — generateConclusion 호출 → v2 schema 통과 → consensus/divided/openQuestions 모두 채워짐.

### 7.2 사람 검증

- [ ] 회의 1번 → "결론 내기" → summary 에 **3 카드 (합의/갈림/질문)** 표시.
- [ ] **★ "끝내 갈린 것" 이 시각적으로 가장 큼** — 가장 값진 영역임을 즉시 인식.
- [ ] 각 갈림점에 *어느 멤버가 어느 쪽* 인지 orb + 이름으로 표시 — 누구 편인지 즉시 알아봄.
- [ ] **강제 수렴 안 됨** — divided 가 *최소 1개* 들어있음. 모두 합의로 압축되면 트랙 ② 본질 실패 → 프롬프트 강화.
- [ ] openQuestions 가 *교과서 질문* 이 아닌 *이 고민에만 들어맞는* 질문.
- [ ] 옛 세션 (B-1 시점 이전, v1 conclusion) 열어보면 옛 4섹션 그대로 — 회귀 0.

---

## 8. 출하 단위

### ②-a. 결정 지도 결론 재설계 (블로킹, 핵심)

§4-A~E. 데이터 모델 + 프롬프트 + UI 재구성. v1 호환 유지.

### ②-b. 공유 기능 (옵션, ②-a 출하 후)

- 마크다운 export (`conclusionToMarkdown` 헬퍼) + 클립보드 복사 버튼
- (옵션) `/share/[sessionId]` public 라우트 — 비밀 토큰 또는 익명 ID 기반. 인증 모드 정해야 함 (STEP 7 Auth 종속). 우선순위 ↓.

---

## 9. 완료 후

- `backlog.md` 트랙 ② → Done.
- 다음 트랙 결정 — ④ 거울 / ③-b long-press / ⑤-5b 인트로 컷신 중.
- v2 결정 지도가 누적되면 *분야별 갈림 패턴* 통계 가능 (텔레메트리 후속).

---

## 부록 A — `buildConclusionPrompt` 본문 (Opus 박제 — 임의 작성 금지)

```ts
export function buildConclusionPrompt(
  concern: string,
  messages: readonly Message[],
  cast: readonly CastMember[],
): string {
  const personaMap = Object.fromEntries(cast.map((m) => [m.id, m]));
  const fullHistory = messages
    .map((m) => {
      if (m.speakerId === null) return `[사용자] ${m.content}`;
      const persona = personaMap[m.speakerId];
      return `[${persona?.name ?? '???'} (id:${m.speakerId})] ${m.content}`;
    })
    .join('\n');

  // 멤버 id ↔ 이름 매핑을 명시 — divided.positions.memberIds 가 정확한 id 를 채우도록.
  const memberDirectory = cast
    .map((m) => `- id: "${m.id}" / 이름: "${m.name}"`)
    .join('\n');

  return `[원본 고민]
${concern}

[패널 명단 — divided.positions.memberIds 는 반드시 아래 id 사용]
${memberDirectory}

[전체 토론 내용]
${fullHistory}

[작업 — 결정 지도형 결론]
당신은 사회자입니다. 이 토론을 정리하되, *판결* 이 아니라 *결정 지도* 를 만듭니다.
사용자가 직접 결정할 수 있도록 *재료* 를 분류해 제시하세요.

세 가지 분류:

(1) consensus — *합의된 것*
   패널이 공통적으로 짚은 사실·제약. 누구도 반박하지 않은 지점.
   사용자가 *전제로 깔아도 안전한 것*.
   2~6개. 한 줄씩.

(2) divided — *끝내 갈린 것* ★ 가장 값진 영역
   패널이 마지막까지 못 합의한 핵심 분기.
   각 분기점마다 *어느 멤버가 어느 쪽인지* memberIds 로 명시.
   1~4개. *합의된 척 포장 금지* — 갈렸으면 갈렸다고 박제.
   각 분기점은 최소 2개 입장으로 분리. 입장 1개만 있으면 갈림이 아님.

   예시 형식:
   {
     topic: "수의사 친구 1명을 자산으로 볼까 부채로 볼까",
     positions: [
       { side: "현장 검증 채널 (자산)", memberIds: ["domain-vet"] },
       { side: "1명은 표본이 아닌 친밀감 함정", memberIds: ["jobs-designer", "realist"] }
     ]
   }

(3) openQuestions — *당신이 답해야 할 질문*
   패널이 사용자에게 되돌린 질문. 답에 따라 결론이 바뀌는 *분기 조건*.
   2~4개. 교과서적 일반론 금지 — *이 고민에만 들어맞는* 질문.

[금지 사항]
- 강제 수렴 금지. divided 가 0개면 안 된다. 갈린 지점이 *반드시 있다*.
- 일반론 금지. "신중히 검토하라" 식 결론은 결론이 아니다.
- 굴복 금지. 사용자에게 맞춰주는 안전 모드 절대 금물.
- 입장 1개 의 divided 금지. 갈렸으면 양쪽 모두 박제.
`;
}
```

위 본문 *그대로* 박제. Sonnet 임의 수정 금지. 굴복 금지·강제 수렴 금지 가드 본문 안에 포함.

---

## 부록 B — v2 summary UI 디테일 (Opus 박제)

### B.1 시각 가중치 위계

```
divided (★)  >>  openQuestions  >  consensus
배경 강조      중간 강조           가벼움
큰 폰트       중간 폰트            작은 폰트
accent 톤    primary 톤           muted 톤
```

### B.2 갈림 카드 레이아웃

```tsx
<section className="rounded-2xl border-2 border-accent/40 bg-accent/5 p-5">
  <h3 className="text-base font-bold text-text">{divided.topic}</h3>
  <div className="mt-3 grid gap-3 sm:grid-cols-2">
    {divided.positions.map((pos) => (
      <div className="rounded-xl border border-border bg-surface p-3">
        <p className="text-sm font-semibold text-text">{pos.side}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pos.memberIds.map(id => {
            const m = castMap.get(id);
            if (!m) return null;
            return (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs">
                <PersonaOrb persona={m} size={14} glow="none" />
                {m.name}
              </span>
            );
          })}
        </div>
      </div>
    ))}
  </div>
</section>
```

데스크탑은 입장이 *그리드 2 열* (양 진영), 모바일은 *세로 적재*.

### B.3 v1 fallback

```tsx
{conclusion.consensus !== undefined ? (
  <DecisionMapView conclusion={conclusion} castMap={castMap} />
) : (
  <LegacyConclusionView conclusion={conclusion} castMap={castMap} />
)}
```

`LegacyConclusionView` = 현재 4섹션 UI 코드 그대로 분리. 옛 세션 회귀 0.
