# 작업 의뢰서 — ⑤-5g: 발언자 스포트라이트 (토론 중 "사람이 얘기하는 형태")

> 담당: Codex / Cursor (도구 무관 — 이 문서는 자기완결적으로 작성됨)
> 작성: Opus (설계)
> 대상 레포: `council/` (Next.js 14 App Router, TypeScript strict, Tailwind v3, shadcn/ui)
> 선행 상태: ⑤-5f-A 반신 일러스트 자산 `public/personas/portraits/{archetypeId}.webp` 배포됨(git 커밋 완료). ⑤-5a~5f 시각/사운드/일러스트 레이어 출하 완료.

---

## 0. 한 줄 목표

토론 중 **지금 말하는 페르소나의 반신 일러스트를 크게** 무대에 띄워, 28px 동그라미가 아니라 *사람이 얘기하는* 형태로 만든다. 비주얼 노벨/동급생 식 발언자 무대. 단, 스크롤 텍스트 피드는 그대로 두고 **그 위에 덧대는 표시 레이어**다.

---

## 1. 배경 — 진단 (2026-06-06)

사용자 피드백: "토론 진행할 때 최소한 페르소나 이미지가 나오고 사람이 얘기하는 형태로 가야 하는 거 아냐?"

현재 토론 중 발언자 표현은 **두 곳뿐, 둘 다 작다**:
- `MessageCard` 발언자 줄의 28px `PersonaOrb`(원형 크롭)
- `PersonaStageStrip` 상단 40px orb 줄

반신 일러스트(1024² 유화 톤)는 `PersonaDetailDrawer`(orb 클릭 시)에서만 크게 보인다. 즉 **토론을 *읽는* 동안엔 캐릭터 얼굴이 사실상 안 보인다.** 순차 reveal 엔진(`useDebate`)은 이미 발언을 하나씩 드러내므로(아래 §6 불변), 여기에 *큰 화자 그림*만 얹으면 몰입이 완성된다.

---

## 2. 절대 원칙

1. **표시 전용 레이어** — 재생 엔진(`useDebate`)·프롬프트·LLM 호출 일절 손대지 않는다. `activeSpeakerId`/`thinkingMemberId` *구독만* 한다.
2. **CSS only** — `framer-motion`/`motion` 도입 금지. keyframe + Tailwind animate (기존 패턴: `globals.css` 에 keyframe, `tailwind.config.ts` 에 animation 등록).
3. **모바일 퍼스트** — 무대 + 스트립 합산 *고정(sticky)* 높이가 모바일 뷰포트의 ~45% 를 넘지 않게.
4. **폴백 안전** — archetype 출신이 아니거나(generated/custom) 이미지 자산이 없으면 그라디언트 + `PersonaOrb`(아이콘/이니셜)로 폴백. 크래시·빈 박스 금지.
5. **무대는 *고정*** — 피드가 새 발언마다 하단으로 자동 스크롤되므로, 스포트라이트가 위로 흘러가 사라지면 안 된다. **sticky 로 화면에 고정**되어야 발언 내내 화자가 보인다.
6. **무대 비활성 시 접힘** — `steering`/`idle`(말하는 사람도, 준비 중인 사람도 없을 때)엔 무대가 `null` 을 반환해 *공간을 차지하지 않는다*. 갈림길 패널이 화면을 온전히 쓰게.

---

## 3. 신규 컴포넌트 — `components/debate/SpeakerSpotlight.tsx`

```tsx
'use client';

import { useState } from 'react';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { LENS_LABEL_KR } from '@/lib/prompts/personas';
import { cn } from '@/lib/utils';
import type { CastMember } from '@/types/persona';

const PORTRAIT_BASE = '/personas/portraits';

interface SpeakerSpotlightProps {
  /** 무대에 올릴 화자. null 이면 무대 접힘. */
  speaker: CastMember | null;
  /** 'speaking'=발언 중 / 'thinking'=청크 생성 중 / 'idle'=접힘. */
  mode: 'speaking' | 'thinking' | 'idle';
  /** archetype 시그니처 한 줄. speaking 일 때만 표시(선택). */
  signatureLine?: string;
}

/**
 * ⑤-5g — 발언자 스포트라이트.
 * 지금 말하는(또는 준비 중인) 페르소나의 반신 일러스트를 크게 무대에 올린다.
 * 표시 전용 — 재생 엔진 무관. DebateFeed 가 sticky 헤더 안에서 렌더.
 */
export function SpeakerSpotlight({ speaker, mode, signatureLine }: SpeakerSpotlightProps) {
  const [errored, setErrored] = useState(false);

  // §2-6 — 접힘
  if (!speaker || mode === 'idle') return null;

  const portraitPath = speaker.archetypeId
    ? `${PORTRAIT_BASE}/${speaker.archetypeId}.webp`
    : undefined;
  const showPortrait = !!(portraitPath && !errored);

  return (
    <div
      key={speaker.id} // 화자 바뀌면 enter 애니 재생
      className={cn(
        'spotlight-enter relative w-full overflow-hidden rounded-2xl border',
        'h-32 sm:h-44', // 모바일 128px / 데스크탑 176px
        mode === 'thinking' && 'opacity-80',
      )}
      style={{
        borderColor: `${speaker.colorTo}66`,
        background: `linear-gradient(160deg, ${speaker.colorFrom}, ${speaker.colorTo})`,
      }}
      role="img"
      aria-label={`${speaker.name} ${mode === 'speaking' ? '발언 중' : '준비 중'}`}
    >
      {showPortrait ? (
        // native <img> — onError 폴백 필요(Next Image 아님).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portraitPath!}
          alt=""
          aria-hidden="true"
          onError={() => setErrored(true)}
          className="absolute inset-0 size-full object-cover"
          // 반신 일러스트 얼굴이 상단 1/3 — 상단 정렬(⑤-5f fix ⓐ 와 동일 의도)
          style={{ objectPosition: '50% 18%' }}
        />
      ) : (
        // 폴백: 그라디언트 위 orb(아이콘/이니셜)
        <div className="absolute inset-0 flex items-center justify-center">
          <PersonaOrb persona={speaker} size={80} glow="soft" />
        </div>
      )}

      {/* 발언 중 — 페르소나 색 인셋 링 맥동 */}
      {mode === 'speaking' && (
        <div
          className="pointer-events-none absolute inset-0 animate-spotlight-glow rounded-2xl"
          style={{ boxShadow: `inset 0 0 0 2px ${speaker.colorTo}` }}
          aria-hidden="true"
        />
      )}

      {/* 하단 그라디언트 + 이름/시그니처 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white drop-shadow sm:text-lg">
            {speaker.name}
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] leading-none text-white/90">
            {LENS_LABEL_KR[speaker.trait.lens]}
          </span>
          {mode === 'thinking' && (
            <span className="ml-auto animate-pulse text-[11px] text-white/70">준비 중…</span>
          )}
        </div>
        {mode === 'speaking' && signatureLine && (
          <p className="mt-1 line-clamp-1 text-xs italic text-white/85 drop-shadow sm:text-sm">
            &ldquo;{signatureLine}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}
```

> `LENS_LABEL_KR` 는 이미 `lib/prompts/personas/index.ts` 에서 export 됨(드로어/카드가 사용). `PersonaOrb` 의 폴백 3단(이미지→lucide→이니셜)을 그대로 재사용하므로 폴백 분기는 추가 코드 불필요.

---

## 4. 통합 — `components/debate/DebateFeed.tsx`

DebateFeed 는 이미 `cast`, `activeSpeakerId`, `thinkingMemberId`, `castMap`, `firstSpeakerMessageIds` 를 갖고 있고, 상단에 `stageStrip`(PersonaStageStrip)을 렌더한다. 여기에 스포트라이트를 *스트립 바로 아래 같은 sticky 영역* 으로 합친다.

### 4.1 화자/모드 파생 (컴포넌트 본문, `stageStrip` 정의 부근)

```tsx
import { SpeakerSpotlight } from './SpeakerSpotlight';
import { SIGNATURE_LINES } from '@/lib/prompts/personas';

// 활성 화자: 발언 중 우선, 없으면 준비 중.
const spotlightSpeaker = activeSpeakerId
  ? (castMap.get(activeSpeakerId) ?? null)
  : thinkingMemberId
    ? (castMap.get(thinkingMemberId) ?? null)
    : null;

const spotlightMode: 'speaking' | 'thinking' | 'idle' = activeSpeakerId
  ? 'speaking'
  : thinkingMemberId
    ? 'thinking'
    : 'idle';

const spotlightSig =
  spotlightMode === 'speaking' &&
  spotlightSpeaker?.source === 'archetype' &&
  spotlightSpeaker.archetypeId
    ? SIGNATURE_LINES[spotlightSpeaker.archetypeId]
    : undefined;
```

### 4.2 sticky 헤더로 묶기 (§2-5 핵심)

현재 `stageStrip` 은 자체적으로 `sticky top-0 z-20` 다. 스포트라이트가 스트립과 *함께 고정* 되도록 **둘을 하나의 sticky 래퍼로 감싼다.**

```tsx
// 기존 stageStrip 정의는 유지하되, 렌더 시 아래 헤더로 감싼다.
const stageHeader = (
  <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-2 bg-background/90 px-4 pb-2 backdrop-blur sm:-mx-6 sm:px-6">
    {stageStrip}
    <SpeakerSpotlight
      speaker={spotlightSpeaker}
      mode={spotlightMode}
      signatureLine={spotlightSig}
    />
  </div>
);
```

- PersonaStageStrip 내부의 `sticky top-0 z-20 -mx-4 ... bg-background/90 backdrop-blur` 가 래퍼와 중복된다. **스트립 컴포넌트는 손대지 말고**, 래퍼가 바깥에서 sticky 를 담당하게 둔다(이중 sticky 는 시각 회귀 없음). 정 거슬리면 스트립의 `sticky`/`-mx`/`bg`/`backdrop` 만 빼는 소정리는 허용 — 단 스트립 *내부 레이아웃*(orb 줄, 활성 확대)은 회귀 금지.
- 두 곳의 `{stageStrip}` 사용처를 `{stageHeader}` 로 교체:
  - 빈 상태 분기(`messages.length === 0 && emptyHint`) 의 `{stageStrip}` → `{stageHeader}`.
  - 메인 return 의 `{stageStrip}` → `{stageHeader}`.
- `idle`/`steering` 에선 `SpeakerSpotlight` 가 `null` → 헤더는 스트립만 남아 기존과 동일.

> 모바일 고정 높이: 스트립(~64px) + 스포트라이트(128px) ≈ 192px. 일반적 모바일 뷰포트(≥700px)에서 45% 이하. §2-3 충족.

---

## 5. CSS — `app/globals.css` + `tailwind.config.ts`

### 5.1 `app/globals.css` (기존 `@keyframes` 들 근처에 추가)

```css
/* ⑤-5g — 발언자 스포트라이트 진입(화자 전환 시) */
@keyframes spotlight-enter {
  from { opacity: 0; transform: translateY(6px) scale(0.99); }
  to   { opacity: 1; transform: none; }
}
.spotlight-enter {
  animation: spotlight-enter 0.35s ease-out;
}

/* ⑤-5g — 발언 중 인셋 링 맥동 */
@keyframes spotlight-glow {
  0%, 100% { opacity: 0.45; }
  50%      { opacity: 1; }
}
```

> `.spotlight-enter` 는 `.drawer-enter` 와 동일하게 *클래스* 로 둔다(키 변경 시 재생). `prefers-reduced-motion` 대응이 기존에 있으면 동일 블록에 추가 권장.

### 5.2 `tailwind.config.ts` — `extend.animation` 에 한 줄

```ts
'spotlight-glow': 'spotlight-glow 1.8s ease-in-out infinite',
```

(기존 `keypoint-pulse`/`orb-pulse` 등록 패턴과 동일. keyframe 본문은 globals.css 가 담당.)

---

## 6. 손대지 말 것 (불변)

- **`hooks/useDebate.ts` 재생 엔진** — 순차 reveal(`revealedTurnCount`/`readingTime`/`INTER_CHUNK_COOLDOWN_MS`)·phase 머신·`generateChunk` 일절 변경 금지. 스포트라이트는 *읽기만*.
- **`lib/prompts/*` · `BASE_PROMPT` · directive · `composePersonaPrompt`** — 프롬프트 무관.
- **`lib/ai/*`** — LLM 호출 무관.
- **`PersonaStageStrip` 내부 레이아웃** — orb 줄·활성 화자 확대·가로 스크롤 회귀 금지(§4.2 의 sticky 정리만 허용).
- **`MessageCard`** — 28px orb·시그니처(첫 발언)·Aha 맥동 그대로. (스포트라이트의 시그니처와 첫 발언에 한해 잠깐 중복돼도 무방 — 정체성 강화로 허용.)
- **자산 파일 / `PersonaOrb`** — 폴백 체인 그대로 재사용, 수정 불필요.
- `framer-motion`/`motion` 도입 금지.

---

## 7. 영향 파일 맵

```
신규:
  components/debate/SpeakerSpotlight.tsx     §3

갱신:
  components/debate/DebateFeed.tsx           §4 — 화자/모드 파생 + sticky 헤더 래퍼
  app/globals.css                            §5.1 — spotlight-enter / spotlight-glow keyframe
  tailwind.config.ts                         §5.2 — animate-spotlight-glow 등록
```

총 4개(신규 1 + 갱신 3). `useDebate`·`PersonaStageStrip`·`MessageCard`·프롬프트·AI 무수정.

---

## 8. 검증 기준

### 8.1 자동

- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` 통과.
- [ ] 자산 배포 확인 — 빌드 후 `/personas/portraits/jobs-designer.webp` 가 200 (404 면 git 커밋 누락 재확인).

### 8.2 사람 검증

- [ ] 토론 재생 중 — *지금 말하는* 페르소나의 반신 일러스트가 무대에 크게 뜨고, 발언이 바뀔 때마다 화자 그림이 *부드럽게 전환*(spotlight-enter).
- [ ] 발언 중 무대에 페르소나 색 인셋 링이 *맥동*.
- [ ] 청크 생성 중(`generating`) — 준비 중 화자(사회자 우선) 그림 + "준비 중…" 표시.
- [ ] 피드를 아래로 스크롤해도 무대가 *상단 고정* 유지(sticky) — 발언자가 사라지지 않음.
- [ ] `steering`(갈림길) 진입 시 무대 *접힘* — 갈림길 패널이 공간을 온전히 씀.
- [ ] generated/custom 멤버 또는 이미지 누락 시 — 그라디언트 + orb 폴백, 깨진 이미지/빈 박스 없음.
- [ ] 모바일 375px — 스트립 + 무대 고정 높이가 화면을 과하게 먹지 않음(≤ ~45%).
- [ ] 기존 회귀 없음 — 순차 reveal, 자동 스크롤, StageStrip 클릭→드로어, 사운드 정상.

---

## 9. 완료 후

- `backlog.md` Active 에 ⑤-5g 추가 → 완주 시 Done.
- 후속 옵션(이번 범위 아님): 데스크탑(sm+)에서 무대를 *좌측 세로 패널*로 분리 / playing 중 StageStrip 접고 무대만 노출(세로 budget 절약) / 무대 클릭 → DetailDrawer.
```
