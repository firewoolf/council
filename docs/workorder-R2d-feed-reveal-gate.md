# 작업 의뢰서 — R-2d: 피드 카드 reveal 레이어 + hook 게이트

> 담당: **Opus**(§A 엔진 게이트 — useDebate 재생부) / **Sonnet**(§B·§C — MessageCard·DebateFeed UI). 작성: Fable.
> 선행: R-2c 구현 완료(미커밋) — chooseTopic이 hook을 사용자 발언으로 append(useDebate.ts:743) + revealedMessages createdAt 정렬(:617). 본 워크오더는 그 위에 *reveal 지속시간 = 마스킹 윈도우*를 얹는다.
> 상위 명세: `workorder-debate-5-6-streaming.md` §rev2 §G, 판정 노트(2026-06-14).
> 대상 레포: `council/`.

---

## 0. 한 줄 목표

갈림길 선택 → hook(사용자 발언) 카드가 **글자단위로 타이핑**되고, 그 타이핑이 끝날 때까지 **다음 청크 첫 턴은 대기**한다. hook이 짧아 먼저 끝나면 thinking 비트가 받친다. 이 reveal 지속시간이 곧 백그라운드 생성을 가리는 윈도우다.

## 1. 진단 — 왜 지금 hook이 즉시 뜨는가

- `MessageCard`의 **사용자 카드 분기(:101~115)는 평범한 `<p>`**다 — TypewriterText 없음. 페르소나 턴만 `isLatest && onAdvance`일 때 타이핑한다(:290~300).
- 게다가 `DebateFeed`의 **`isLatest` 조건이 `m.speakerId !== null`로 사용자 카드를 명시 제외**한다(:273~277). 그래서 hook 카드는 *구조적으로* latest가 될 수 없고 → 타이핑 기회 자체가 없다.
- 결과: R-2c가 hook을 올바른 위치에 즉시 표시(빈 화면 0)까지는 했으나, "써주는 시간"이 없다.

## 2. 설계 — 게이트는 reveal 큐가 자연히 만든다

핵심 통찰: **다음 청크 첫 턴을 `revealedTurnCount=0`에 묶어두면, 그 턴은 `revealedMessages`에 안 들어가고 → hook 카드가 계속 최신(latest) → hook이 계속 타이핑된다.** 위치는 R-2c의 createdAt 정렬이, 타이밍은 이 게이트가 잡는다.

```
chooseTopic → hook append(createdAt=now) + 'generating'
   │  hook 카드 = latest → 타이핑 시작 (§B·§C)
   │  동시에 streamChunk 배후 생성 (R-2a)
   ▼
첫 턴 확정 → liveTurns 큐에 버퍼만. revealedTurnCount 0 유지 (§A 게이트)
   │  hook readingTime 경과 OR 사용자 탭 → 게이트 해제
   ▼
revealedTurnCount 진행 시작 → 첫 턴이 latest 승계 → 첫 턴 타이핑
   (hook readingTime 경과했는데 첫 턴 미도착 → thinking 비트, §C)
```

---

## §A. 엔진 게이트 — `hooks/useDebate.ts` ★Opus

목표: post-branch 청크의 **턴 0 reveal을 hook readingTime만큼 지연**.

- **chooseTopic(:733)**: hook append 시 게이트 무장 — `userUtteranceGateRef.current = { until: Date.now() + readingTime(hook.trim()) / speed }` (없으면 null). `readingTime`은 이미 import됨(:22). (isFirst 시작 경로는 hook 없음 → 게이트 null, 현행 동일.)
- **재생 effect(:530~575)**: 턴 0을 스케줄하기 직전 게이트 검사 추가 —
  ```ts
  // 턴 0 (post-branch) 은 hook 타이핑이 끝날 때까지 대기.
  if (revealedTurnCount === 0 && userUtteranceGateRef.current) {
    const remain = userUtteranceGateRef.current.until - Date.now();
    if (remain > 0) {
      revealTimerRef.current = setTimeout(() => {
        revealTimerRef.current = null;
        userUtteranceGateRef.current = null;   // 게이트 해제 → 다음 패스에서 턴 0 스케줄
        setRevealedTurnCount((c) => c);        // effect 재실행 트리거 (또는 bump ref)
      }, remain);
      return;
    }
    userUtteranceGateRef.current = null;
  }
  ```
  ※ 정확한 트리거 방식(상태 bump vs liveVersion)은 Opus 재량. 핵심 계약: **턴 0은 게이트 해제 후에만 스케줄**.
- **skipTurn(:723) / onAdvance**: 게이트 활성 중 탭이면 게이트 즉시 해제(`userUtteranceGateRef.current = null`) 후 진행 — 사용자가 hook을 건너뛰면 첫 턴이 바로 온다.
- **폴백/리셋**: `onFallback`·새 청크 진입·`resetPlayback`에서 게이트 ref 초기화. steering 복원 경로 무영향(게이트는 재생 중에만).
- **speed 반영**: 지연 = `readingTime(hook)/speed` — 2x면 hook 타이핑도 절반, 게이트도 절반.

무수정: streamChunk·저장 순서(부록 B)·턴 확정 규칙. 게이트는 *표시 타이밍*만 건드린다.

## §B. hook 카드 타이핑 — `components/debate/MessageCard.tsx` ★Sonnet

사용자 카드 분기(:101~115)를, **`kind === 'user-choice'` + `isLatest && onAdvance`일 때 TypewriterText로** 본문 렌더:

```tsx
// isUser 분기 본문 <p> 교체
{message.kind === 'user-choice' && isLatest && onAdvance ? (
  <TypewriterText text={message.content} speed={speed} onAdvance={onAdvance} />
) : (
  <p className="whitespace-pre-wrap text-base font-normal leading-relaxed text-text">
    {message.content}
  </p>
)}
```

- TypewriterText는 이미 import됨(:7). 페르소나 분기(:290~300)와 동일 패턴.
- 일반 사용자 발언(`submitSpeech` 등 kind 없는 사용자 카드)은 즉시 표시 유지 — 마스킹 대상 아님. **user-choice 카드만 타이핑.**

## §C. isLatest 허용 + thinking 비트 — `components/debate/DebateFeed.tsx` ★Sonnet

**C-1. isLatest 조건 완화(:273~277)** — user-choice 카드도 latest가 될 수 있게:

```tsx
isLatest={
  m.id === latestMessageId &&
  ((phase === 'playing' && m.speakerId !== null) ||
   ((phase === 'playing' || phase === 'generating') && m.kind === 'user-choice'))
}
```

- 이유: hook 카드는 `generating` 단계(배후 생성 중)에 latest다 — 그때 타이핑돼야 한다. 기존 페르소나 카드 동작은 그대로(`playing` + speakerId≠null).

**C-2. thinking 비트** — 기존 `TypingIndicator`(:288~290) 재사용. hook readingTime 끝났는데 첫 턴 미도착인 구간을 덮도록 노출 조건 확인:

- 현행: `{thinkingMember && phase === 'generating' && <TypingIndicator/>}`. post-branch는 `generating`이므로 `thinkingMemberId`가 세팅돼 있으면 이미 뜬다 → **thinkingMemberId 배선만 확인**(다음 발언 예정 화자 또는 사회자). 미세팅이면 useDebate에서 generating 중 후보 화자 1명을 thinkingMemberId로 노출.
- 새 모션·새 컴포넌트 금지. min-duration은 TypingIndicator의 기존 애니메이션으로 충분(깜빡임 시에만 추가 검토).

---

## 3. 데이터 계약 — `kind: 'user-choice'`

R-2c의 hook append(useDebate.ts:744)에 **`kind: 'user-choice'` 추가** 필요(현재 kind 없음). §B·§C가 이 kind로 분기한다. `submitCustomTopic` 경로(직접입력, hook 없음)는 §G-2대로 label을 본문으로 쓰되 동일 `user-choice` kind 부여 — 직접입력도 사용자 발언이므로 타이핑 일관.

> ⚠️ 구현 진입 시 확인: `Message['kind']` 타입(`types/debate.ts`)에 `'user-choice'` 유니온 추가. `submitSpeech`(useDebate.ts:758)에 기존 사용자 발언 kind가 있으면 충돌 없는지 점검.

## 4. 합격선

| 지표 | 합격선 |
| --- | --- |
| 갈림길 선택 → hook 카드 글자단위 타이핑 | 동작 (즉시 통짜 표시 아님) |
| hook 타이핑 종료 전 다음 청크 첫 턴 등장 | 0건 (게이트) |
| hook 타이핑 ↔ 첫 턴: 두 카드 동시 타이핑 | 0건 |
| hook 종료 후 첫 턴 미도착 구간 | thinking 비트로 덮임 (빈 화면 0) |
| 탭으로 hook 스킵 | 즉시 첫 턴 진행 |
| 일반 페르소나 턴 타이핑·skipTurn·speed·readingTime | 회귀 0 |
| 일반 사용자 발언(비-choice) 즉시 표시 | 회귀 0 |

## 5. 검증

- **라이브(운영자)**: 갈림길 여러 번 — hook이 또박또박 써지는지, 그 사이 다음 장면이 끊김 없이 이어지는지, hook 끝맛에 빈 구간 없는지. 2x 속도에서 hook·게이트 같이 빨라지는지. 탭 스킵.
- **기계**: typecheck/lint/build. `Message['kind']` 유니온 확장 반영. 게이트 ref가 streamChunk·저장 경로와 분리됐는지(표시 타이밍만).

## 6. 출하

- **R-2d-i (Opus)**: §A 게이트 + §3 kind 배선(엔진측).
- **R-2d-ii (Sonnet)**: §B + §C (MessageCard·DebateFeed).
- 한 PR로 묶어도 무방(작음). R-2c·언어락 머지 후.
