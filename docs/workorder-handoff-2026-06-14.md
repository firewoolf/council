# 작업 지시서 — 2026-06-14 핸드오프 (언어 락 + R-2 rev2 §G)

> 수신: 구현 세션 — **Sonnet**(작업 A 전부 + B-2) / **Opus**(B-1 코어). 발신: Fable.
> 정본 명세(전체): `workorder-prompt-language-lock.md`, `workorder-debate-5-6-streaming.md`(§rev2). **충돌 시 그 워크오더 본문이 정본**, 본 지시서는 실행 순서·터치포인트·합격 게이트의 1장 압축이다.
> 레포: `council/`. 전제: 인사이트 트랙 I-1~I-3 + R-1.5b′ 미커밋분 위에서 작업 가능. 무대(DebateStage) 폐기됨 → reveal 표면 = 피드 카드. 보여주기(P-B·R-3'·⑤-5) 동결.

## 실행 순서 (의존)

```
작업 A  언어 락 (Sonnet, 독립·저위험, 프롬프트 텍스트만)  ── 즉시·먼저 머지 가능
작업 B  R-2 rev2 §G (Opus 게이트 → Sonnet UI)            ── R-2a 미커밋분 위 적층
```

A와 B는 무관 — **별도 PR**. A를 먼저 머지하고 B를 진행한다.

---

## 작업 A — 출력 언어 락 (Sonnet)

**대상**: `lib/prompts/orchestrator.ts` (프롬프트 문자열만, 스키마·로직·description 무수정)

**A-1.** `buildConclusionPrompt`의 `[금지 사항]` 블록(:299~304)에 아래를 추가:

```
[출력 언어 — 절대 규칙]
- 모든 필드(consensus · divided.topic · positions.side · openQuestions)는
  한국어로만 쓴다. 한국어 제목·문장에 영어 단어를 섞지 마라.
- 일반 명사의 영어 표기 금지: "checklist" → "점검 목록", "then" → "그다음",
  "through" → "통과". (예외는 코드·제품 고유명사·브랜드명뿐.)
- 제목에 마커 기호(✦, ★, ✓ 등)를 넣지 마라. 강조 표시는 UI가 붙인다.
  텍스트 필드에는 순수 내용만 담는다.
```

**A-2.** `buildChunkPrompt` nextTopics 규칙("label 은 짧은 제목…" :175 아래)에 한 줄:

```
- label·hook 은 한국어로만 쓴다. 영어 단어 혼용·마커 기호(✦ 등) 금지.
```

**합격선 (A)**: 동일 고민 3개 재생성 → divided.topic·side·openQuestions·nextTopics(label/hook)에 영어 단어 0건(고유명사 제외) + ✦/★ 마커 0건. 결론 구조·evidenceMessageIds 추적 회귀 0.
**PR**: `prompt-language-lock` 단독.

---

## 작업 B — R-2 rev2 §G 분기 경계 프리페치 (Opus 게이트 + Sonnet UI)

**의도**: 갈림길 선택 → 사용자가 *고른 토픽을 회의실 맥락에서 정제해 설명*하는 한 마디를 피드에 즉시 띄운다(겉). 그 발언이 타이핑되는 시간 동안 백그라운드로 다음 청크를 생성해 대기시간을 번다(속내). 정제 설명은 **추가 LLM 호출 0** — 기존 nextTopics `hook`을 재사용.

### B-1 (Opus) — `chooseTopic` 게이트 전환 · `hooks/useDebate.ts:730`

- `chooseTopic(label, hook)` — `hook`을 더 이상 `void`하지 않는다(현행 :732 `void _hook` 제거).
- **① 사용자 발언 즉시 append**: `kind:'user-choice'`, `speakerId: null`, `content = hook ? hook : label`. (`speakerId:null`은 결론 프롬프트가 이미 `[사용자]`로 처리 — orchestrator.ts:222, 무결성 OK.)
- **② 동시에** `setPhase('generating')` + 트리거 — 생성과 발언 reveal **병렬**(발언 완료를 기다리지 말 것, 그러면 윈도우 0).
- **재생 게이트**: 다음 청크 첫 턴은 `userUtteranceRevealedRef === true` 후에만 소비. 그전 도착 턴은 `liveTurnsRef`에 버퍼만.
- **순서 보장**: 발언 reveal 완료 전 첫 턴 도착 → 버퍼링, 완료 후 이어 재생. **역전 0건.**
- **폴백**: 발언 다 reveal했는데 첫 턴 미도착 → 본문 §3-C 'thinking' 대기 비트 재사용(피드 하단). min-duration으로 깜빡임 방지.
- `submitCustomTopic`(직접입력, :744) 경로는 hook 없음 → label 자체를 발언 본문으로.
- `updateChunkChoice`(:735, 항로 데이터) 호출 유지.
- 의사코드 = `workorder-debate-5-6-streaming.md` 부록 D.

### B-2 (Sonnet) — 사용자 발언 카드 + 피드 TypewriterText 재바인딩

> **판정 (2026-06-14, Fable) — B-2는 한다. "hook 타이핑"이 아니라 "피드 카드 reveal 레이어"로 스코프.**
> 이유: ① David 의도의 핵심이 "써주는 *시간*" = reveal 지속시간이 곧 마스킹 윈도우. 즉시 표시엔 그 시간이 없다. ② 패널 턴이 타이핑되는데 사용자 카드만 즉시 뜨면 시각 seam. ③ §G 목적("대기 절감")은 reveal 지속 없이는 "빈 화면 0"만 달성 — 절반. R-2c(현재 변경)는 그대로 머지하되, R-2d로 아래를 마저 한다.

**R-2d 스코프 (확정):**

- **피드 카드 글자단위 reveal — 패널 턴 + 사용자 hook 카드에 *일관* 적용**(같은 reveal 문법). `prefers-reduced-motion`·탭=즉시 완성. 정본 §3-E 무대 TypewriterText 대상 → 피드 `MessageCard` 본문으로 재바인딩. (무대 폐기로 피드 카드용 reveal이 없으면 신설 — Sonnet 닫힘.)
- **reveal 게이트**: 다음 청크 첫 턴 reveal은 **hook 카드 reveal 완료 후 시작**(`userUtteranceRevealedRef`). 두 카드 동시 타이핑 방지. ← createdAt 정렬(R-2c)이 *위치*를 잡았다면, 이 게이트가 *타이밍*을 잡는다.
- **큐 공백 thinking 비트**: hook reveal 끝났는데 첫 턴 미도착 → 피드 하단 orb 맥동(새 모션 금지). hook이 짧아 reveal<생성이면 이 비트가 나머지를 덮는다. min-duration으로 깜빡임 방지. **이게 마스킹을 완성하는 조각** — 타이핑만으론 짧은 hook을 못 덮는다.

### 구현 진입 시 확인 의무

`submitSpeech`(useDebate.ts:758)에 이미 "토론 중 사용자 발언" kind·speakerId 규약이 있는지 먼저 확인 → **있으면 그 규약 재사용**, 없으면 `user-choice` 신설.

**합격선 (B)**:

| 지표 | 합격선 |
| --- | --- |
| 갈림길 선택 → 사용자 발언 카드 등장 | 즉시 (0 dead wait) |
| 발언 reveal 종료 → 다음 청크 첫 턴 | 끊김 청크당 ≤1 (이상 시 0) |
| 사용자 발언 ↔ 다음 청크 순서 역전 | 0건 |
| 분기 경계 빈 화면/스피너 노출 | 0건 |

**PR**: R-2c(Opus, B-1) / R-2d(Sonnet, B-2) 분리.

---

## 검증 (운영자, 공급사 3종)

- **A**: 같은 고민으로 결론·청크 재생성 → 영어 단어·✦ 마커 사라졌는지 눈으로.
- **B**: 갈림길 여러 번 타며 — ① 내 발언이 선택 직후 뜨는지 ② 그 사이 다음 장면이 끊김 없이 이어지는지 ③ 발언↔장면 순서 안 꼬이는지. Groq/Cerebras/Gemini 각 1회.

## 기계 검증

- typecheck / lint / build. A: 스키마·로직 무수정 확인. B: `liveTurnsRef`와 생성 인플라이트가 별도 상태로 유지(한 await에 안 묶임 — "배치 느낌" 회귀 방지).

## 커밋 / 머지 순서

1. `prompt-language-lock` (독립, 먼저)
2. R-2c → R-2d
3. 본 작업 전, I-1~I-3 + R-1.5b′ 미커밋분은 **트랙별 분리 커밋** 권고(회귀 시 이분탐색).
