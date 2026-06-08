# 자산 생성 가이드 — Nano Banana (Gemini 2.5 Flash Image) 일러스트 워크플로

> 담당: David (외부 작업)
> 작성: Opus
> 대상: 트랙 ⑤-5f-A 일러스트 10 archetype 생성
> 선행 문서: `workorder-debate-5-5f-illustrations-sound.md` (부록 A 원본 prompt)
> 무료 도구: **Nano Banana (Gemini 2.5 Flash Image)** — Google AI Studio 또는 Gemini 앱

---

## 0. 왜 Nano Banana 인가

| 기준 | Nano Banana | Midjourney | DALL-E 3 | Leonardo |
|---|---|---|---|---|
| 비용 | **무료** | $10+/월 | 무료 (Bing) | 무료 매일 ~150 크레딧 |
| 캐릭터 일관성 | **★★★★★** (셀링포인트) | ★★★★ | ★★ | ★★★★ |
| 누적 대화 | ✓ (이전 결과 참조) | ✗ | △ | △ |
| 우리 작업 fit | **본질 일치** | OK | 톤 흩어짐 | OK |

**우리 작업의 본질** — 10명이 *한 작가의 작품* 으로 보이는 것. Nano Banana 는 *대화 맥락* 안에서 *같은 스타일로 다음 인물* 을 누적 박제 가능. 워크오더 본문의 *그림체 통일성* 절대 원칙을 가장 쉽게 만족.

---

## 1. 사전 준비

1. **Gemini 접속** — https://gemini.google.com 또는 https://aistudio.google.com (둘 다 무료).
2. **모델 선택** — "Gemini 2.5 Flash" (이미지 생성 지원 모델). 만약 "Imagen" 또는 "Image" 옵션이 따로 보이면 그쪽.
3. **새 대화 시작** — 10명을 *한 대화* 안에 누적. 절대 새 대화로 분리하지 말 것 (스타일 컨텍스트 끊김).

---

## 2. 핵심 — 누적 박제 흐름 (3단계)

### 2.1 첫 번째 인물 (스타일 anchor)

가장 *시각적 정체성이 강한 인물* 부터 시작. **jobs-designer** 권장 — "검정 터틀넥 + 라운드 안경 + 단순 배경" 으로 *그림체 자체가 명확히 드러남*.

첫 prompt 그대로 복붙:

```
Create a single character upper-body portrait in Korean light novel
illustration style. Soft cel-shading, clean linework, expressive eyes,
slight 3/4 angle gaze (not facing the viewer directly), looking
thoughtfully at unseen colleagues. Transparent or very subtle gradient
background only — no busy scenery, no other people.

Character: A middle-aged man in a simple black turtleneck and round
glasses. Intense focused gaze with one finger raised as if about to
interrupt. Minimalist white ambient lighting. Expression: a visionary
designer asking "why should this exist?"

Square 1:1 composition, centered, no text, no watermark, no logo,
single character only. High quality character design, professional
illustration style.

Avoid: text, watermark, signature, logo, multiple persons, full body,
realistic photo, anime extreme stylization, NSFW, blurred faces, busy
background, weapons, cartoon exaggeration.
```

**결과 검수:**
- 그림체가 *깔끔한 라이트노벨 톤* 인가 (너무 사진같지도, 너무 만화같지도 않게)
- 정사각 + 어깨 위 반신
- 배경 *비어있음* (그라데이션 정도만)
- 텍스트/워터마크 없음

마음에 안 들면 → "Try again with the same character description but make the style cleaner and less stylized" / "더 차분한 톤으로 다시" 식으로 재생성. *마음에 들 때까지* 첫 인물에 시간 투자. 이게 *나머지 9명의 anchor*.

### 2.2 2~10 번째 인물 (스타일 유지 + 인물만 교체)

첫 인물이 OK 면, **같은 대화창 안** 에서 짧은 prompt 만:

```
Same exact illustration style as the previous image. Same composition
rules (upper body, 3/4 gaze, transparent background, square 1:1).
Same restrictions (no text, no watermark, single character only).

Next character: <archetype 본문>
```

`<archetype 본문>` 만 §3 의 9개 중 하나로 교체. Nano Banana 가 *이전 이미지를 참조* 해서 그림체 유지.

### 2.3 톤 튀는 인물 재생성

10명 다 생성 후 *나란히 놓고* 검수. 튀는 1~2명만 재생성:

```
This character looks slightly different in style from the others.
Redo with the exact same style as the first image (the designer in
black turtleneck). Same character description: <해당 archetype 본문>
```

---

## 3. 10명 본문 (Nano Banana 자연어 — 그대로 복붙)

### 3.1 jobs-designer (첫 번째, anchor)

> A middle-aged man in a simple black turtleneck and round glasses.
> Intense focused gaze with one finger raised as if about to interrupt.
> Minimalist white ambient lighting. Expression: a visionary designer
> asking "why should this exist?"

→ 파일명: `jobs-designer.webp`

### 3.2 cold-investor

> A middle-aged Asian man in a charcoal grey suit, sharp narrow eyes,
> slightly raised eyebrow, holding a tablet at chest level. Cool blue
> ambient lighting from below. Expression: a skeptical analyst weighing
> numbers.

→ 파일명: `cold-investor.webp`

### 3.3 cynical-dev

> A young East Asian man in a dark hoodie over a graphic tee, glasses
> reflecting a laptop screen, tired but sharp eyes, faint stubble,
> slight smirk like he just spotted a bug. Green-cyan terminal-glow
> lighting. Expression: a cynical engineer who has seen this fail
> before.

→ 파일명: `cynical-dev.webp`

### 3.4 realist

> A middle-aged Asian woman in a structured beige blazer, short
> pragmatic hair, faint smile of someone who has handled actual
> operations, arms slightly crossed. Warm earthy lighting. Expression:
> a grounded operator who survives Mondays.

→ 파일명: `realist.webp`

### 3.5 startup-expert

> An energetic Asian man in his 30s in a clean dark navy jacket over a
> white t-shirt, wide alert eyes mid-explanation, one hand gesturing
> as if drawing a diagram in the air. Bright dawn-orange lighting.
> Expression: a founder mid-pitch.

→ 파일명: `startup-expert.webp`

### 3.6 branding-strategist

> A stylish Asian woman with a sharp asymmetric bob, deep burgundy
> turtleneck, holding a moodboard card lightly, contemplative head
> tilt. Warm magenta-rose lighting. Expression: a brand strategist
> judging how this will be remembered.

→ 파일명: `branding-strategist.webp`

### 3.7 psychologist

> A warm middle-aged Asian woman in a soft cream cardigan, kind
> attentive eyes, hands gently clasped, slight understanding smile.
> Soft warm honey lighting. Expression: a counselor who hears what is
> not said.

→ 파일명: `psychologist.webp`

### 3.8 growth-marketer

> A sharp young Asian woman with a high ponytail, dark green-tinted
> glasses, pointing at an invisible chart with confident energy.
> Electric green lighting. Expression: a marketer who can already see
> the funnel.

→ 파일명: `growth-marketer.webp`

### 3.9 domain-expert

> An older Asian scholar in a deep navy collared shirt with reading
> glasses pushed up onto silver hair, leaning slightly forward with
> one hand on an open thick book. Scholarly amber lamp lighting.
> Expression: a subject matter expert ready to correct
> misconceptions.

→ 파일명: `domain-expert.webp`

### 3.10 facilitator

> A calm Asian woman in her 40s in a clean tailored neutral grey
> jacket, poised posture, attentive open gaze listening to multiple
> speakers, one hand slightly raised in a "let's hold a moment"
> gesture. Neutral diffused light. Expression: a moderator who keeps
> the room honest.

→ 파일명: `facilitator.webp`

---

## 4. 후처리

### 4.1 다운로드

Gemini 채팅에서 각 이미지 우클릭 → "이미지 저장" 또는 다운로드 버튼. PNG 또는 JPG 로 받아짐. 임시 폴더 (예: `~/Downloads/council-portraits/`) 에 archetype id 이름으로 저장.

### 4.2 정사각 crop (이미 1:1 이면 스킵)

Nano Banana 가 정확히 1:1 안 줄 수도 있음. macOS Preview 또는 squoosh.app:
- **Preview**: 도구 → 잘라내기 → 정사각 영역 선택 → 잘라내기.
- 인물 얼굴이 *위쪽 1/3 지점* 에 오도록 crop. orb 의 circular mask 가 *얼굴을 자르지 않게*.

### 4.3 WebP 변환 + 압축

https://squoosh.app — 드래그앤드롭 → 우측 "WebP" 선택 → quality 80 → 다운로드.

또는 CLI (Homebrew 의 `webp` 패키지):
```bash
brew install webp
cd ~/Downloads/council-portraits
for f in *.png; do cwebp -q 80 "$f" -o "${f%.png}.webp"; done
```

512×512 WebP quality 80 = 약 30~50KB/장. 10장 합계 ~400KB. 모바일 LCP 영향 미미.

### 4.4 배치

```bash
mv ~/Downloads/council-portraits/*.webp \
   /Users/david/Documents/council/public/personas/portraits/
```

확인:
```bash
ls /Users/david/Documents/council/public/personas/portraits/
# cold-investor.webp        psychologist.webp
# cynical-dev.webp          realist.webp
# domain-expert.webp        startup-expert.webp
# facilitator.webp          branding-strategist.webp
# growth-marketer.webp      jobs-designer.webp
```

10개 모두 있는지 체크 (누락 1개 = 그 인물만 lucide 폴백, 시각 불일관).

---

## 5. 시각 검수 — 합격 기준

10명 일러스트를 한 화면에 펼쳐놓고:

- [ ] **그림체 통일** — *한 작가의 시리즈 작품* 처럼 보임. 1~2명만 사진풍 / 만화풍으로 튀면 재생성.
- [ ] **얼굴 방향** — 모두 *약간 옆/위* 응시. 정면 응시는 *대화 메타포* 와 안 맞음.
- [ ] **배경 비어있음** — 단색 또는 매우 흐릿한 그라데이션만. 책상·창문 등 *공간 요소 X*.
- [ ] **표정 차이** — 10명 *표정이 모두 다름* (잡스는 날카로움, 심리학자는 따뜻함 등). 단순히 *얼굴만 바뀐 같은 표정* X.
- [ ] **워터마크/텍스트 없음** — Gemini 가 가끔 박을 수 있음. 박혔으면 재생성.

검수 통과 후 → 코드는 자동으로 (PersonaOrb 폴백 체인이 이미지 우선) 이미지 표시. 새로고침만 하면 끝.

---

## 6. 작업 시간 추정

- 첫 anchor 인물 만족까지: ~5~10분 (재생성 1~3회)
- 나머지 9명 누적 생성: ~15~20분 (한 명당 1~2분)
- 검수 + 재생성 1~2명: ~5분
- 후처리 (crop + WebP + 배치): ~5분
- **총 ~30~40분**

---

## 7. 폴백 시나리오

### Nano Banana 가 만족스러운 결과를 안 줄 경우

1. **Leonardo AI** — https://leonardo.ai 무료 가입 → "Character Reference" 기능 활용. 첫 인물을 *Character Reference 로 등록* → 나머지 9명 같은 reference 로 생성.
2. **DALL-E 3 (Bing)** — https://copilot.microsoft.com/images. 일관성 약하지만 빠름. 10명 다 한꺼번에 돌리고 시각 검수.
3. **임시 — 이대로 lucide 아이콘 유지** — ⑤-5f-A 코드만 머지하고 일러스트는 *후속* 으로 미룸. 폴백 체인이 자동으로 lucide 표시 (현재 동작 그대로).

→ 셋 다 *코드 변경 0* — `public/personas/portraits/*.webp` 만 갈아끼우면 됨.

---

## 8. 자주 묻는 — Gemini Nano Banana 사용 팁

**Q. Gemini 가 "Sorry, I can't generate images of real people" 같이 거절하면?**
A. *real people* 키워드 회피. "fictional character" / "original character design" 추가. 우리 prompt 는 *추상적 archetype* 이라 보통 안 거절됨.

**Q. 한 대화에서 너무 많이 박으면 *컨텍스트 잃음* 발생?**
A. ~20 turn 이내 보통 안전. 우리는 10명 = 10 turn 정도. 더 길어지면 *직전 결과를 인용* 하면서 박기: "Like this previous one [image], make the next character: ..."

**Q. 결과물의 *상업적 사용* 가능?**
A. Gemini 약관 — 사용자가 *generated content 의 권리 보유*, 단 *Google 도 모델 개선용 사용 가능*. COUNCIL 같은 *제품 통합* OK. 단 *훈련 데이터 출처에 기인한 IP 침해 위험* 은 사용자 책임 — 너무 *특정 캐릭터 닮은* 결과는 회피.

**Q. 같은 prompt 인데 결과가 매번 다름?**
A. Nano Banana 는 *seed 고정 없음* (현재). *대화 맥락* 이 seed 역할. 새 대화 = 새 톤. 누적 박제 본질.
