# 작업 의뢰서 — 트랙 ⑤ Phase ⑤-5f: AI 일러스트 + 사운드 (게임감 폭격)

> 담당: Claude Code (Sonnet) + David (외부 자산 생성)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `workorder-debate-5-5-gamify.md` (⑤-5a-1·⑤-5d 출하 완료), `workorder-debate-5-5e-intro-statement.md` (출하 완료)
> 선행 상태: ⑤-5a-1 시그니처·Aha + ⑤-5d 페르소나 아바타(lucide 아이콘) + ⑤-5e 모두 발언 + ② 결정 지도 + ③ 카드 디렉션 모두 출하. 사용자 피드백 (2026-06-01): *"게임같은 느낌이 아직도 안드는데?"*

---

## 0. 한 줄 목표

토론을 *읽는 것* 에서 *지켜보는 것* 으로. 페르소나에게 **얼굴** 을 주고, 발언에 **소리** 를 입혀, *이게 게임이다* 를 0.5초 안에 체감하게 한다.

---

## 1. 배경 — 사용자 피드백 (2026-06-01)

> "게임같은 느낌이 아직도 안드는데?"

⑤-5a-1·⑤-5d 까지 출하했음에도 *체감 게임감 미달*. Opus 진단 — 5가지 결손 중 *2가지* 가 지배적:

| 결손 | 현재 상태 | 영향 |
|---|---|---|
| **반신 캐릭터 일러스트** | lucide 아이콘 (BarChart3 등) — *기호* 일 뿐 *얼굴* 이 아님 | 캐릭터 식별성 30% 수준. 동급생/페르소나5/삼국지 모두 *얼굴 그림* 이 본질. |
| **사운드** | 완전 무음 — 발언 reveal·디렉션 전송·결론 fanfare 모두 침묵 | 게임의 *시간 감각* 결손. 비주얼만 있고 *리듬* 이 없다. |
| 효과 풍부도 | keypoint-pulse 1종만 | 폴리시 영역 (⑤-5a-1 보완) |
| 무대 공간감 | 단조로운 surface | ⑤-5c 영역 (분야 배경) |
| 진행감 | 챕터 구분 없음 | ⑤-5b 영역 (컷신) |

이 워크오더는 **지배적 2가지 (일러스트 + 사운드)** 에 집중. 폴리시·컷신은 후순위.

---

## 2. 절대 원칙

1. **LLM 토큰 비용 0** — 모든 추가가 *정적 자산* + *클라이언트 사운드*. 프롬프트·생성 호출 무관.
2. **자산 외주 / 코드 통합 분리** — 일러스트는 *David 가 외부 도구로 생성* (Midjourney / DALL-E / Stable Diffusion). 코드는 *자산 경로만 참조*. 자산 미존재 → 폴백 (lucide 아이콘 → 첫 글자).
3. **3단 폴백 체인 유지** — `이미지 자산` → `lucide 아이콘` (⑤-5d) → `이름 첫 글자`. PersonaOrb 가 셋 다 처리.
4. **접근성 우선** — 사운드는 *기본 OFF* (또는 *기본 ON + 즉시 보이는 mute 토글*). `prefers-reduced-motion` 존중. 청각 결손 사용자도 동등 정보.
5. **모바일 퍼스트** — 일러스트는 *512×512 PNG/WebP* 단일. 큰 화면 대응은 CSS 확대 (모달에서 2x). 4G 환경에서 LCP 회귀 금지.
6. **CSS only 의 시각 + Web Audio API only 의 사운드** — `framer-motion`·`howler.js`·`tone.js` 같은 *큰 의존성* 도입 금지. *짧은 mp3/ogg + 네이티브 `<audio>`* 또는 *Web Audio API 합성음* 둘 다 가벼움.
7. **굴복 금지 불변** — 프롬프트·directive 손대지 말 것.
8. **자율 스크롤·재생 엔진·WaitingMemoArea·DirectionMenu 회귀 금지.**

---

## 3. 작업 범위 — A·B

### A. AI 일러스트 (⑤-5f-A)

#### A.1 자산 생성 가이드 — *David 가 외부에서*

**스타일 통일성** 이 캐릭터 정체성의 핵심. 10명 archetype 일러스트가 *같은 그림체* 로 보여야 함.

##### A.1.1 권장 스타일 — *"한국형 라이트 노벨 / 게임 일러스트"*

- **참조** — 동급생 (엘프) / 페르소나5 / 라이트노벨 표지 그림체.
- **반신 (어깨 위)** — 얼굴 표정 + 한쪽 손짓 정도까지. 전신 X (모바일에서 안 보임).
- **배경 없음** (또는 매우 흐릿한 단색 그라데이션) — 카드 색 그라데이션과 자연스럽게 섞임.
- **표정** — *작업 중인 표정* (몰입한 눈, 약간 미소). 정면 응시 X — 약간 옆 또는 위 응시. 사용자와 *대화하는 게 아니라 동료들과 회의하는* 느낌.
- **해상도** — **512×512 PNG** (또는 WebP 압축 80%). 모바일 retina 2x 까지 충분.
- **컬러 톤** — 각 archetype 의 `colorFrom`/`colorTo` 와 *완전히 동일* 할 필요 없음. 다만 *옷·배경 강조색* 이 그 톤에 *근접* 하면 카드 그라데이션과 어울림.

##### A.1.2 Negative prompt (모든 생성에 공통 적용)

```
text, watermark, signature, logo, multiple persons, full body,
realistic photo, anime extreme stylization, NSFW, blurred faces,
busy background, weapons, cartoon exaggeration, three-quarter
shot below chest
```

##### A.1.3 10명 Prompt 박제 (Opus 박제 — David 가 그대로 외부 도구에 투입)

부록 A 에 10개 prompt 전체 박제. 각 prompt 는 *공통 prefix* + *archetype 별 외형/표정* + *공통 suffix* 3단 구조.

##### A.1.4 자산 배치

```
council/public/personas/portraits/
  cold-investor.webp
  cynical-dev.webp
  jobs-designer.webp
  realist.webp
  startup-expert.webp
  branding-strategist.webp
  psychologist.webp
  growth-marketer.webp
  domain-expert.webp
  facilitator.webp
```

`generated`/`custom` 출신 멤버는 자산 없음 → 폴백 (lucide → initial).

#### A.2 코드 통합 — `PersonaOrb` 확장 (⑤-5d 폴백 체인 확장)

현재 `PersonaOrb` 폴백:
- `archetypeId` 매칭 → lucide 아이콘
- 매칭 안 됨 → 이름 첫 글자

신규 폴백:
- `archetypeId` 매칭 + 이미지 자산 존재 → **이미지** ← *신규*
- `archetypeId` 매칭 + 이미지 없음 → lucide 아이콘 (⑤-5d, 그대로)
- 매칭 안 됨 → 이름 첫 글자 (그대로)

```tsx
// PersonaOrb.tsx 갱신 — 이미지 우선
const portraitPath = iconKey
  ? `/personas/portraits/${iconKey}.webp`
  : undefined;
const [imgLoaded, setImgLoaded] = useState(false);
const [imgErrored, setImgErrored] = useState(false);

// 이미지 폴백 체인
const showImage = portraitPath && !imgErrored;
const showIcon = !showImage && Icon;
const showInitial = !showImage && !showIcon;
```

JSX:
```tsx
{showImage && (
  <img
    src={portraitPath}
    alt=""
    aria-hidden="true"
    onLoad={() => setImgLoaded(true)}
    onError={() => setImgErrored(true)}
    className={cn(
      'absolute inset-0 size-full rounded-full object-cover',
      imgLoaded ? 'opacity-100' : 'opacity-0',
      'transition-opacity duration-300',
    )}
  />
)}
{showIcon && <Icon ... />}
{showInitial && <span ... />}
```

핵심:
- **이미지 onError → lucide 자동 폴백** — 자산 누락도 깨지지 않음.
- **lazy load** — `loading="lazy"` (브라우저 native). LCP 영향 없음.
- **`object-cover` + `rounded-full`** — 정사각 이미지를 원형 마스크. orb 그라데이션은 *이미지 뒤* 에 깔려 *후광* 효과.
- **opacity transition** — 이미지 로드 전 lucide 도 가능하나 *깜빡임* 방지 위해 *이미지 로드 완료까지 투명*. 첫 페이지 로드 시 ~200ms 만 lucide 가 보이고 fade-in.

#### A.3 PersonaDetailDrawer — *큰 일러스트 표시*

현재 drawer 의 orb 는 작음 (80~120px). 신규:
- **이미지가 있으면** orb 자리에 *전체 일러스트 카드* (가로 100% × 비율 1:1) — 캐릭터 시트 느낌.
- **이미지가 없으면** 기존 orb 유지.

```tsx
{portraitPath && (
  <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
    <img src={portraitPath} className="size-full object-cover" />
    {/* 그라데이션 하단 오버레이 + 이름 큰 글씨 */}
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
      <h2 className="text-2xl font-bold text-white">{persona.name}</h2>
      <p className="text-sm text-white/80">{persona.role}</p>
    </div>
  </div>
)}
```

#### A.4 PersonaStageStrip — *speaking 시 일러스트 확대*

⑤-2a 의 `state==='speaking'` orb 가 `scale-[1.15]` 펄스 — 그대로 유지. 이미지로 자연스럽게 적용됨 (PersonaOrb 가 통일된 컨테이너).

#### A.5 PersonaPicker (CP3) — *모집 화면 메타포 강화*

현재 picker 의 카드들에 orb 만. 신규:
- **이미지가 있으면** 카드 상단에 *반신 일러스트* 표시 (가로 100% × aspect-[3/2]).
- **이미지가 없으면** 기존 orb 만.
- *삼국지 인재 영입 화면* 메타포.

별도 출하 단위 (⑤-5f-A2) — 1차에선 *세션 진행 화면만* 가도 OK.

### B. 사운드 시스템 (⑤-5f-B)

#### B.1 트레이드오프 — Tone.js vs 짧은 mp3

| 옵션 | 장점 | 단점 |
|---|---|---|
| **Tone.js** (Web Audio 합성) | 자산 0KB. 모든 효과 코드로 생성. mute/볼륨 즉시 조절. | 라이브러리 ~150KB. 모바일 메모리 ↑. 합성음은 *게임 톤이 아닌 UI 톤*. |
| **짧은 mp3/ogg + 네이티브 `<audio>`** | 자산 ~2~10KB/효과. 진짜 게임 SFX 톤. 라이브러리 0. | 자산 외주 필요 (또는 freesound.org). 캐시·preload 관리. |
| **Web Audio API 직접 (no Tone.js)** | 라이브러리 0. 합성음. | 코드 복잡. 합성음 한계 (위와 동일). |

**Opus 권장**: **짧은 mp3 (freesound.org CC0)** + 네이티브 `<audio>`. 게임 SFX 톤 *진짜* + 의존성 0.

##### B.1.1 자산 출처 — freesound.org / Pixabay (모두 CC0)

David 가 외부에서 다운로드. *공통 후처리* (Audacity / online compressor):
- 길이 < 800ms (긴 음 금지)
- 볼륨 -12 ~ -6 dB (다른 사이트와 일관)
- ogg 44.1kHz mono — *모바일에서 가장 호환*

대안 — Opus 가 *Web Audio API 합성음* 폴백을 제공 (자산 없으면 합성 fallback). §부록 B 에 합성 코드 박제.

#### B.2 사운드 이벤트 명세

| 이벤트 | 트리거 | 톤 | 길이 |
|---|---|---|---|
| **`reveal`** | 새 발언 카드 등장 | *짧고 부드러운 tick* (메시지 도착 톤) | ~150ms |
| **`keypoint`** | `isKeyPoint=true` 발언 reveal | *밝은 chime* (Aha 모먼트) | ~400ms |
| **`question`** | `isQuestion=true` 발언 reveal | *상승 톤* (질문의 끝) | ~250ms |
| **`intro`** | 모두 발언 등장 | *낮은 gong / drum* (의식의 시작) | ~600ms |
| **`direction-send`** | 카드 디렉션 전송 (③) | *짧은 confirm* (스위치 톤) | ~120ms |
| **`steering-decide`** | SteeringPanel 후보 선택 | *결정의 무게* (북) | ~300ms |
| **`conclude`** | summary 화면 진입 | *fanfare 짧게* (마침의 무게) | ~800ms |

**중요**: `reveal` 이 가장 자주 발화 — *가장 가볍고 거슬리지 않아야*. 합성음일 경우 800Hz sine 50ms 정도.

#### B.3 코드 구조 — `lib/sound/`

```
lib/sound/
  index.ts                 (외부 API — playSound(event))
  events.ts                (이벤트 enum + 자산 경로 매핑)
  player.ts                (mp3 preload + play + mute 관리)
  synthesizer.ts           (Web Audio API 합성 폴백)
```

**`lib/sound/index.ts`** — 외부 API 한 줄:
```ts
export type SoundEvent =
  | 'reveal'
  | 'keypoint'
  | 'question'
  | 'intro'
  | 'direction-send'
  | 'steering-decide'
  | 'conclude';

export function playSound(event: SoundEvent): void;
export function setMuted(muted: boolean): void;
export function isMuted(): boolean;
```

**`lib/sound/player.ts`** — 핵심 동작:
- 모듈 최초 로드 시 모든 mp3 *preload* (`new Audio(path); audio.preload = 'auto'`).
- `playSound(event)` → mp3 존재하면 `audio.currentTime = 0; audio.play()`. *catch error* (브라우저 autoplay 정책).
- mp3 missing or 로드 실패 → **synthesizer 폴백** (`lib/sound/synthesizer.ts`).
- **mute 상태**는 `localStorage` persist (`council:sound-muted` key). 기본값 — *사용자 결정 필요* (§B.5).

**`lib/sound/synthesizer.ts`** — Web Audio API 폴백 (의존성 0):
```ts
let ctx: AudioContext | null = null;

export function synthSound(event: SoundEvent) {
  if (!ctx) ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain).connect(ctx.destination);

  // 이벤트별 주파수·duration·envelope
  const params = SOUND_PARAMS[event];
  osc.frequency.value = params.freq;
  osc.type = params.type;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(params.volume, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + params.duration);

  osc.start();
  osc.stop(ctx.currentTime + params.duration);
}
```

§부록 B 에 `SOUND_PARAMS` 7개 박제.

#### B.4 통합 지점

| 파일 | 추가 호출 |
|---|---|
| `components/debate/DebateFeed.tsx` 또는 `useDebate.ts` (reveal 시점 hook) | `playSound('reveal')` — 새 메시지 카드 등장 시. `kind==='intro'` 면 `'intro'`. `isKeyPoint` 면 `'keypoint'`. `isQuestion` 이면 `'question'`. *우선순위* — keypoint > question > intro > reveal. |
| `components/debate/DirectionMenu.tsx` 의 `onSubmit` | `playSound('direction-send')` |
| `components/debate/SteeringPanel.tsx` 의 후보 선택 | `playSound('steering-decide')` |
| `app/(main)/session/[id]/summary/page.tsx` 마운트 | `playSound('conclude')` — `useEffect` 첫 마운트 한 번만 |

**우선순위 로직** (`useDebate` 의 reveal 안):
```ts
const soundFor = (msg: Message): SoundEvent => {
  if (msg.kind === 'intro') return 'intro';
  if (msg.isKeyPoint) return 'keypoint';
  if (msg.isQuestion) return 'question';
  return 'reveal';
};
```

#### B.5 Mute 토글 UI

위치 — *세션 진행 화면 상단 우측* 작은 아이콘 (Volume2 / VolumeX, lucide-react).
- `localStorage` persist.
- 기본값 — **OFF (muted)** 권장 (autoplay 정책 + 사용자가 *발견* 해서 켜는 경험). 또는 ON (즉시 게임감) — Sonnet 결정.
- 키보드 단축키 `m` — *옵션*.

```tsx
// app/(main)/session/[id]/page.tsx 상단에
<button
  onClick={() => setMuted(!isMuted())}
  aria-label={isMuted() ? '사운드 켜기' : '사운드 끄기'}
  className="flex size-9 items-center justify-center rounded-md hover:bg-surface-2"
>
  {isMuted() ? <VolumeX className="size-4 text-text-muted" />
             : <Volume2 className="size-4 text-text" />}
</button>
```

#### B.6 접근성

- `prefers-reduced-motion: reduce` 환경 → *사운드도 OFF* (시청각 모두 차분).
- 화면 비활성 (`document.hidden`) → `playSound` no-op.
- 첫 사용자 인터랙션 전 — autoplay 정책 우회 위해 *첫 클릭에서 사운드 컨텍스트 unlock* 처리 (Audio 객체 `.play()` 한 번 + 즉시 pause).

---

## 4. 영향 파일 맵

```
신규 (자산 — David 외부 생성):
  public/personas/portraits/*.webp     (10개 archetype 반신 일러스트)
  public/sounds/*.ogg                  (7개 사운드 효과, 또는 합성 폴백)

신규 (코드):
  lib/sound/index.ts                   외부 API (playSound, setMuted)
  lib/sound/events.ts                  이벤트 enum + 자산 경로
  lib/sound/player.ts                  mp3 preload + play + mute
  lib/sound/synthesizer.ts             Web Audio API 합성 폴백

갱신 (A 일러스트):
  components/persona/PersonaOrb.tsx    이미지 폴백 체인 (이미지 → lucide → initial)
  components/debate/PersonaDetailDrawer.tsx   큰 일러스트 카드 (이미지 있을 때)
  components/persona/PersonaPicker.tsx (선택, ⑤-5f-A2)   카드 상단 일러스트

갱신 (B 사운드):
  hooks/useDebate.ts                   reveal/intro 시점에 playSound
  components/debate/DirectionMenu.tsx  direction-send
  components/debate/SteeringPanel.tsx  steering-decide
  app/(main)/session/[id]/summary/page.tsx   conclude
  app/(main)/session/[id]/page.tsx     mute 토글 버튼
```

총 신규 4개 코드 파일 + 갱신 5~6개. 자산 10+7 = 17개 (외부 생성).

---

## 5. 손대지 말 것

- `BASE_PROMPT` · `CHUNK_SYSTEM_PROMPT` · directive · `formatDirection` · `generateIntroStatement` — 절대 금지.
- 자율 스크롤 (`NEAR_BOTTOM_PX`) — 유지.
- ⑤-1 청크 엔진 / phase 머신 / pendingMemoRef / pendingDirectionsRef — 그대로.
- conclusionSchema / DecisionMapView — 무관.
- `framer-motion` / `howler.js` / `tone.js` 도입 — *모두 금지*. 가벼움 유지.
- `localStorage` 키 네이밍 — 기존 패턴 (`council:*`) 따를 것.

---

## 6. 검증 기준

### 6.1 자동 검증

- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` 통과.
- [ ] **번들 크기 회귀 < 5KB** (lib/sound 추가분). `pnpm build` 출력으로 확인.
- [ ] 일러스트 자산 누락 (`/personas/portraits/*` 폴더 비어있음) → 폴백 체인 정상 (lucide → initial).
- [ ] 사운드 자산 누락 (`/sounds/*` 폴더 비어있음) → synthesizer 폴백 정상.
- [ ] mute 상태 `localStorage` persist.

### 6.2 사람 검증 — 시각 (⑤-5f-A)

- [ ] 10명 archetype 카드에 **반신 일러스트** 표시. 같은 그림체 (10명이 *한 작가의 작품* 처럼 보임).
- [ ] PersonaDetailDrawer 열면 *큰 일러스트* — 캐릭터 시트 느낌.
- [ ] PersonaStageStrip 의 speaking orb 가 *얼굴* 로 펄스 — 누가 발언하는지 0.5초에 식별.
- [ ] 일러스트 누락 archetype (테스트 — 한 파일 의도적 삭제) → lucide 아이콘으로 자연 폴백, 깨짐 없음.

### 6.3 사람 검증 — 사운드 (⑤-5f-B)

- [ ] mute OFF 상태에서 새 발언 도착 → *짧은 tick*. 거슬리지 않음.
- [ ] `isKeyPoint` 발언 → *밝은 chime* — 시각 (keypoint-pulse) + 청각 동기.
- [ ] 디렉션 전송 → *confirm 톤*.
- [ ] SteeringPanel 후보 클릭 → *결정의 북*.
- [ ] summary 진입 → *fanfare*.
- [ ] mute 토글 — 즉시 반영. 새로고침 후에도 상태 유지.
- [ ] `prefers-reduced-motion: reduce` → 사운드 자동 OFF (시스템 설정 변경 후 새로고침).

### 6.4 종합 — *체감 게임감*

- [ ] David 가 "이제 게임 같다" 라고 말함 (이 워크오더 본질의 KPI).

---

## 7. 출하 단위

### ⑤-5f-A. 일러스트 통합 (블로킹, 자산 외주 선행)

순서:
1. **David** — Midjourney/DALL-E 로 10명 일러스트 생성 (§부록 A prompt 그대로). 후처리 — 정사각 crop + WebP 변환.
2. **David** — `public/personas/portraits/` 에 10개 파일 배치.
3. **Sonnet** — PersonaOrb 폴백 체인 확장 + PersonaDetailDrawer 큰 일러스트. (자산 없어도 코드는 작동, 폴백 발동.)
4. **Sonnet** — PR.

### ⑤-5f-B. 사운드 시스템 (블로킹)

순서:
1. **David** — freesound.org / Pixabay 에서 CC0 효과 7개 다운로드, 후처리 (< 800ms, -12dB, ogg). 또는 **합성 폴백만 우선** 진행.
2. **Sonnet** — `lib/sound/*` 4개 파일 신규 + 5~6개 통합 지점.
3. **Sonnet** — mute 토글 UI.
4. **Sonnet** — PR.

### ⑤-5f-A2. (옵션 — 후순위) PersonaPicker 일러스트

CP3 picker 카드에 일러스트 통합. 별도 출하.

→ A 와 B 는 *동시 출하 가능* (충돌 없음). David 의 자산 생성 속도에 따라 한쪽이 먼저 머지될 수 있음. 코드 통합은 *자산 없어도 폴백으로 머지 가능*.

---

## 8. 완료 후

- `backlog.md` 트랙 ⑤-5f → Done.
- David 가 *체감 게임감 합격* 확인 후 다음 트랙 결정.
- 후순위 보류 트랙 재평가: ⑤-5b 결정 무게 (사운드 가 컷신 역할 일부 흡수), ⑤-5c 분야 배경 + 호명, ②-b 마크다운 export, ③-b long-press + 카운트 배지, 트랙 ④ 거울 페르소나, ⑤-5a-2 ★ 게이지 + archetype 점수표.

---

## 부록 A — 10명 archetype 일러스트 Prompt (Opus 박제, David 외부 도구 투입용)

**공통 prefix** (모든 prompt 앞):
```
upper body portrait, korean light novel illustration style, soft cel-shading,
clean linework, expressive eyes, slight 3/4 angle gaze (not facing viewer
directly), looking thoughtfully at unseen colleagues, transparent or very
subtle gradient background,
```

**공통 suffix** (모든 prompt 뒤):
```
512x512, centered composition, no text, no logo, single character only,
high quality character design, professional illustration
```

**Negative prompt** (모든 생성에 동일):
```
text, watermark, signature, logo, multiple persons, full body,
realistic photo, anime extreme stylization, NSFW, blurred faces,
busy background, weapons, cartoon exaggeration
```

### 10명 본문

```text
1. cold-investor
   middle-aged Asian man in a charcoal grey suit, sharp narrow eyes,
   slightly raised eyebrow, holding a tablet at chest level, cool blue
   ambient lighting from below, expression: skeptical analyst weighing
   numbers

2. cynical-dev
   young East Asian man in a dark hoodie over a graphic tee, glasses
   reflecting a laptop screen, tired but sharp eyes, faint stubble, slight
   smirk like he just spotted a bug, green-cyan terminal-glow lighting,
   expression: cynical engineer who has seen this fail before

3. jobs-designer
   middle-aged man in a simple black turtleneck, round glasses, intense
   focused gaze with one finger raised as if about to interrupt, minimalist
   white ambient lighting, expression: visionary designer asking why this
   should exist

4. realist
   middle-aged Asian woman in a structured beige blazer, short pragmatic
   hair, faint smile of someone who has handled actual operations, arms
   slightly crossed, warm earthy lighting, expression: grounded operator
   who survives Mondays

5. startup-expert
   energetic Asian man in his 30s in a clean dark navy jacket over a white
   t-shirt, wide alert eyes mid-explanation, one hand gesturing as if
   drawing a diagram in the air, bright dawn-orange lighting,
   expression: founder mid-pitch

6. branding-strategist
   stylish Asian woman with a sharp asymmetric bob, deep burgundy
   turtleneck, holding a moodboard card lightly, contemplative head tilt,
   warm magenta-rose lighting, expression: brand strategist judging how
   this will be remembered

7. psychologist
   warm middle-aged Asian woman in a soft cream cardigan, kind attentive
   eyes, hands gently clasped, slight understanding smile, soft warm
   honey lighting, expression: counselor who hears what is not said

8. growth-marketer
   sharp young Asian woman with a high ponytail, dark green-tinted glasses,
   pointing at an invisible chart with confident energy, electric green
   lighting, expression: marketer who can already see the funnel

9. domain-expert
   older Asian scholar in a deep navy collared shirt with reading glasses
   pushed up onto silver hair, leaning slightly forward with one hand on
   an open thick book, scholarly amber lamp lighting, expression: subject
   matter expert ready to correct misconceptions

10. facilitator
    calm Asian woman in her 40s in a clean tailored neutral grey jacket,
    poised posture, attentive open gaze listening to multiple speakers,
    one hand slightly raised in a "let's hold a moment" gesture, neutral
    diffused light, expression: moderator who keeps the room honest
```

투입 형식 (Midjourney 예시):
```
<공통 prefix> <archetype 본문> <공통 suffix> --no <negative prompt> --ar 1:1 --v 6
```

후처리: 정사각 crop 확인 → WebP quality 80 변환 → `public/personas/portraits/{archetype-id}.webp`.

---

## 부록 B — `SOUND_PARAMS` 합성음 박제 (Web Audio API 폴백)

```ts
// lib/sound/synthesizer.ts
type SoundParams = {
  freq: number;          // Hz
  type: OscillatorType;  // 'sine' | 'triangle' | 'square' | 'sawtooth'
  volume: number;        // 0~1 (peak gain)
  duration: number;      // seconds
};

export const SOUND_PARAMS: Record<SoundEvent, SoundParams> = {
  // 짧고 부드러운 tick — 가장 자주 발화하므로 가장 가벼움
  reveal:            { freq: 880,  type: 'sine',     volume: 0.06, duration: 0.08 },

  // 밝은 chime (Aha) — 3차 화음 느낌은 단순 sine 으로는 어려우므로 약간 길게
  keypoint:          { freq: 1320, type: 'sine',     volume: 0.10, duration: 0.35 },

  // 상승 톤 (질문 끝) — frequency ramp 가 필요. 본 코드는 단순화, 실제 구현 시 freq.linearRampToValueAtTime 사용
  question:          { freq: 660,  type: 'triangle', volume: 0.08, duration: 0.22 },

  // 낮은 gong (모두 발언 의식의 시작)
  intro:             { freq: 220,  type: 'sine',     volume: 0.12, duration: 0.55 },

  // confirm switch (디렉션 전송)
  'direction-send':  { freq: 1100, type: 'square',   volume: 0.05, duration: 0.07 },

  // 결정의 북 (steering 후보 선택)
  'steering-decide': { freq: 165,  type: 'triangle', volume: 0.14, duration: 0.28 },

  // fanfare (마침의 무게) — 단음으로는 약함, mp3 자산이 강하게 권장
  conclude:          { freq: 523,  type: 'triangle', volume: 0.12, duration: 0.70 },
};
```

질문 톤의 *상승* (linearRampToValueAtTime) 만 구현 디테일 — 본 표는 *시작 주파수* 기준. Sonnet 이 player 에서 `question` 이벤트 시 `osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.18)` 가산.

---

## 부록 C — 자산 생성 체크리스트 (David 전용)

### 일러스트 (10개)

- [ ] Midjourney / DALL-E / Stable Diffusion 중 택 1.
- [ ] §부록 A prompt 그대로 (공통 prefix + 본문 + 공통 suffix + negative).
- [ ] 10명 모두 *같은 스타일·같은 작가* 로 보이는지 검수 (한 명만 튀면 재생성).
- [ ] 512×512 정사각 crop.
- [ ] WebP quality 80 변환 (squoosh.app / cwebp).
- [ ] 파일명 정확히 archetype id (`cold-investor.webp` 등).
- [ ] `public/personas/portraits/` 에 배치.

### 사운드 (7개, 옵션)

- [ ] freesound.org 검색 키워드 — "ui tick", "ui chime", "ui question rise", "soft gong", "switch click", "drum hit short", "short fanfare".
- [ ] CC0 또는 CC-BY 만 (attribution 필요 시 `docs/` 에 출처 기록).
- [ ] Audacity — 길이 trim < 800ms, normalize to -12dB, mono 44.1kHz.
- [ ] ogg 변환.
- [ ] 파일명 — 이벤트 이름 그대로 (`reveal.ogg`, `keypoint.ogg` ...).
- [ ] `public/sounds/` 에 배치.
- [ ] 자산 안 만들 거면 — **이 부록 통째로 스킵**. synthesizer 폴백으로 코드만 출하.

---

## 부록 D — 게임감 KPI (David 의 본질적 피드백 추적)

이 워크오더 출하 후 David 가 다시 *"게임 같지 않다"* 면, 다음 진단:

| 결손 시그널 | 차기 워크오더 |
|---|---|
| 일러스트는 좋은데 *반응* 없음 — 캐릭터가 *반응* 안 함 | ⑤-5g — *발언자 expression 변화* (speaking 시 일러스트 *살짝 떨림* / *눈 깜빡임* CSS) |
| 사운드는 있는데 *리듬* 없음 — 발언이 *박자감* 없이 흐름 | ⑤-5h — *발언 reveal 사이 BPM 통제* (현재 readingTime 기반에 +/- 200ms jitter 추가, 빠른 reveal 그룹과 느린 reveal 그룹 교대) |
| 청크가 *장면* 으로 안 느껴짐 | ⑤-5b — 인트로 컷신 부활 (잠시 보류했던) |
| 결론이 *엔딩* 으로 안 느껴짐 | ⑤-5i — summary 화면 *엔딩 크레딧* 모드 (cast 한 명씩 fade-in + signature line + portrait) |

기록만 — *이번 출하* 가 KPI 합격하면 위 차기는 모두 후순위.
