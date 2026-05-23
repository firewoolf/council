# 작업 의뢰서 — 트랙 ⑤ Phase ⑤-1: 청크 엔진 + 재생 + 갈림길

> 담당: Claude Code (Sonnet)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `spec-debate-playback.md` (전체 설계), `roadmap.md` 트랙 ⑤, `../CLAUDE.md`

---

## 0. 한 줄 목표

페르소나 발언을 1턴=1호출로 생성하던 구조를, **1호출=한 소주제 3~5턴짜리 미니 장면(청크)**으로 바꾸고, 청크를 화면에서 재생하고, 재생이 끝나면 사용자가 다음 방향을 고르는 **갈림길**을 붙인다.

---

## 1. 배경 — 왜 이게 핵심 레버인가

지금은 발언 한 개마다 `generateSpeech` 호출이다. 결과: (1) 토큰·호출 폭증, (2) 발언이 너무 빨라 스크롤이 어지러움, (3) 주제 없이 산만, (4) 다 읽기 부담. 그리고 *실시간 AI 채팅*은 COUNCIL의 차별점이 아니다 — 그건 ChatGPT다.

⑤-1은 토론을 **연출된 청크의 재생 + 사용자 조향**으로 바꾼다. 한 번의 호출로 한 토막의 미니 장면을 통째로 생성하고(모델이 자기가 쓴 앞 줄을 보며 쓰므로 반박이 진짜다), 화면에서는 재생만 한다. 호출은 사용자가 *다음에 뭘 파고들지 고를 때* 쓴다.

> **원칙 한 줄 — API 호출은 '연출'이 아니라 '방향 결정'에 쓴다.**

---

## 2. 절대 원칙

1. CLAUDE.md ⓬ 준수 — `process.env` 직접 접근 금지(`@/env`), 테스트 코드 금지(MVP 이후), Tailwind v3, 스켈레톤 로딩 금지("다음 장면 준비 중" 류 텍스트).
2. **굴복 금지 불변** — 청크 프롬프트도 `BASE_PROMPT`의 굴복 방지 규칙을 그대로 적용한다. 청크는 *재생*일 뿐, 페르소나가 사용자에게 굴복하지 않는다는 원칙은 동일하다.
3. **마이그레이션 무중단** — `Message`에 붙는 `isKeyPoint`·`chunkId`, 신규 `sessionChunks`는 전부 **가산적 필드**. 기존 LocalStorage 세션(청크 없는 평면 기록)을 깨면 안 된다. zustand persist version을 올리지 말 것. 셀렉터는 항상 `?? []` / `?? {}` 가드.
4. **착수 첫 단계는 검증** — §3 이전에, 무료 모델이 중첩 배열 구조화 출력(`turns` + `nextTopics`)을 안정적으로 채우는지 Groq·Gemini로 먼저 확인한다(§5-0). 불안정하면 청크 생성은 Gemini 고정.
5. `nextTopics`·`buildChunkPrompt`·`CHUNK_SYSTEM_PROMPT` 프롬프트 본문은 **부록 B·C·D에 그대로 첨부돼 있다.** 임의로 다시 쓰지 말 것 — 이 프롬프트 품질이 제품의 성패다.

---

## 3. 작업 범위 — A~G

### A. 타입 (`types/debate.ts`)

`Message`에 가산적 필드 2개:

```ts
export interface Message {
  // ...기존 필드 유지...
  /** 이 발언이 속한 청크 id. 청크 이전 세션의 메시지는 undefined */
  chunkId?: string;
  /** 이 청크에서 가장 날카로운 1~2개 라인이면 true */
  isKeyPoint?: boolean;
}
```

신규 타입 — 세션에 저장하는 청크 메타:

```ts
export interface ChunkMeta {
  id: string;
  /** 이 청크가 다룬 소주제 */
  topic: string;
  /** 재생 완료 후 제시된 다음 소주제 후보 */
  nextTopics: { label: string; hook: string }[];
  /** 사용자가 다음으로 고른 것 (직접 입력 포함). 마지막 청크면 undefined */
  chosenNextLabel?: string;
  createdAt: string; // ISO
}
```

### B. 청크 프롬프트 (`lib/prompts/orchestrator.ts`)

추가:
- `CHUNK_SYSTEM_PROMPT` — 부록 B 전문 그대로. 모듈 상단 const.
- `buildChunkPrompt(args)` — 부록 C 그대로. `nextTopics` 지시(부록 D)는 이 함수 본문 안에 포함된다.

은퇴(제거):
- `decideNextSpeaker`, `TurnDecision`, `MAX_CONSECUTIVE` / `SOFT_LIMIT` / `HARD_LIMIT`, `buildDebateContext` — per-turn 루프가 사라지므로 전부 제거. 발언 순서는 청크 프롬프트 안에서 모델이 연출한다.

잔존:
- `conclusionSchema`, `buildConclusionPrompt`, `Conclusion` — 결론 생성은 그대로. 단 `buildConclusionPrompt`는 `messages`를 그대로 받으므로 청크 도입 후에도 동작한다(메시지는 계속 평면으로 쌓임).

### C. 청크 생성 (`lib/ai/client.ts`)

`speechSchema` 옆에 청크 스키마 추가 (부록 A 그대로):

```ts
const chunkTurnSchema = z.object({ ... });   // 부록 A
export const chunkSchema = z.object({ ... }); // 부록 A
export type Chunk = z.infer<typeof chunkSchema>;
```

`generateChunk` 추가 — `generateSpeech`와 동일 패턴(`getModel` → `generateObject` → `classifyAiError`):

```ts
export async function generateChunk(args: {
  provider: AiProvider;
  apiKey: string;
  concern: string;
  panel: { name: string; role: string; stance: string }[];
  topic: string;        // isFirst면 무시됨
  transcript: string;   // 직전 청크들 요약. 첫 청크면 ''
  isFirst: boolean;
}): Promise<Chunk>
```

- `system: CHUNK_SYSTEM_PROMPT`, `prompt: buildChunkPrompt(args)`.
- `temperature: TEMPERATURE.speech` (0.9) 재사용.
- `maxRetries: 1`.

은퇴: `generateSpeech` + `speechSchema` 제거 (per-turn 루프 폐기로 호출처가 없어짐).

### D. 스토어 (`store/sessions.ts`)

- 신규 필드 `sessionChunks: Record<string, ChunkMeta[]>` — 가산적.
- `addChunk(sessionId, chunkMeta)` 액션.
- `getChunks(sessionId)` 셀렉터 — 항상 `?? []` 폴백.
- `updateChunkChoice(sessionId, chunkId, chosenNextLabel)` — 갈림길 선택 기록용.
- `deleteSession`에서 `sessionChunks[id]`도 정리.
- 청크의 turn들은 **기존 `addMessage`로 그대로 저장** — `chunkId`·`isKeyPoint`만 얹어서. 메시지 저장 경로는 신설하지 않는다.
- **persist version 올리지 말 것.**

### E. 토론 훅 전면 재작성 (`hooks/useDebate.ts`)

per-turn 루프(`decideNextSpeaker` → `generateSpeech` 반복)를 폐기하고 **phase 머신 + 청크 생성 + 재생 엔진**으로 재작성한다.

phase: `idle | generating | playing | steering | concluding | concluded | error`

```
idle ─(start)─▶ generating ─(청크 도착)─▶ playing
  playing ─(턴 다 드러남)─▶ steering
  steering ─(소주제 선택/직접입력)─▶ generating ─▶ playing  (반복)
  steering ─(결론 내기)─▶ concluding ─▶ concluded
  generating/concluding ─(에러)─▶ error
```

청크 생성 흐름:
1. `panel` 구성 — `activePersonas`(사회자 포함) × `sessionStances`(트랙① Phase A) → `{ name, role, stance }[]`. stance 없으면 `''`.
2. `transcript` 구성 — 직전 청크들의 turn을 `[이름] 발언` 한 줄씩 압축. **LLM 요약 호출 금지**(토큰 절약이 목적). 최근 N턴(예: 12)만.
3. `generateChunk` 호출. `isFirst`는 첫 청크만 true.
4. 받은 `Chunk`의 각 turn을 `Message`로 변환:
   - `speakerName` → `personaMap`에서 역매핑해 `speakerId`. 못 찾으면 그 turn은 사용자 발언(`speakerId: null`)이 아니라 **드롭**하고 경고 토스트(모델 환각 방어).
   - `replyToIndex` → 같은 청크 안에서 그 인덱스의 turn이 받은 message id로 변환해 `replyTo`에.
   - `chunkId` 부여, `isKeyPoint` 전달.
   - `addMessage`로 저장.
5. `ChunkMeta`(id, topic, nextTopics, createdAt) → `addChunk`.
6. phase → `playing`.

재생 엔진:
- 재생 상태는 **ephemeral**(persist 안 함): `currentChunkIndex`, `revealedTurnCount`, `playing`, `speed`.
- 턴 딜레이 = `readingTime(message.length) / speed`. `readingTime` 헬퍼는 `lib/utils.ts`에 추가(한국어 분당 읽기 속도 기준, 최소·최대 클램프).
- `playing`이면 타이머로 `revealedTurnCount` 증가. 사용자가 탭하면 즉시 다음 턴. 일시정지 토글. speed 1x / 2x.
- 청크의 turn은 생성 즉시 전부 `messages`에 저장돼 있다. 재생은 *저장된 메시지를 UI에서 점진적으로 드러내는 것뿐* — 새로고침하면 전부 보인다(half-state 없음).
- 한 청크의 turn이 다 드러나면 phase → `steering`.

`useDebate`가 노출할 것(예): `phase`, `messages`, `chunks`, `currentChunk`, `revealedMessages`, `play()`, `pause()`, `setSpeed()`, `skipTurn()`, `chooseTopic(label)`, `submitCustomTopic(text)`, `conclude()`.

### F. 컴포넌트 (`components/debate/`)

- **`DebateFeed.tsx`** — 메시지를 청크 단위로 묶어 렌더. `revealedMessages`만 표시(재생 진행 분). `isKeyPoint` 메시지는 accent 보더/배경으로 강조(세부 시인성은 ⑤-2, 여기선 최소 강조만). 자동 스크롤 유지.
- **`DebateControls.tsx`** — 기존 일시정지/재개/결론 컨트롤을 **재생 트랜스포트**로 재정의: 재생·일시정지, 속도(1x/2x), "다음 턴" 탭. sticky 유지.
- **`SteeringPanel.tsx` (신규)** — 갈림길 패널. phase가 `steering`일 때 하단에 등장:
  - `nextTopics` 카드 2~4개 — `label`(굵게) + `hook`(`text-muted` 한 줄). 탭 → `chooseTopic(label)`.
  - "직접 입력" — 텍스트 입력 → `submitCustomTopic(text)`. (STEP 5의 글로벌 발언/지시가 여기로 흡수된다.)
  - "결론 내기" — `conclude()`.
- **`UserInput.tsx`** — 글로벌 발언/지시 3탭 UI는 은퇴. 사용자 개입은 `SteeringPanel`의 "직접 입력"이 단일 지점. (파일은 삭제하거나, "직접 입력"의 입력 위젯으로 축소 재사용.)

### G. 회의실 화면 (`app/(main)/session/[id]/page.tsx`)

`useDebate`의 phase에 따라 배선:
- `generating` / `concluding` → "다음 장면을 준비 중" 류 텍스트 인디케이터(스켈레톤 금지).
- `playing` → `DebateFeed` + `DebateControls`.
- `steering` → `DebateFeed`(완료된 청크) + `SteeringPanel`.
- `concluded` → 기존 결론 배너 → `/session/[id]/summary`로.
- `error` → 재시도 UI(`AiCallError` 메시지 표시).

---

## 4. 손대지 말 것

- `isKeyPoint` 강조의 정교한 렌더, 아키타입 `glyph`, 스테이지 speaker highlight — **⑤-2**. 여기선 `isKeyPoint`에 최소 강조만.
- `ConcernInput` 가이드 양식 — **⑤-3**.
- 읽기시간 딜레이 정밀 튜닝, 청크 전환/말풍선 등장 모션 — **⑤-4**. ⑤-1은 동작하는 기본 딜레이까지만.
- `conclusionSchema`의 `personaId` enum — 그대로. 건드리지 말 것.
- 트랙① Phase B(동적 생성·`CastMember`·커스텀 폼) 영역 — 손대지 말 것.
- Supabase 동기화 — 청크/메시지는 LocalStorage 경로로만. Supabase write-through는 별도 마일스톤.

---

## 5. 검증 기준

### 5-0. 착수 전 — 구조화 출력 검증 (선행, 필수)

- [ ] Groq·Gemini 각각에 `chunkSchema`로 `generateObject`를 시험 호출 → 중첩 배열(`turns` + `nextTopics`)을 안정적으로 채우는지 확인.
- [ ] 한쪽이 불안정하면 `generateChunk`는 Gemini 고정. 결과를 워크오더 회신에 보고.

### 5-1. 자동 검증

- [ ] `pnpm typecheck` / `pnpm build` 통과.
- [ ] 기존 LocalStorage의 *청크 이전* 세션을 열어도 깨지지 않음(`sessionChunks` undefined, `chunkId` 없는 메시지 → 평면 렌더).
- [ ] persist version 미변경 확인.

### 5-2. 사람 검증 (회신에 포함)

- [ ] 새 회의 1회 → 첫 청크가 3~5턴으로 생성되고 재생됨.
- [ ] 청크 내 발언들이 *서로* 반박함(`replyToIndex` 연결이 실제 내용과 맞음).
- [ ] 재생 속도가 읽을 만함(이전 "너무 빠르다" 문제 해소). 일시정지·속도·탭 동작.
- [ ] 재생 종료 후 갈림길 카드가 뜨고, **`nextTopics` 후보가 막연하지 않음** — 방금 장면에서 갈린 지점을 가리킴(부록 D의 나쁜 예 같은 교과서 목차가 아님). ★최우선 검수 항목.
- [ ] 소주제 선택 → 다음 청크가 그 주제로 이어짐. "직접 입력"·"결론 내기"도 동작.
- [ ] 굴복·벙벙함 없음 — 패널이 사용자에게 듣기 좋은 말을 하지 않음.

---

## 6. 참고 — 현재 관련 파일

```
types/debate.ts                      # Message, Session — isKeyPoint/chunkId/ChunkMeta 추가
lib/prompts/orchestrator.ts          # decideNextSpeaker/buildDebateContext 은퇴, CHUNK_SYSTEM_PROMPT/buildChunkPrompt 추가
lib/prompts/base.ts                  # BASE_PROMPT (굴복 방지 — 청크 프롬프트에 반영)
lib/ai/client.ts                     # generateSpeech 은퇴, generateChunk/chunkSchema 추가, TEMPERATURE.speech
store/sessions.ts                    # sessionChunks/addChunk/getChunks 추가
hooks/useDebate.ts                   # 전면 재작성 — phase 머신 + 재생 엔진
components/debate/DebateFeed.tsx     # 청크 단위 렌더
components/debate/DebateControls.tsx # 재생 트랜스포트
components/debate/UserInput.tsx      # 은퇴 (SteeringPanel로 흡수)
components/debate/SteeringPanel.tsx  # 신규 — 갈림길
lib/utils.ts                         # readingTime 헬퍼 추가
app/(main)/session/[id]/page.tsx     # phase 배선
```

---

## 7. 완료 후

- ⑤-1 출하·검증이 끝나면 `backlog.md`에 기록.
- 5-0 구조화 출력 검증 결과(공급사별 안정성)를 회신에 명시 — ⑤-2 이후 판단 재료.
- ⑤-2(시인성·화자 식별), ⑤-3(입력 템플릿), ⑤-4(재생 폴리시·모션) 워크오더는 Opus가 별도 작성.

---

# 부록 A — 청크 스키마 (`lib/ai/client.ts`에 그대로)

```ts
const chunkTurnSchema = z.object({
  speakerName: z.string().describe('패널 명단의 이름과 정확히 일치'),
  message: z
    .string()
    .max(300)
    .describe('발언 본문 — 한국어 200자 이내. 원론·양비론 금지, 구체적인 한 방.'),
  replyToIndex: z
    .number()
    .int()
    .nullable()
    .describe('이 청크 안에서 앞선 turn 인덱스(0부터)에 반박할 때만. 새 논점이면 null'),
  isKeyPoint: z
    .boolean()
    .describe('이 청크에서 가장 날카로운 1~2개 라인이면 true, 아니면 false'),
});

export const chunkSchema = z.object({
  turns: z.array(chunkTurnSchema).min(3).max(5),
  nextTopics: z
    .array(
      z.object({
        label: z.string().describe('다음에 파고들 소주제 — 짧은 제목(15자 내외)'),
        hook: z.string().describe('왜 지금 이걸 파야 하는지 한 줄 — 방금 장면의 충돌을 가리키며'),
      }),
    )
    .min(2)
    .max(4),
});

export type Chunk = z.infer<typeof chunkSchema>;
```

---

# 부록 B — `CHUNK_SYSTEM_PROMPT` (그대로)

```
당신은 COUNCIL의 토론 장면을 연출하는 작가입니다.
한 번의 호출로, 전문가 패널이 벌이는 3~5턴짜리 토론 미니 장면 하나를 완성합니다.
패널 전원의 목소리를 당신이 씁니다 — 각자 자기 캐릭터와 입장에 충실하게.

[연출 원칙]
1. 진짜 충돌. 턴들은 서로를 향한다. 뒤 턴은 앞 턴의 구체적인 표현을 집어서
   받아치거나, 보완하거나, 되묻는다. 허공에 대고 하는 독백을 쓰지 않는다.
2. 한 방. 발언은 한국어 200자 이내, 두세 문장. 늘어놓지 말고 가장 날카로운
   한 문장을 남긴다. "여러 측면이 있습니다" 식의 펼치기는 발언이 아니다.
3. 입장 견지. 각 패널은 배정된 입장(stance)을 장면 내내 지킨다. 반박에
   논리적으로 밀리면 "그 부분은 인정합니다"까지는 가능하나, 핵심 입장은
   양보하지 않는다.
4. 굴복 금지. 패널은 고민 당사자를 안심시키러 온 것이 아니라, 당사자가 보지
   못한 것을 들이대러 왔다. "맞습니다", "좋은 지적입니다", "대표님 말씀이
   옳습니다" 같은 표현은 절대 쓰지 않는다.
5. 벙벙함 금지. "상황에 따라 다르다", "신중히 검토하라"는 발언이 아니다.
   모든 발언은 구체적인 주장·근거·반례 중 하나를 들고 있어야 한다.

[핵심 라인]
이 장면에서 가장 날카롭거나 결정적인 발언 1~2개에만 isKeyPoint: true 를 단다.
전부 true이거나 전부 false이면 잘못 판단한 것이다.

[발언자]
speakerName 은 제공된 패널 명단의 이름과 정확히 일치해야 한다.
명단에 없는 인물을 등장시키지 않는다. 패널 전원이 매 장면 등장할 필요는 없다 —
이 소주제에 할 말이 있는 사람만. 단, 한 사람이 3턴 연속으로 말하지 않는다.

[다음 갈림길]
장면을 다 쓴 뒤, 사용자가 이어서 파고들 소주제 후보(nextTopics)를 제안한다.
이 규칙은 이어지는 지시(buildChunkPrompt)를 따른다.
```

---

# 부록 C — `buildChunkPrompt` 본문 (그대로)

함수는 아래 문자열을 조립해 반환한다. `{...}`는 인자 주입 지점.

```
[고민 당사자가 들고 온 문제]
{concern}

[패널]
{panel 각 줄: "- {name} ({role}) — 입장: {stance || '특정 입장 없음(중립)'}"}

[이번 장면의 소주제]
{isFirst
  ? '이 고민의 핵심 결정 그 자체. 패널이 처음으로 정면 충돌하는 장면이다.'
  : topic}

{transcript 있을 때만:
[지금까지의 토론 요약]
{transcript}
}

[작업]
위 소주제에 대해 패널이 벌이는 3~5턴짜리 토론 장면을 연출하라.
- 직전 턴에 반박하면 replyToIndex 에 그 턴의 인덱스(이 청크 안에서 0부터)를
  넣는다. 새 논점을 열면 null.
- 사회자가 패널에 있으면, 장면을 열거나(첫 청크) 가장 날카로운 질문을 던지는
  역할로 쓴다. 사회자는 중재하되 무르지 않는다.
- 가장 날카로운 1~2개 발언에 isKeyPoint: true.

[다음 갈림길 — nextTopics]
{부록 D 지시}
```

---

# 부록 D — `nextTopics` 지시 (`buildChunkPrompt` 본문에 포함, 그대로)

```
장면이 끝났으면, 사용자가 다음에 파고들 소주제 후보를 2~4개 제안한다.
이게 이 제품의 핵심이다 — 후보가 뻔하면 사용자는 메뉴를 무시하고, 조향 경험이
죽는다.

규칙:
- 후보는 *방금 이 장면에서* 길어 올린다. 패널이 끝내 갈라선 지점, 한쪽이
  던졌지만 반대쪽이 아직 제대로 답하지 못한 질문, 모두가 슬쩍 피해 간 불편한
  전제 — 거기서 뽑는다.
- 일반론 금지. "마케팅 전략", "리스크 관리", "비용 검토" 같은 교과서 목차는
  후보가 아니다. 어떤 고민에도 붙는 말이라 아무 방향도 가리키지 못한다.
- 검증법: 그 후보를 *다른 고민의 장면*에 그대로 복사해도 말이 되면, 너무
  막연한 것이다. 버려라. 이 고민에만 들어맞아야 한다.
- label 은 짧은 제목(15자 내외). hook 은 "왜 지금 이걸 파야 하는지" 한 줄 —
  방금 장면의 어떤 충돌을 가리키며 쓴다.

좋은 예 (고민: "지금 유료 전환을 할까"):
- label: "공짜 사용자 이탈을 감당할 수 있나"
  hook: "투자자는 전환을 밀었지만, 개발자가 말한 '이탈 40%'에 아무도 답하지 않았다"
- label: "가격을 얼마로 잡을 것인가"
  hook: "전환 여부만 다퉜을 뿐, 정작 숫자는 한 번도 나오지 않았다"

나쁜 예 (방향을 가리키지 못함):
- "수익성 분석"          ← 막연함
- "사용자 피드백 수렴"    ← 교과서 목차
- "장단점 비교"          ← 아무것도 안 가리킴
```
