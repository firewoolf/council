# 워크오더 P-1 — 데모용 무료 공급사 확대

설계: Fable / 판정: David / 기준: origin/main = 416c535

데모(`mode: 'demo'`)는 원가가 아니라 **한도**가 병목이다. 현재 서버키가 4종
(groq·gemini·cerebras·openrouter)뿐이고, 그중 openrouter 는 일 50회로 사실상 놀고 있다.

**코드에 이미 정의만 되고 키·roles 가 없어 놀고 있는 3종을 먼저 켠다.**
새 어댑터가 필요 없어 변경이 매우 작다.

---

## §A 기존 3종 활성화 — mistral / nvidia / github

이 셋은 `upstream.ts`·`providers.ts`·`client.ts getModel` 에 **이미 전부 있다.**
빠진 건 `roles` 하나뿐이라 `pickProvider` 의 2순위(generalist)로만 잡히고,
등록된 4종 중 하나라도 있으면 영영 안 불린다.

### A-1 `lib/ai/providers.ts` — roles 추가

세 항목에 `roles: ['debate', 'chunk']` 를 추가한다 (groq·cerebras 와 같은 형태).
`recommend`·`conclude` 는 넣지 마라 — 그 둘은 품질 우선이라 gemini 에 남긴다.

### A-2 `freeTier` 문자열을 실제 숫자로 교체

현행은 "무료 체험 한도" 같은 문구라 한도 계산이 불가능하다.
2026-09-10 확인 기준으로 바꾸고, 각 줄 끝에 확인 일자를 남긴다:

- mistral  : `초당 1회 / 월 10억 토큰 무료 (La Plateforme)`
- nvidia   : `분당 40회 (크레딧 자동 충전, build.nvidia.com)`
- github   : `분당 10~15회 / 일 50~150회 (GitHub Models, PAT 필요)`

sambanova·together 는 **이번 범위가 아니다.** 한도가 문서화돼 있지 않아 보류한다.
`freeTier` 문구도 건드리지 마라.

### A-3 라운드로빈은 자동으로 확대된다 — 코드 변경 없음

`runWithFallback.orderChunkCandidates` 의 demo 분기가
`roles` 에 chunk 가 있는 후보만 순환 대상으로 고른다. A-1 만 하면 자동 편입된다.
이 함수를 건드리지 마라.

---

## §B Cohere 신규 추가 — 조건부

### ⚠ 먼저 확인할 것

Cohere 는 **OpenAI 완전 호환이 아니다.** 공식 OpenAI 호환 엔드포인트가 있는지
docs.cohere.com 에서 먼저 확인해라 (Compatibility API 계열 경로).

- **있으면** 그 baseURL 로 §B-1~B-3 을 진행한다.
- **없거나 불확실하면 §B 전체를 건너뛰고 보고해라.** 추측한 URL 을 박지 마라.
  §A 만으로도 이 워크오더는 값어치가 있다.

무료 한도는 20 RPM / **월 1,000회**다. 세션당 9콜이면 월 111세션 — 크지 않다.
그래서 §A 보다 우선순위가 낮다.

### B-1 `lib/ai/upstream.ts`
`cohere: { baseURL: <확인한 호환 경로>, auth: 'bearer', envPrefix: 'COHERE' }` 한 줄.

### B-2 `lib/ai/providers.ts`
`AiProvider` 에 `'cohere'` 추가, PROVIDERS 항목 추가.
- `modelId`: 다국어 품질을 위해 Aya Expanse 계열 또는 Command A 중 택1.
  **COUNCIL 은 한국어 전용 출력이다** — 한국어를 지원하는 모델을 골라라.
- `browserDirect: false`, `roles: ['debate', 'chunk']`
- `freeTier`: `분당 20회 / 월 1,000회 (Cohere 트라이얼 키)`
- `SERVER_PROVIDERS` 배열 끝에 추가. `BYOK_PROVIDERS` 에는 **넣지 마라** (browserDirect false).

### B-3 `lib/ai/client.ts`
`getModel` 의 OpenAI 호환 case 목록(mistral/sambanova/nvidia/together/github)에
`case 'cohere':` 를 추가한다. 새 SDK 를 설치하지 마라 — 기존 제네릭 경로를 쓴다.

---

## §C `lib/ai/pricing.ts` — 손대지 않는다

새 공급사 단가를 **추측해서 채우지 마라.** 미등재면 `/admin/usage` 에
"단가 미확인"이 뜨는데, 데모는 원가가 관심사가 아니므로 그대로 둔다.
유료 전환을 검토할 때 실단가를 확인해 등재한다.

## §D 하지 말 것

- `lib/prompts/*` · `store/usage.ts` · `lib/ai/errors.ts` · `runWithFallback` 무수정.
- `components/*` 무수정. 이 워크오더는 공급사 레지스트리만 다룬다.
- sambanova·together 무수정 (한도 미상, 보류).
- 새 npm 의존성 추가 금지.
- gemini 의 `roles` 무수정 — recommend·conclude 는 gemini 에 남긴다.

## §E 합격선

1. `pnpm typecheck` · `pnpm build` 통과.
2. mistral·nvidia·github 의 `roles` 에 `chunk` 가 있다.
3. `freeTier` 세 줄이 숫자를 담고 있다.
4. §B 를 진행했다면 cohere 가 `SERVER_PROVIDERS` 에 있고 `BYOK_PROVIDERS` 에는 없다.
5. §B 를 건너뛰었다면 그 이유(호환 엔드포인트 확인 결과)를 PR 본문에 적었다.

## §F 검증 (David 손)

Vercel 에 `MISTRAL_API_KEY` · `NVIDIA_API_KEY` · `GITHUB_MODELS_API_KEY`
(§B 진행 시 `COHERE_API_KEY`) 등록 후 Redeploy.
`/demo` 로 세션을 여러 번 열어 `/admin/usage` 세션별 표의 공급사가
세션마다 달라지는지 본다 — 라운드로빈 후보가 늘었는지 확인하는 것이다.
**공급사별로 토론 품질이 눈에 띄게 다른지도 같이 본다.** 체급이 낮은 곳이 있으면 뺀다.
