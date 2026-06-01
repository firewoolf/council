# 작업 의뢰서 — 트랙 ⑤ Phase ⑤-5e: 모두 발언 인트로 + reveal 쿨타임 튜닝

> 담당: Claude Code (Sonnet)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `workorder-debate-5-1-chunk-engine.md` (출하 완료), `workorder-debate-5-5-gamify.md` (⑤-5b 컷신과 통합 가능)
> 선행 상태: ⑤-1 청크 엔진 + 자율 스크롤 + ⑤-1f-A/B/C + ⑤-2a/b + ⑤-5a-1 + 트랙 ③-a + 트랙 ②-a 모두 출하. 사용자 피드백(2026-05-31): *"첫 청크" 라는 말이 어색* + *준비 중에 사용자 입력을 다듬어 모두 발언으로* + *순차 reveal 더 자연스럽게 + 쿨타임*.

---

## 0. 한 줄 목표

토론 시작 → 백그라운드 청크 생성 동안 **사회자가 사용자의 고민을 *재진술* 하는 모두 발언** 을 즉시 화면에 표시. *비어있는 generating phase 가 토론의 자연스러운 시작* 이 된다. 청크 reveal 의 *쿨타임* 도 함께 튜닝.

---

## 1. 배경 — 사용자 피드백 (2026-05-31)

> "첫 청크라는 말이 어색하다, 토론 준비중이라는 말로 대체하고, 토론을 준비할때는 사용자가 입력한 내용을 다시 한번 다듬으면서 모두발언을 텍스트로 뿌려준다. 이 사이에 백그라운드에서 각 페르소나별 토론내용을 만들자.
>
> 그리고 해당 백그라운드에서 배치형태로 나온 토론의 내용은 한번에 뿌려주는것이 아니라 순차적으로 실시간 토론을 하는것처럼 뿌려주면서, 토큰 재생성의 쿨타임을 가질 시간을 충분히 마련해준다."

세 가지 변경:
1. **"첫 청크" → "토론 준비중"** 라벨 (이미 출하 완료).
2. **준비 중 모두 발언 — 사회자가 concern 을 재진술 + 토론 의제 정리** (이 워크오더 본체).
3. **청크 reveal 순차성 강화 + 다음 청크 생성 쿨타임** (이 워크오더 ⑤-5e-B).

---

## 2. 절대 원칙

1. **토큰 비용 0** — 모두 발언은 **템플릿 기반 즉시 생성** (별도 LLM 호출 X). concern 을 그대로 활용, 사회자 톤은 박제.
2. **굴복 금지 불변** — 모두 발언이 *안전한 인사말* 로 흐르지 않게. 사회자가 *날카로운 의제* 를 박는다.
3. **마이그레이션 무중단** — `Message` 에 `kind?: 'intro'` 추가는 옵셔널. 옛 메시지는 그대로.
4. **자율 스크롤·재생 엔진·SteeringPanel·DirectionMenu·WaitingMemoArea 회귀 금지.**

---

## 3. 작업 범위 — A·B

### A. 모두 발언 인트로 (⑤-5e-A)

#### A.1 타입 (`types/debate.ts`)

```ts
export interface Message {
  // ...기존 필드...
  /**
   * ⑤-5e — 메시지 종류.
   *   'utterance' (기본) — 일반 발언
   *   'instruction'      — 사용자 메타 지시 (기존)
   *   'intro'            — 사회자 모두 발언 (⑤-5e 신설)
   */
  kind?: 'utterance' | 'instruction' | 'intro';
}
```

`intro` 추가만. 옛 메시지의 kind 가 undefined 면 'utterance' 로 해석 (기존 동작 그대로).

#### A.2 신규 헬퍼 (`lib/prompts/intro.ts`)

```ts
import type { CastMember } from '@/types/persona';

/**
 * ⑤-5e — 사회자 모두 발언 텍스트 생성.
 *
 * concern 을 그대로 활용 + 템플릿 박제. LLM 호출 0.
 * 굴복 금지 톤 — '안심시키는 인사' 가 아닌 '의제를 박제하는 사회자'.
 */
export function generateIntroStatement(
  concern: string,
  facilitator: CastMember | null,
): string {
  const name = facilitator?.name ?? '사회자';
  // concern 길이별 분기 — 짧은 고민은 그대로 인용, 긴 고민은 첫 한 문장만.
  const firstSentence =
    concern.length <= 80
      ? concern.trim()
      : concern
          .split(/[.!?。\n]/)
          .map((s) => s.trim())
          .filter(Boolean)[0]
          ?.slice(0, 80) ?? concern.slice(0, 80);

  return `오늘 ${name} 가 진행을 맡습니다. 사용자가 들고 온 고민은 이겁니다 — "${firstSentence}". 이 자리에서 패널이 *직답을 주는 게 아니라*, 무엇이 진짜 결정해야 할 지점인지 함께 갈라봅니다. 시작합니다.`;
}
```

본문은 *Opus 박제* — Sonnet 임의 수정 금지. 굴복 금지 톤 ("직답을 주는 게 아니라") 박혀있음.

#### A.3 `useDebate` 갱신 — `start` 액션 강화

```ts
const start = useCallback(() => {
  setError(null);

  // ⑤-5e — 사회자 모두 발언을 즉시 메시지로 추가 (generating 전 단계)
  const facilitator = cast.find((c) => c.isFacilitator) ?? null;
  if (facilitator) {
    const introText = generateIntroStatement(session.concern, facilitator);
    appendMessage(sessionId, {
      id: generateId(),
      sessionId,
      speakerId: facilitator.id,
      content: introText,
      createdAt: new Date().toISOString(),
      kind: 'intro',
    });
  }

  pendingTopicRef.current = { topic: '_first', isFirst: true };
  setPhase('generating');
}, [cast, session, sessionId, appendMessage]);
```

순서:
1. *모두 발언 메시지 추가* (즉시 화면 표시)
2. `pendingTopicRef` 세팅
3. `setPhase('generating')` — 청크 생성 백그라운드 진행

사용자는 *모두 발언 카드* 가 즉시 등장하는 걸 봄. generating 중에 *비어있는 화면* 이 아님.

#### A.4 `MessageCard` 갱신 — intro 톤

`message.kind === 'intro'` 인 페르소나 카드는 *다른 톤*:
- 좌측 색띠 더 두꺼움 (10px) — 시작의 무게
- 배경 그라디언트 더 강조 (alpha 10%)
- `animate-card-enter` 그대로

또는 *최소 변경*: 일반 발언 카드와 동일하되 *상단에 "⚐ 모두 발언" 작은 마커* 추가.

**Sonnet 결정**: 최소 변경 — `Flag` 아이콘 마커 + 다른 색띠 두께. 새 디자인 자산 안 만듦.

### B. Reveal 쿨타임 (⑤-5e-B)

#### B.1 `readingTime` 튜닝 (`lib/utils.ts`)

현재 식: `Math.max(800, Math.min(6000, content.length * 150 ms/char))`.

조정:
- ms/char 150 → **180** (한국어 평균 읽기 속도 더 여유)
- min 800 → **1200** (짧은 발언도 최소 1.2초)
- max 6000 그대로

#### B.2 청크 사이 *최소 간격* — `INTER_CHUNK_COOLDOWN_MS`

현재 `PHASE_TRANSITION_TAIL_MS = 600` 만 있음. 추가:

```ts
const INTER_CHUNK_COOLDOWN_MS = 1500; // 청크 끝 → steering 진입 후 최소 1.5초 대기
```

`useDebate` 의 *재생 끝 → steering* 전환 setTimeout 을 600 → 1500 으로 (또는 별도 const). 사용자가 *마지막 발언을 읽을 시간* 확보. 너무 빨리 갈림길 패널이 등장하지 않게.

#### B.3 *Prefetch 는 박제 안 함* — 사용자 결정 의존

다음 청크는 *사용자가 nextTopic 을 골라야* 시작. prefetch 하려면 모든 후보를 미리 생성해야 — 토큰·비용 폭증. **⑤-5e 범위 밖**. 향후 검토 (대규모 캐싱·LRU 전략 필요).

---

## 4. 영향 파일 맵

```
신규:
  lib/prompts/intro.ts                       generateIntroStatement (Opus 박제 본문)

갱신 (A 모두 발언):
  types/debate.ts                            Message.kind 에 'intro' 추가
  hooks/useDebate.ts                         start 액션 — 모두 발언 즉시 추가
  components/debate/MessageCard.tsx          kind==='intro' 시 ⚐ 마커 + 색띠 강조

갱신 (B Reveal 튜닝):
  lib/utils.ts                               readingTime 상수 조정 (180ms/char, min 1200)
  hooks/useDebate.ts                         INTER_CHUNK_COOLDOWN_MS 1500 적용
```

총 4~5개 파일 (신규 1 + 갱신 3~4).

---

## 5. 손대지 말 것

- `BASE_PROMPT`·`CHUNK_SYSTEM_PROMPT`·directive 8개·`formatDirection` — 절대 금지.
- 자율 스크롤 (NEAR_BOTTOM_PX) — 유지.
- 청크 생성 메커니즘 (`generateChunk`·`sanitizeChunk`·pendingMemoRef·pendingDirectionsRef) — 그대로.
- conclusionSchema·summary UI (트랙 ②) — 무관.
- PersonaStageStrip / PersonaDetailDrawer / DirectionMenu — 무관.
- *Prefetch* — 범위 밖.

---

## 6. 검증 기준

### 6.1 자동 검증

- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` 통과.
- [ ] 옛 세션 회귀 — `kind` undefined 인 옛 메시지가 *일반 발언* 으로 정상 렌더.
- [ ] start 액션에 facilitator 없는 cast (모종의 이유로) 도 throw 없이 동작.

### 6.2 사람 검증

- [ ] "토론 시작" 클릭 → **즉시** 사회자 모두 발언 카드 등장 (concern 인용). 그 동안 generating 백그라운드.
- [ ] 모두 발언 카드에 **⚐ 마커** 또는 다른 색띠 두께로 일반 발언과 구분.
- [ ] 청크 도착 → 첫 발언이 카드 reveal 됨. 이전 모두 발언이 *위에 남아있음* (스크롤로 다시 볼 수 있음).
- [ ] **readingTime 체감** — 발언 사이 간격이 *읽기에 편안*. 너무 빨라서 못 따라가는 느낌 X.
- [ ] **청크 끝 → 갈림길 등장 사이 1.5초 여유** — *마지막 발언 음미할 시간*. 너무 빨리 패널 뜨지 않음.
- [ ] "토론 준비중" 라벨이 모든 곳에서 일관 (이미 출하).

---

## 7. 출하 단위

### ⑤-5e-A. 모두 발언 인트로 (블로킹, 핵심)

§3-A. types + lib/prompts/intro + useDebate.start + MessageCard 마커.

### ⑤-5e-B. Reveal 쿨타임 튜닝 (블로킹, 가벼움)

§3-B. lib/utils + useDebate 상수.

→ 한 PR 에 묶어도 OK (둘 다 작음).

---

## 8. 완료 후

- `backlog.md` 트랙 ⑤-5e → Done.
- ⑤-5b 의 *프메 식 컷신* 은 *⑤-5e 와 중복* 가능성 — 재평가. 모두 발언 카드가 이미 컷신 역할 일부 수행. ⑤-5b 워크오더 *컷신 부분* 후순위로 미루고 ⑤-5b 의 *결정 무게* 만 진행 권장.

---

## 부록 A — `generateIntroStatement` 본문 (Opus 박제 — 임의 수정 금지)

```ts
export function generateIntroStatement(
  concern: string,
  facilitator: CastMember | null,
): string {
  const name = facilitator?.name ?? '사회자';
  const firstSentence =
    concern.length <= 80
      ? concern.trim()
      : concern
          .split(/[.!?。\n]/)
          .map((s) => s.trim())
          .filter(Boolean)[0]
          ?.slice(0, 80) ?? concern.slice(0, 80);

  return `오늘 ${name} 가 진행을 맡습니다. 사용자가 들고 온 고민은 이겁니다 — "${firstSentence}". 이 자리에서 패널이 *직답을 주는 게 아니라*, 무엇이 진짜 결정해야 할 지점인지 함께 갈라봅니다. 시작합니다.`;
}
```

본문 그대로 박제. Sonnet 임의 수정 금지. *"직답을 주는 게 아니라"* 한 줄이 굴복 금지 톤의 핵심.

---

## 부록 B — MessageCard 의 intro 톤 디테일

```tsx
// MessageCard.tsx 안
const isIntro = message.kind === 'intro';
const borderLeftWidth = message.isKeyPoint ? 8 : isIntro ? 10 : 6;

// 발언자 행에 마커 추가
{isIntro && (
  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
    <Flag className="size-3" />
    모두 발언
  </span>
)}
```

`Flag` 는 lucide-react. 이미 import 돼있으면 재사용.
