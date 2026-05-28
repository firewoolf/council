# 작업 의뢰서 — 트랙 ⑤-1 후속: 청크 생성 속도 + 대기 시간 UX

> 담당: Claude Code (Sonnet)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `workorder-debate-5-1-chunk-engine.md` (출하 완료), `example-target-discussion.md`
> 선행 상태: 트랙 ⑤-1 청크 엔진 출하 완료. 사용자 피드백 — *생성이 너무 오래 걸리고, 대기 시간이 죽은 시간이 됨*.

---

## 0. 한 줄 목표

청크 생성 시간을 **체감 절반 이하**로 줄이고, 생성 대기 시간을 **사용자 발언/메모 시간** 으로 전환한다. *기다림이 곧 참여* 가 되게.

---

## 1. 배경 — 트랙 ⑤-1 출하 후 사용자 피드백 (2026-05-26)

> "현재 배치로 하는건 방향에 맞긴한데, 너무 오래걸린다, 더 빨라질수는 없나?"
> "배치를 돌리는 시간동안에는 내가 요구하는 발언이나 나의 발언을 설명하는 것으로 시간을 때우면 좋겠다."

두 피드백은 *체감 시간을 줄이는* 같은 목표를 두 방향으로 푼다 — (A) *실제 생성 시간* 단축, (B) *대기 시간의 가치* 격상.

---

## 2. 절대 원칙

1. **품질 손상 금지** — 속도 개선이 *발언 품질*·*✦ 못 본 각도* 를 깎으면 트랙 ⑤-1 의 본질이 죽는다. 매번 검수.
2. **굴복 금지 불변** — `BASE_PROMPT`·`CHUNK_SYSTEM_PROMPT` 손대지 말 것.
3. **사용자 메모는 발언과 별개 채널** — 사용자가 대기 중 적은 메모는 *transcript* 에 *발언으로* 들어가지 않는다. 별도 "[사용자 메모]" 태그로 패널에게 *방향 시그널* 만 제공한다. 발언으로 격상하려면 사용자가 *명시적으로 토글*.
4. **자율 스크롤·UX 회귀 금지** — 트랙 ⑤-1 의 자율 스크롤 / SteeringPanel / DebatePhase 머신은 그대로 유지.

---

## 3. (A) 속도 개선 — 4가지 레버

### A-1. Groq `chunk` role 활성화 (검증 통과 시)

**선행:** `scripts/check-chunk-schema.mjs` 를 Groq 키로 5회 실행 → 4/5 이상 안정 통과 확인.

```bash
GROQ_API_KEY=gsk_xxxxx node scripts/check-chunk-schema.mjs
```

통과 시 `lib/ai/providers.ts` 의 `groq.roles` 배열에 `'chunk'` 한 줄 추가. Groq Llama-3.1-70B 는 Gemini Flash 보다 *생성 속도가 2~3배* 빠른 경우가 많다 (특히 출력이 긴 청크).

`runWithFallback` 의 priority 가 Groq 를 먼저 시도하게 — `PROVIDERS.groq.priority` 값을 점검 (현재 priority 가 gemini 보다 낮으면 위로). priority 변경 시 *recommend/conclude role* 에 미치는 영향은 별도 검증 (recommend 는 Gemini 가 더 안정적이라 그대로 두는 게 좋을 수 있음 — *role 별 priority* 도입 검토).

### A-2. `transcript` 압축 강화

현재 `buildTranscript(messages, cast, 12)` — 최근 12 턴. 압축 방향:

- **N 을 8 로 축소** — 12 → 8. 최근 의미 중심.
- **`isKeyPoint` 우선** — 최근 8 턴 안에 `isKeyPoint:true` 가 있으면 그것만 유지, 나머지는 *한 줄 요약* 형식 (`[이름] (중략)`).
- 또는 더 단순: **`isKeyPoint:true` 메시지는 *역사 N 무관* 항상 포함, 그 외엔 최근 6 턴**.

Sonnet 결정 — 둘 다 시도해보고 청크 품질에 영향 없으면 *최소 토큰* 안 채택.

### A-3. `chunkSchema` turn 수 옵션화

현재 `chunkSchema.turns = .min(3).max(5)`. 옵션:

- **고정 3 턴 모드 추가** (예: `args.compact: true` 일 때 `min(3).max(3)`). 첫 청크는 5턴, 후속 청크는 3턴 — *후속 청크의 생성 시간 절반*.
- 또는 *사용자 설정* — `/settings` 에 "토론 밀도" 옵션 (느슨 5 / 표준 4 / 압축 3).

이건 *변경 큼* — Sonnet 이 transcript 압축(A-2) 으로 먼저 효과 봤다면 *후속 마일스톤* 으로 미룸.

### A-4. max output tokens 제한

`generateObject` 의 `maxTokens` 인자를 명시. 청크 한 단위가 대략 *3턴 × 200자 + nextTopics 4개 × 100자* ≈ 1000 토큰. 안전 마진 포함 **`maxTokens: 1500`** 명시. 현재는 모델 기본값 (수천~수만) — 모델이 *불필요하게 길게 생성* 하는 경우 시간 낭비.

`lib/ai/client.ts` 의 `generateChunk` 안 `generateObject` 호출에 `maxTokens: 1500` 추가.

---

## 4. (B) 대기 시간 UX — *기다림 = 참여*

### B-1. `generating` phase 동안 사용자 메모 영역

`generating` phase 의 회의실 본문에 **사용자 메모 영역** 표시. UI:

```
┌─ 패널이 다음 장면을 준비 중… ───────────────┐
│  (TypingIndicator + 회전하는 dot 등 기존 유지)│
├─────────────────────────────────────────────┤
│  📝 대기 시간 활용 — 다음 청크에 영향 줄 메모  │
│                                              │
│  [ 패널에게 짚어주고 싶은 포인트나 추가 정보 │
│    를 적어주세요. 발언이 아니라 *방향 시그널*│
│    이에요.                                  ] │
│                                              │
│  [✓ 이 메모를 다음 청크에 시그널로 주기]      │
│  [✓ *발언* 으로 격상 → 메시지에 추가]         │
└─────────────────────────────────────────────┘
```

상호작용:
- 사용자가 textarea 에 메모를 적는다. 길이 제한 200자.
- **체크박스 1 — 시그널** (기본 켜짐): 메모가 다음 `generateChunk` 호출의 `transcript` 끝에 `[사용자 메모 — 패널에게 주는 시그널]\n{메모}` 형식으로 주입. 패널은 *참고* 만 한다.
- **체크박스 2 — 발언으로 격상** (기본 꺼짐): 토글 시 메모를 *사용자 발언 메시지* 로 격상해 `appendMessage(sessionId, { speakerId: null, content: 메모, ... })` 호출. 평소 *사용자 발언* 과 동일하게 다뤄짐.
- 생성이 끝나면 (`phase` 가 `playing` 으로 전환) 메모 영역은 *접힘* 또는 *사라짐*.

→ `useDebate` 가 *generating 진입 시점에 대기 메모 한 줄을 받을 수 있는* 채널 노출.

### B-2. `useDebate` 신규 액션 — `submitWaitingMemo`

```tsx
actions.submitWaitingMemo: (text: string, opts: { asUtterance: boolean }) => void
```

- `asUtterance: false` → 내부 `pendingMemoRef.current = text` 에 보관. 다음 `generateChunk` 호출 시 transcript 끝에 주입.
- `asUtterance: true` → `appendMessage` 로 사용자 발언 추가. transcript 가 자연스럽게 그 메시지를 포함.
- 호출 후 메모는 초기화 (다음 메모를 위해).

### B-3. UI 신규 컴포넌트 — `WaitingMemoArea`

`components/debate/WaitingMemoArea.tsx` 신규.

```tsx
interface WaitingMemoAreaProps {
  /** 'generating' phase 일 때만 마운트. 부모가 phase 보고 결정. */
  onSubmit: (text: string, opts: { asUtterance: boolean }) => void;
}
```

내부 state: text / asUtterance 토글 / submitted (한 번 보내고 나면 "다음 메모를 위해" 비활성).

### B-4. `session/[id]/page.tsx` 배선

`phase === 'generating'` 이면 회의실 본문 아래 `<WaitingMemoArea />` 마운트. `useDebate.actions.submitWaitingMemo` 콜백 전달.

기존 TypingIndicator 또는 "다음 장면을 준비 중" 안내는 상단에 유지. 메모 영역은 그 아래.

---

## 5. 영향 파일 맵

```
신규:
  components/debate/WaitingMemoArea.tsx

갱신 (A 속도):
  lib/ai/providers.ts                  groq.roles 에 'chunk' 추가 (검증 통과 시)
  lib/ai/client.ts                     generateObject maxTokens: 1500 명시
  hooks/useDebate.ts                   buildTranscript N 축소 + isKeyPoint 우선
  (선택) lib/ai/client.ts              chunkSchema 의 compact 모드 옵션

갱신 (B 대기 UX):
  hooks/useDebate.ts                   pendingMemoRef + submitWaitingMemo 액션
                                       generateChunk 호출 시 transcript 끝에 메모 주입
  app/(main)/session/[id]/page.tsx     generating 일 때 WaitingMemoArea 마운트
```

---

## 6. 손대지 말 것

- `CHUNK_SYSTEM_PROMPT` (부록 B) / `buildChunkPrompt` (부록 C/D) 본문 — 그대로.
- `chunkSchema` 의 `nextTopics` 부분 (✦ 못 본 각도) — 그대로.
- `sanitizeChunk` 의 보정 로직 — 그대로.
- DebatePhase 머신 — 그대로 (`generating → playing → steering → concluding → concluded/error`).
- 자율 스크롤·SteeringPanel·DebateFeed 그루핑 — 그대로.

---

## 7. 검증 기준

### 7.1 자동 검증

- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` 통과.
- [ ] 옛 LocalStorage 세션 회귀 — `submitWaitingMemo` 미사용 시 동작 동일.

### 7.2 사람 검증

- [ ] 같은 고민에 같은 키로 청크 생성 — *기존 대비 시간 단축* 체감. (수치 보고는 옵션. ms 측정.)
- [ ] 청크 품질 손상 없음 — 발언 길이·반박 연결·✦ 후보 모두 유지.
- [ ] `generating` 중 메모 영역 등장. 메모 입력 → "시그널" 체크 → 다음 청크가 그 시그널을 *참고* 한 흔적 (모델이 메모의 키워드를 받아치거나 함의).
- [ ] "발언으로 격상" 토글 → 메모가 사용자 발언으로 회의록에 추가, 다음 청크의 transcript 에 정상 포함.
- [ ] Groq `chunk` 활성화 시: 5회 청크 생성 중 4/5 안정 (생성 실패율 < 20%).

---

## 8. 출하 단위 — 두 묶음

### ⑤-1f-A. 속도 개선 (블로킹)

§3 의 4가지 레버. A-1 (Groq) 은 검증 후 별도 PR. A-2/A-3/A-4 는 한 PR.

### ⑤-1f-B. 대기 UX

§4 전체. A 통과 후 진입.

---

## 9. 완료 후

- `backlog.md` 트랙 ⑤-1 항목 아래에 후속 박제.
- 추가 속도 개선 — 스트리밍(`streamObject`) 도입은 *별도 트랙* (트랙 ⑤-4 영역 또는 신규).
- 대기 UX 가 정착되면 트랙 ⑤-3 (입력 템플릿) 과 결합 가능 — 메모가 *구조화된 입력* 으로 진화.

---

## 부록 — Groq priority 결정 가이드

현재 `lib/ai/providers.ts` 구조 확인 후 결정:

| role | gemini | groq | cerebras | openrouter |
|---|---|---|---|---|
| recommend | ✓ (안정) | ⚠️ (스키마 깨질 수 있음 — sanitizePanel 보호) | ✗ | ✓ |
| chunk | ✓ (현재 고정) | ✓ (검증 통과 시 추가, *속도 우위*) | ✗ | ✓ |
| conclude | ✓ | ✓ | ✗ | ✓ |
| speech | (은퇴) | — | — | — |

**chunk 만 Groq 우선** — recommend/conclude 는 그대로. role 별 priority 가 없다면 `runWithFallback` 의 `roleOrder` 파라미터를 추가하는 게 깔끔. 또는 단순히 `chunk` 호출 시점에 Groq 키 있으면 직접 호출.
