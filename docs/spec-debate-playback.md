# 스펙 — 트랙 ⑤ 토론 진행 모델 재설계 (청크 & 갈림길)

> 작성: Opus (설계)
> 상태: 설계 확정. 페이즈별로 `workorder-*.md` 로 분해해 Claude Code가 구현.
> 선행: `roadmap.md` 트랙 ⑤, `../CLAUDE.md`
> 흡수: 개선 1(배치 생성). 편입: 트랙 ③(스테이지 UI)를 렌더링 레이어로.
> 최종 갱신: 2026-05-23

---

## 1. 목표와 핵심 전환

**문제**: 페르소나 발언 하나하나에 API 호출 — (1) 토큰 폭증, (2) 발언이 너무 빨라 스크롤이 어지러움, (3) 주제 없이 산만, (4) 다 읽기 부담. 게다가 *실시간 AI 채팅*은 COUNCIL의 차별점이 아니다 — 그건 ChatGPT다.

**전환**: 토론을 *실시간 생성*이 아니라 **연출된 청크의 재생 + 사용자 조향**으로.

> **원칙 한 줄 — API 호출은 '연출'이 아니라 '방향 결정'에 쓴다.**

한 번의 호출로 한 토막(청크)의 미니 장면을 통째로 생성하고, 화면에서는 말풍선 애니메이션으로 *재생*한다. 호출은 사용자가 *다음에 뭘 파고들지 고를 때* 쓴다.

---

## 2. 개념

### 2.1 청크(Chunk)

LLM 호출 1회의 산출물. 하나의 **소주제**에 대한 3~5턴짜리 미니 장면.
- `turns`: 페르소나 발언 3~5개. 모델이 한 호출에서 *연출* — 자기가 쓴 앞 줄을 보며 쓰므로 반박이 진짜다.
- 각 턴에 `isKeyPoint` 태그 — 강조 표시할 핵심 라인 (시인성).
- `nextTopics`: 다음에 파고들 소주제 후보 2~4개 (= 갈림길 메뉴).

### 2.2 갈림길(Steering point)

청크 재생이 끝나면 등장. 사용자가 다음 방향을 정하는 지점.
- `nextTopics` 카드 2~4개 중 선택 → 다음 청크 생성
- "직접 입력" → 사용자가 원하는 소주제를 직접 → 다음 청크 (= 사용자의 목소리가 들어가는 곳)
- "결론 내기" → 결론 생성

**STEP 5의 글로벌 발언/지시는 갈림길로 흡수된다.** 사용자 개입 = 갈림길에서의 선택·입력. 별도 글로벌 입력 탭은 은퇴(또는 보조로만).

### 2.3 재생(Playback)

청크는 이미 메모리에 있다. 재생 엔진이 턴을 하나씩 *드러낸다*.
- 읽기 속도에 맞춘 딜레이 (메시지 길이에 비례).
- 사용자가 속도 조절 / 일시정지 / 탭하면 즉시 다음.
- "토론하는 것처럼 보이지만 실제로는 재생" — 호출 0.

---

## 3. 데이터 모델

```ts
// 청크 생성 호출의 출력 스키마 (lib/ai/client.ts)
const chunkTurnSchema = z.object({
  speakerName: z.string().describe('패널 멤버 이름 정확히'),
  message: z.string().max(300).describe('발언 — 한국어 200자 이내'),
  replyToIndex: z.number().int().nullable()
    .describe('이 청크 내 앞선 turn 의 인덱스에 반박할 때만, 아니면 null'),
  isKeyPoint: z.boolean().describe('이 청크에서 가장 중요한 1~2개 라인이면 true'),
});

export const chunkSchema = z.object({
  turns: z.array(chunkTurnSchema).min(3).max(5),
  nextTopics: z.array(z.object({
    label: z.string().describe('다음에 파고들 소주제 — 짧은 제목'),
    hook: z.string().describe('왜 이걸 파면 좋은지 한 줄'),
  })).min(2).max(4),
});

// 세션에 저장하는 청크 메타
interface ChunkMeta {
  id: string;
  topic: string;                              // 이 청크가 다룬 소주제
  nextTopics: { label: string; hook: string }[];
  chosenNextLabel?: string;                   // 사용자가 다음으로 고른 것 (or 직접입력)
}
```

`Message` 확장 (가산적, 마이그레이션 불필요):
```ts
interface Message {
  // ...기존 필드...
  isKeyPoint?: boolean;   // 강조 표시
  chunkId?: string;       // 어느 청크에서 왔는지
}
```

---

## 4. 청크 생성

### 4.1 `generateChunk` (`lib/ai/client.ts`)

```ts
generateChunk(args: {
  provider, apiKey,
  concern: string,
  panel: { name, role, stance }[],   // 트랙① stance 포함
  topic: string,                      // 이 청크가 다룰 소주제
  transcript: string,                 // 직전까지의 요약 (토큰 절약)
  isFirst: boolean,
}): Promise<Chunk>
```
temperature: `speech`(0.9). 무료 모델이 중첩 배열을 못 채우면 Gemini 고정 (§12).

### 4.2 `buildChunkPrompt`

핵심 지시:
- 패널 전원(이름·역할·**입장 stance**)을 소개. 사회자 포함.
- "다음 소주제 **{topic}**에 대해 3~5턴짜리 미니 장면을 연출하라. 각자 캐릭터·입장을 지키며 *실제로 반박*하라."
- BASE_PROMPT의 굴복 금지·벙벙함 금지·한 방 원칙을 그대로 적용.
- 가장 날카로운 1~2개 라인에 `isKeyPoint: true`.
- 장면이 끝나면, 사용자가 다음에 파고들 만한 **소주제 후보 2~4개**를 제안 (`nextTopics`). 후보는 *이 장면에서 갈린 지점·미해결 질문*에서 뽑을 것 — 뻔한 일반 주제 금지.
- `isFirst`면 topic은 "고민의 핵심 결정" 자체.

### 4.3 첫 청크 vs 이후

- 첫 청크: topic = 고민의 핵심 결정. transcript 없음.
- 이후 청크: topic = 사용자가 갈림길에서 고른 것(또는 직접 입력). transcript = 직전 청크들 요약.

---

## 5. 재생 엔진

`useDebate` 를 대체하는 `useDebateRoom` (또는 useDebate 전면 재작성):

상태:
- `chunks: ChunkMeta[]` + 각 청크의 turns(messages)
- 재생 상태(ephemeral): `currentChunkIndex`, `revealedTurnCount`, `playing`, `speed`
- `phase`: `idle` | `generating` | `playing` | `steering` | `concluding` | `concluded`

흐름:
```
generating ─(청크 도착)─▶ playing ─(턴 다 드러남)─▶ steering
   ▲                                                   │
   └──────────(사용자 소주제 선택)─────────────────────┘
steering ─(결론 내기)─▶ concluding ─▶ concluded
```

재생 규칙:
- 턴 딜레이 = `readingTime(message.length) / speed`. 읽기 시간 기반 — 사용자가 "너무 빠르다"고 한 문제 해결.
- 탭 = 즉시 다음 턴. 일시정지 버튼. speed 1x/2x.
- 청크 생성 중에는 "생각 중…"이 아니라 "다음 장면을 준비 중" 류 표시.

청크의 turns 는 생성 즉시 전부 `messages`에 저장(persist). 재생은 *이미 저장된* 메시지를 UI에서 점진적으로 드러내는 것뿐 — 새로고침하면 전부 보임(half-state 없음).

---

## 6. 갈림길 UI

청크 재생 완료 → 하단에 갈림길 패널:
- `nextTopics` 카드 2~4개 — label(굵게) + hook(회색 한 줄). 탭하면 그 소주제로 다음 청크.
- "직접 입력" — 사용자가 소주제/방향을 직접. (선택적으로 "지시" — 톤·길이 등.)
- "결론 내기" — concluding 으로.

갈림길이 사용자 개입의 단일 지점. STEP 5 글로벌 발언/지시 탭은 제거하거나 갈림길의 "직접 입력"으로 합친다.

---

## 7. 입력 템플릿

`ConcernInput` 을 자유 textarea 하나 → **가이드 양식**으로:
- 라벨 필드 또는 스켈레톤: `결정해야 하는 것` / `망설이는 이유` / `이미 시도·고려한 것` / `제약(시간·돈·사람)`.
- 각 필드를 합쳐 `concern` 문자열 구성.
- "자유롭게 쓰기" 토글로 숙련 사용자는 빈 textarea 사용 가능.
- 양식이 채워질수록 패널 설계·소주제 추천 품질이 올라간다 (개선 2b를 여기로 흡수).

---

## 8. 화자 식별 & 시인성

- **글리프**: 아키타입 데이터에 `glyph`(이모지/짧은 기호) 추가. orb 안 이니셜 대신/함께 표시 → 누가 말하는지 즉각 식별.
- **스테이지** (트랙 ③ 편입): 상단 sticky orb 줄, 재생 중 말하는 페르소나 orb 가 확대·글로우.
- **핵심 라인 강조**: `isKeyPoint` 메시지는 accent 보더/배경으로 시인성. (트랙 ②의 핀과 연결 — 핵심 라인이 결론 빌드의 재료.)
- 색상은 페르소나별 colorFrom/To 그대로 + 글리프로 이중 식별.

---

## 9. 저장 / 마이그레이션

- `messages` 는 유지 — 청크 생성 시 turns 가 전부 append. `isKeyPoint`·`chunkId` 가산.
- 신규 `chunks: Record<sid, ChunkMeta[]>` — 가산적.
- 기존 per-turn 세션: `chunkId` 없는 메시지 → 그냥 청크 없는 평면 기록으로 렌더. **깨지지 않음.** persist version 안 올려도 됨.
- 재생 상태는 persist 안 함(ephemeral).

---

## 10. 기존 코드 영향

| 파일 | 변화 |
|---|---|
| `hooks/useDebate.ts` | **전면 재작성** — per-turn 루프 → 청크 생성 + 재생 엔진 + phase 머신 |
| `lib/ai/client.ts` | `generateChunk` 신규. `generateSpeech`는 은퇴(또는 잔존) |
| `lib/prompts/orchestrator.ts` | `decideNextSpeaker` 은퇴 — 발언 순서는 청크 프롬프트 안에서 모델이 정함. `buildChunkPrompt` 신규 |
| `components/debate/DebateControls.tsx` | 재생 트랜스포트(재생/정지/속도)로 재정의 |
| `components/debate/DebateFeed.tsx` | 청크 단위 렌더 + isKeyPoint 강조 |
| `components/debate/UserInput.tsx` | 갈림길 UI로 대체 (또는 흡수) |
| `components/session/ConcernInput.tsx` | 가이드 양식 |
| `store/sessions.ts` | `chunks` 메타 추가 |
| `app/(main)/session/[id]/page.tsx` | 재생 + 갈림길 화면 |
| `types/debate.ts` | Message 확장, Chunk/ChunkMeta |

---

## 11. 페이즈 분할

### Phase ⑤-1 — 청크 엔진 + 재생 + 갈림길 ★핵심
`generateChunk` + `buildChunkPrompt` + `chunkSchema`. `useDebate` 재작성(phase 머신). 재생 엔진(턴 점진 드러내기, 일시정지). 갈림길 UI. → 토큰 문제 근본 해결.

### Phase ⑤-2 — 시인성 & 화자 식별
`isKeyPoint` 강조 렌더, 아키타입 `glyph`, 스테이지 speaker highlight (트랙 ③ 편입).

### Phase ⑤-3 — 입력 템플릿
`ConcernInput` 가이드 양식. ⑤-1과 독립 — 아무 때나.

### Phase ⑤-4 — 재생 폴리시 + motion
읽기시간 기반 딜레이 튜닝, 속도 컨트롤, 청크 전환 모션, 말풍선 등장 모션.

---

## 12. 리스크 / 결정

- **결정**: 청크 = 3~5턴. `replyToIndex`는 청크 내부 인덱스 (전역 id 아님 — 단순화).
- **결정**: 발언 순서는 `decideNextSpeaker` 룰이 아니라 청크 프롬프트 안에서 모델이 연출. 룰 엔진 은퇴.
- **결정**: STEP 5 글로벌 개입 → 갈림길로 흡수.
- **리스크 (최대)**: **`nextTopics` 품질이 제품의 성패.** 후보가 뻔하면 사용자가 "직접 입력"만 쓰고 조향 경험이 죽는다. `buildChunkPrompt`의 nextTopics 지시는 Opus가 공들여 작성. ⑤-1 착수 시 실제 출력 검수 필수.
- **리스크**: 무료 모델이 중첩 배열(turns + nextTopics)을 못 채울 수 있음 → ⑤-1 착수 시 Groq/Gemini로 구조화 출력 검증. 불안정하면 청크 생성은 Gemini 고정.
- **리스크**: 청크 일관성 — 모델이 진짜 장면을 써야 함. 트랙①의 stance가 충돌의 재료 → ①과 시너지. stance 없으면 청크가 밋밋해질 수 있음.
- **마이그레이션**: 기존 per-turn 세션은 `messages`만으로 렌더 — 안 깨짐. 낮은 위험.
- **굴복 금지 불변**: 청크 프롬프트도 BASE_PROMPT 규칙 적용. 재생일 뿐 원칙은 동일.

---

## 13. 다음 단계

Phase ⑤-1 부터 `workorder-debate-5-1-chunk-engine.md` 로 분해 → Claude Code 착수.
단 — ⑤-1은 `useDebate` 전면 재작성을 포함하는 큰 작업. 트랙① Phase A·B 와 충돌하지 않게 (① = 추천·페르소나, ⑤ = 진행 엔진) 머지 타이밍만 조율.
`nextTopics`·`buildChunkPrompt` 프롬프트 본문은 Opus가 직접 작성해 워크오더에 첨부한다.
