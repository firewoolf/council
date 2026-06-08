# 작업 의뢰서 — ⑤-5h: 토론 무대 (VN 전체 무대 + 배경 선택)

> 담당: Codex / Cursor (도구 무관 — 자기완결)
> 작성: Opus (설계)
> 대상 레포: `council/` (Next.js 14 App Router, TS strict, Tailwind v3, Zustand v5 persist)
> 선행: ⑤-5g 스포트라이트(미배포)·⑤-5f 초상화. **이 워크오더가 ⑤-5g 의 작은 sticky 무대를 *전체 무대* 로 키운다.**
> 에셋: `docs/asset-spec-5-5h.md` (David 가 컷아웃 10 + 배경 6 생성). **에셋 0개여도 폴백으로 머지·배포 가능.**

---

## 0. 한 줄 목표

비주얼 노벨처럼 — 재생 중 *선택한 배경* 위에 *지금 말하는 페르소나의 대형 반신 컷아웃* 이 화면을 장악하고, 발언은 하단 대사 박스. 텍스트 기록(대화록)은 토글로 별도. 삼국지/RPG 무장 시뮬의 무대감.

---

## 1. 사용자 결정 (2026-06-06, 확정)

- **무대 방식:** 비주얼 노벨 *전체 무대*. 재생 중엔 무대가 주 화면, 카드 피드는 *대화록 토글* 로 분리.
- **캐릭터 에셋:** 반신 *투명 컷아웃*(배경 없음). 어떤 배경에도 합성.
- **배경 선택:** 세션 *시작 시 선택 + 라이브 전환*. 세션별 저장.

레퍼런스: 삼국지 시리즈 — 대형 인물 + 장면 배경 + 하단 대사 박스.

---

## 2. 절대 원칙

1. **표시 전용** — `useDebate` 재생 엔진·순차 reveal·phase 머신·`generateChunk`·프롬프트·`lib/ai/*` 일절 수정 금지. *구독·액션 호출만*.
2. **CSS only** — `framer-motion` 금지. keyframe + Tailwind.
3. **모바일 퍼스트** — 무대가 모바일 첫 화면을 장악(세로 ~60vh). 캐릭터 하단 정렬, 얼굴은 상단에 보이게.
4. **에셋 폴백 불변** — 컷아웃 없음 → 기존 `portraits/{id}.webp` → `PersonaOrb`. 배경 없음 → `--stage-bg` 그라디언트. *깨진 이미지/빈 박스 금지*. 코드는 에셋 0개로도 빌드·배포.
5. **회귀 금지** — 자동 스크롤·사운드·SteeringPanel·PersonaDetailPanel·DebateControls·DebateFeed 기존 기능 보존. 대화록은 *기존 `DebateFeed` 를 그대로 재사용*.
6. **세션 스토어 무수정** — 배경 상태는 *격리된 신규 `store/stage.ts`* 에. 마이그레이션 많은 `store/sessions.ts` 손대지 말 것.

---

## 3. 신규 — 배경 레지스트리 `lib/stage/backgrounds.ts`

```ts
export interface StageBackground {
  id: string;
  label: string;
  path: string;
}

/** ⑤-5h — 무대 배경 카탈로그. 에셋: public/stages/backgrounds/{id}.webp */
export const STAGE_BACKGROUNDS: StageBackground[] = [
  { id: 'meeting-room', label: '회의실',   path: '/stages/backgrounds/meeting-room.webp' },
  { id: 'office',       label: '사무실',   path: '/stages/backgrounds/office.webp' },
  { id: 'study',        label: '서재',     path: '/stages/backgrounds/study.webp' },
  { id: 'courtroom',    label: '법정',     path: '/stages/backgrounds/courtroom.webp' },
  { id: 'cafe',         label: '카페',     path: '/stages/backgrounds/cafe.webp' },
  { id: 'studio',       label: '중립 무대', path: '/stages/backgrounds/studio.webp' },
];

export const DEFAULT_BACKGROUND_ID = 'studio';

export function backgroundById(id: string | undefined): StageBackground {
  return (
    STAGE_BACKGROUNDS.find((b) => b.id === id) ??
    STAGE_BACKGROUNDS.find((b) => b.id === DEFAULT_BACKGROUND_ID)!
  );
}
```

---

## 4. 신규 — 배경 스토어 `store/stage.ts` (격리)

```ts
'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface StageState {
  /** sessionId → backgroundId */
  backgroundBySession: Record<string, string>;
  setBackground: (sessionId: string, backgroundId: string) => void;
}

export const useStageStore = create<StageState>()(
  persist(
    (set) => ({
      backgroundBySession: {},
      setBackground: (sessionId, backgroundId) =>
        set((s) => ({
          backgroundBySession: { ...s.backgroundBySession, [sessionId]: backgroundId },
        })),
    }),
    { name: 'council-stage', storage: createJSONStorage(() => localStorage) },
  ),
);
```

---

## 5. 신규 — `components/debate/DebateStage.tsx` (히어로 무대)

```tsx
'use client';

import { useState } from 'react';
import { Image as ImageIcon, ScrollText, ChevronDown } from 'lucide-react';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { backgroundById } from '@/lib/stage/backgrounds';
import { cn } from '@/lib/utils';
import type { CastMember } from '@/types/persona';

interface DebateStageProps {
  /** 현재 화자(발언 중) 또는 준비 중 멤버. null 이면 무대 비움. */
  speaker: CastMember | null;
  mode: 'speaking' | 'thinking' | 'idle';
  /** 현재(최근 reveal) 발언 본문. */
  line?: string;
  /** speaking 첫 등장 시그니처(선택). */
  signatureLine?: string;
  backgroundId: string;
  /** 대사 박스 탭 → 다음 턴(skipTurn). */
  onAdvance?: () => void;
  onOpenBackground: () => void;
  onOpenTranscript: () => void;
}

const CUTOUT_BASE = '/personas/cutouts';
const PORTRAIT_BASE = '/personas/portraits';

export function DebateStage({
  speaker, mode, line, signatureLine, backgroundId,
  onAdvance, onOpenBackground, onOpenTranscript,
}: DebateStageProps) {
  const [bgErrored, setBgErrored] = useState(false);
  // 캐릭터 폴백 단계: 0=컷아웃, 1=초상화, 2=orb
  const [charStage, setCharStage] = useState(0);

  const bg = backgroundById(backgroundId);
  const archId = speaker?.archetypeId;
  const charSrc =
    archId && charStage === 0 ? `${CUTOUT_BASE}/${archId}.png`
    : archId && charStage === 1 ? `${PORTRAIT_BASE}/${archId}.webp`
    : undefined;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border h-[60vh] min-h-[340px] sm:h-[66vh]">
      {/* 배경 */}
      {!bgErrored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bg.path} alt="" aria-hidden="true"
          onError={() => setBgErrored(true)}
          className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: 'var(--stage-bg)' }} aria-hidden="true" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" aria-hidden="true" />

      {/* 캐릭터 컷아웃 (하단 정렬, 화자 전환 시 enter 애니) */}
      {speaker && charSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${speaker.id}-${charStage}`} src={charSrc} alt=""
          aria-hidden="true"
          onError={() => setCharStage((s) => s + 1)}
          className={cn(
            'stage-char-enter absolute inset-x-0 bottom-0 mx-auto h-[90%] object-contain object-bottom',
            mode === 'thinking' && 'opacity-70 saturate-[0.85]',
          )} />
      ) : speaker ? (
        <div className="absolute inset-0 flex items-end justify-center pb-16">
          <PersonaOrb persona={speaker} size={140} glow="strong" />
        </div>
      ) : null}

      {/* 상단 컨트롤 — 배경/대화록 */}
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button type="button" onClick={onOpenBackground} aria-label="배경 변경"
          className="flex size-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur hover:bg-black/60">
          <ImageIcon className="size-4" />
        </button>
        <button type="button" onClick={onOpenTranscript} aria-label="대화록 보기"
          className="flex size-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur hover:bg-black/60">
          <ScrollText className="size-4" />
        </button>
      </div>

      {/* 준비 중 표시 */}
      {mode === 'thinking' && (
        <div className="absolute left-3 top-3 z-10 animate-pulse rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur">
          {speaker?.name ?? '패널'} 준비 중…
        </div>
      )}

      {/* 하단 대사 박스 — 탭하면 다음 턴 */}
      {speaker && (mode === 'speaking') && (
        <button type="button" onClick={onAdvance}
          className="absolute inset-x-0 bottom-0 z-10 cursor-pointer text-left">
          <div className="m-3 rounded-xl border border-white/15 bg-black/65 p-4 backdrop-blur">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-md px-2 py-0.5 text-sm font-bold text-white"
                style={{ background: `${speaker.colorTo}cc` }}>
                {speaker.name}
              </span>
              <ChevronDown className="ml-auto size-4 animate-bounce text-white/60" aria-hidden="true" />
            </div>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/95">
              {line ?? (signatureLine ? `“${signatureLine}”` : '')}
            </p>
          </div>
        </button>
      )}
    </div>
  );
}
```

> 캐릭터 폴백 3단(컷아웃→초상화→orb)을 `charStage` 로 구현. `onError` 가 한 단계씩 내림. 배경 폴백은 `bgErrored` → `--stage-bg`.

---

## 6. 신규 — `components/debate/BackgroundPicker.tsx` (하단 시트)

`PersonaDetailDrawer` 의 bottom-sheet 패턴(모바일 `inset-x-0 bottom-0`, 데스크탑 우측) 재사용. `STAGE_BACKGROUNDS` 썸네일 그리드, 선택 → `setBackground(sessionId, id)` + 닫기. 썸네일 이미지 `onError` 시 라벨만 표시(에셋 누락 폴백). ESC/오버레이 클릭 닫기.

```tsx
'use client';
import { X } from 'lucide-react';
import { STAGE_BACKGROUNDS } from '@/lib/stage/backgrounds';
import { useStageStore } from '@/store/stage';
import { cn } from '@/lib/utils';

export function BackgroundPicker({
  sessionId, currentId, open, onClose,
}: { sessionId: string; currentId: string; open: boolean; onClose: () => void }) {
  const setBackground = useStageStore((s) => s.setBackground);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[39] animate-fade-in bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="배경 선택"
        className="drawer-enter fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-4 sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:w-[420px] sm:rounded-l-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-text">배경 선택</p>
          <button onClick={onClose} aria-label="닫기" className="text-text-muted hover:text-text"><X className="size-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {STAGE_BACKGROUNDS.map((b) => (
            <button key={b.id} type="button"
              onClick={() => { setBackground(sessionId, b.id); onClose(); }}
              className={cn('relative aspect-video overflow-hidden rounded-lg border text-left',
                b.id === currentId ? 'border-primary ring-2 ring-primary/40' : 'border-border')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.path} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              <span className="absolute bottom-1 left-2 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[11px] text-white backdrop-blur">{b.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
```

---

## 7. 통합 — `app/(main)/session/[id]/page.tsx`

### 7.1 상태·파생

```tsx
import { useStageStore } from '@/store/stage';
import { DEFAULT_BACKGROUND_ID } from '@/lib/stage/backgrounds';
import { DebateStage } from '@/components/debate/DebateStage';
import { BackgroundPicker } from '@/components/debate/BackgroundPicker';
import { SIGNATURE_LINES } from '@/lib/prompts/personas';

const backgroundId = useStageStore((s) => s.backgroundBySession[id]) ?? DEFAULT_BACKGROUND_ID;
const [bgPickerOpen, setBgPickerOpen] = useState(false);
const [transcriptOpen, setTranscriptOpen] = useState(false);

// 무대 화자/모드/대사 파생 (엔진 무수정 — 노출값만 사용)
const stageSpeaker =
  activeSpeakerId ? (cast.find((c) => c.id === activeSpeakerId) ?? null)
  : thinkingMemberId ? (cast.find((c) => c.id === thinkingMemberId) ?? null)
  : null;
const stageMode: 'speaking' | 'thinking' | 'idle' =
  activeSpeakerId ? 'speaking' : thinkingMemberId ? 'thinking' : 'idle';
const lastRevealed = revealedMessages[revealedMessages.length - 1] ?? null;
const stageLine =
  stageMode === 'speaking' && lastRevealed && lastRevealed.speakerId === stageSpeaker?.id
    ? lastRevealed.content : undefined;
const stageSig =
  stageMode === 'speaking' && stageSpeaker?.source === 'archetype' && stageSpeaker.archetypeId
    ? SIGNATURE_LINES[stageSpeaker.archetypeId] : undefined;

const stageActive = phase === 'generating' || phase === 'playing' || phase === 'steering';
```

### 7.2 렌더 — 무대가 주 화면, 피드는 대화록 토글로

- `stageActive` 일 때: 기존 인라인 `<DebateFeed …/>` *대신* `<DebateStage …/>` 를 렌더.
- 대화록: 토글(`transcriptOpen`)이 열리면 *기존 `DebateFeed` 를 그대로* 시트/오버레이로 렌더(히스토리·디렉션·반박·페르소나 드로어 기능 보존). 닫기 버튼 포함.
- `steering` 단계: 무대 아래(또는 위 오버레이)에 기존 `<SteeringPanel>` 그대로.
- `idle`/`concluded`: 기존 UI 유지(무대 미표시).

```tsx
{stageActive ? (
  <>
    <DebateStage
      speaker={stageSpeaker} mode={stageMode}
      line={stageLine} signatureLine={stageSig}
      backgroundId={backgroundId}
      onAdvance={actions.skipTurn}
      onOpenBackground={() => setBgPickerOpen(true)}
      onOpenTranscript={() => setTranscriptOpen(true)}
    />
    {phase === 'steering' && currentChunk && (
      <SteeringPanel chunk={currentChunk} onChoose={actions.chooseTopic}
        onCustom={actions.submitCustomTopic} onConclude={actions.conclude} />
    )}
  </>
) : (
  /* 기존 인라인 피드 (idle 빈 힌트 등) */
  <DebateFeed messages={revealedMessages} cast={cast} chunks={chunks}
    activeSpeakerId={activeSpeakerId} thinkingMemberId={thinkingMemberId}
    onSelectMember={setSelectedMemberId} onDirect={actions.submitDirection}
    emptyHint={phase === 'idle' ? '"토론 시작"을 누르면 패널이 모입니다.' : undefined} />
)}

{/* 대화록 오버레이 — 기존 DebateFeed 재사용 */}
{transcriptOpen && (
  <div className="fixed inset-0 z-[35] flex flex-col bg-background">
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <p className="text-sm font-semibold text-text">대화록</p>
      <button onClick={() => setTranscriptOpen(false)} aria-label="닫기"
        className="text-text-muted hover:text-text"><X className="size-4" /></button>
    </div>
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <DebateFeed messages={revealedMessages} cast={cast} chunks={chunks}
        activeSpeakerId={activeSpeakerId} thinkingMemberId={thinkingMemberId}
        onSelectMember={setSelectedMemberId} onDirect={actions.submitDirection} />
    </div>
  </div>
)}

<BackgroundPicker sessionId={id} currentId={backgroundId}
  open={bgPickerOpen} onClose={() => setBgPickerOpen(false)} />
```

> `WaitingMemoArea`(generating 중 메모)·`DebateControls`·`PersonaDetailDrawer` 는 기존 위치 유지. WaitingMemoArea 는 무대 아래에 그대로 둬도 됨(generating 중 노출).

---

## 8. CSS — `app/globals.css`

```css
/* ⑤-5h — 무대 캐릭터 진입(화자 전환) */
@keyframes stage-char-enter {
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to   { opacity: 1; transform: none; }
}
.stage-char-enter { animation: stage-char-enter 0.4s ease-out; }
```

`prefers-reduced-motion` 블록이 있으면 거기에 `.stage-char-enter { animation: none; }` 추가 권장. tailwind 신규 등록 불필요(`animate-fade-in`/`animate-bounce`/`animate-pulse` 기존 사용).

---

## 9. 손대지 말 것

- `hooks/useDebate.ts`(엔진·순차 reveal·phase) / `lib/prompts/*` / `BASE_PROMPT` / `lib/ai/*` — 무수정.
- `store/sessions.ts`(마이그레이션) — 배경은 `store/stage.ts` 격리.
- `MessageCard` / `PersonaOrb` / `PersonaStageStrip` / `DebateFeed` — 무수정(대화록으로 *재사용*만).
- `framer-motion` 금지.
- ⑤-5g `SpeakerSpotlight` — 제거 불필요. `DebateFeed` 안에 남아 대화록에서 보임(무해). 손대지 말 것.

---

## 10. 영향 파일 맵

```
신규:
  lib/stage/backgrounds.ts            §3 배경 레지스트리
  store/stage.ts                      §4 배경 스토어(격리)
  components/debate/DebateStage.tsx   §5 히어로 무대
  components/debate/BackgroundPicker.tsx §6 배경 시트

갱신:
  app/(main)/session/[id]/page.tsx    §7 무대/대화록 뷰 스위치 + picker
  app/globals.css                     §8 stage-char-enter

에셋(David, 별도):
  public/personas/cutouts/{archetypeId}.png   컷아웃 10
  public/stages/backgrounds/{id}.webp          배경 6
```

신규 4 + 갱신 2. 엔진/프롬프트/AI/세션스토어/MessageCard/PersonaOrb 무수정.

---

## 11. 검증 기준

### 11.1 자동
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` 통과.
- [ ] 에셋 0개 상태에서도 빌드·렌더 — 컷아웃/배경 404 시 폴백(초상화→orb / 그라디언트), 깨진 이미지·빈 박스 없음.

### 11.2 사람 검증
- [ ] 재생 중 — 선택 배경 위에 *대형 캐릭터* 가 화면을 장악, 하단 대사 박스에 현재 발언. 발언 바뀌면 캐릭터 *전환 애니*.
- [ ] 대사 박스 탭 → 다음 턴(skipTurn) 즉시 진행.
- [ ] 배경 버튼 → picker → 선택 시 *라이브로 배경 바뀜* + 새로고침 후 유지(세션별 저장).
- [ ] 대화록 버튼 → 기존 카드 피드(히스토리·반박·디렉션·페르소나 드로어) 정상.
- [ ] generating 중 — 준비 중 멤버(사회자) 무대 + "준비 중…".
- [ ] steering — SteeringPanel 정상, 결론 동선 정상.
- [ ] 모바일 375px — 무대가 첫 화면 장악(≥55vh), 얼굴 보임, 가로 오버플로 없음.
- [ ] 회귀 — 순차 reveal·자동 진행·사운드·결론 정상.

---

## 12. 출하 단위 & 후속

### ⑤-5h-A (이 워크오더, MVP)
무대 + 배경 선택 + 대화록 토글. 단일 화자 무대.

### ⑤-5h-B (후속, 별도)
- 양측 대치 무대(레퍼런스 2: 화자 vs 반박 대상 + 가운데 게이지) — `replyTo` 활용.
- `detectedDomain` 으로 배경 *자동 추천*(⑤-5c 흡수): 법률→courtroom 등 첫 진입 기본값.
- 캐릭터 idle 미세 호흡 애니 / 데스크탑 좌우 배치.

완료 후 `backlog.md` Active→Done, 진행 메모리 갱신.
