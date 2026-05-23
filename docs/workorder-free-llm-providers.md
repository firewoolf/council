# 작업 의뢰서 — 무료 LLM provider 추가 (OpenRouter + Cerebras)

> 담당: Claude Code (Sonnet)
> 작성: Opus (설계)
> 대상 레포: `council/`
> 선행 문서: `../CLAUDE.md` (절대 원칙), `README.md`

---

## 0. 한 줄 목표

BYOK provider에 **OpenRouter**와 **Cerebras**를 추가하고, 작업 특성별 라우팅 + rate limit 폴백을 붙여 "사실상 무료 한도 무제한"에 가깝게 만든다.

---

## 1. 배경 — 왜

- 현재 BYOK provider는 Gemini, Groq 2개뿐. 한 명이 토론 1세션에 LLM을 ~25회 호출한다.
- 무료 한도를 합산하면 하루 수십 세션을 0원으로 돌릴 수 있다.
- COUNCIL은 LLM을 성격이 다른 3군데서 부른다 → provider를 작업에 맞춰 라우팅하면 효율이 크게 오른다.

| 작업 | 호출 빈도 | 중요 특성 |
|------|---------|---------|
| 페르소나 추천 `recommendPersonas` | 세션당 1회 | 품질 + 복잡한 enum 스키마 |
| 토론 발언 `generateSpeech` | 턴당 1회 (20~30회) | 속도 + RPM 여유 |
| 결론 생성 `generateConclusion` | 세션당 1회 | 품질 최우선 + 4섹션 스키마 |

---

## 2. 절대 원칙 (위반 시 작업 반려)

1. **CLAUDE.md ⓬ "하지 말 것" 전부 준수.** 특히 `process.env` 직접 접근 금지(`@/env` 사용), Tailwind v3 유지, 테스트 코드 작성 금지.
2. **굴복 금지 규칙 불변.** provider를 바꿔도 페르소나가 "맞습니다 대표님" 류로 무너지면 안 된다. 새 모델은 반드시 굴복 테스트를 거친다(§6).
3. **단순함 우선.** 추상화 레이어를 새로 만들지 말 것. 기존 `lib/ai/providers.ts` + `lib/ai/client.ts` 구조를 그대로 확장한다.
4. **`browserDirect: false` 인 provider는 BYOK 목록(`BYOK_PROVIDERS`)에서 제외.** 2단계 BYOK는 브라우저 직접 호출이 전제다.
5. provider를 4개까지만 둔다. 더 늘리지 말 것 (OpenRouter 자체가 애그리게이터라 모델 수는 충분).

---

## 3. 작업 범위 — 3 페이즈

### Phase A — provider 2개 추가 (필수, 저위험)

**A-1. 의존성 추가** (`package.json`)
```
@openrouter/ai-sdk-provider   (OpenRouter 커뮤니티 provider)
@ai-sdk/cerebras              (Cerebras 공식 provider)
```
설치 후 `pnpm install`로 lock 갱신.

**A-2. `lib/ai/providers.ts` 확장**
- `AiProvider` union에 `'openrouter' | 'cerebras'` 추가.
- `PROVIDERS` record에 두 항목 추가. 기존 `ProviderConfig` 형태 그대로 채운다:
  - **openrouter**
    - `displayName`: `'OpenRouter (무료 모델)'`
    - `signupUrl`: `https://openrouter.ai/keys`
    - `signupGuide`: OpenRouter 가입 → Keys → Create Key. GitHub/Google 로그인 가능.
    - `modelId`: 구조화 출력이 안정적인 `:free` 모델 1개. **현재 OpenRouter 무료 모델 목록을 직접 확인**해서 JSON schema를 잘 따르는 모델 선택 (DeepSeek V3 계열이 후보). 모델 ID는 반드시 docs에서 최신 확인 — 추측 금지.
    - `keyPattern`: `/^sk-or-v1-[A-Za-z0-9]{40,}$/`
    - `browserDirect`: `true` (OpenRouter는 브라우저 호출 공식 지원)
    - `freeTier`: `'무료 모델 일 50회 (10크레딧 구매 시 1,000회) / 분당 20회'`
    - `accent`: OpenRouter 브랜드색 (보라 계열, 적당히)
  - **cerebras**
    - `displayName`: `'Cerebras (초고속)'`
    - `signupUrl`: `https://cloud.cerebras.ai`
    - `modelId`: Cerebras docs에서 최신 Llama 계열 ID 확인 (예: `llama-3.3-70b` — **docs로 검증**).
    - `keyPattern`: Cerebras 키 형식 확인 후 작성 (`csk-` 접두 추정 — 실제 키로 검증).
    - `browserDirect`: **§6의 CORS 테스트를 통과하면 `true`, 실패하면 `false`** (false면 BYOK_PROVIDERS에서 빼고 주석으로 사유 기록).
    - `freeTier`: `'분당 6만 토큰 / 일 약 1,700회'`
- `BYOK_PROVIDERS` 배열에 `browserDirect: true` 인 것만 추가.

**A-3. `lib/ai/client.ts` 의 `getModel` 확장**
- `openrouter` 케이스: `createOpenRouter({ apiKey })(modelId)`.
  - 브라우저 호출 시 OpenRouter가 `HTTP-Referer` / `X-Title` 헤더를 권장 → provider 생성 시 `headers`로 전달 (앱 이름 'COUNCIL').
- `cerebras` 케이스: `createCerebras({ apiKey })(modelId)`.
- `claude` 케이스의 기존 "브라우저 직접 호출 불가" throw 패턴은 유지.

**A-4. 설정 화면 확인** (`components/settings/ApiKeyForm.tsx`)
- 이 컴포넌트는 `BYOK_PROVIDERS`를 순회하므로 A-2가 끝나면 카드가 자동 추가됨. **새 코드 불필요** — 렌더링만 눈으로 확인.
- placeholder 텍스트가 provider별로 분기되어 있으면(`gemini` / 그 외) openrouter·cerebras도 자연스럽게 보이도록 최소 조정.

### Phase B — 작업별 라우팅 (권장)

**B-1. `ProviderConfig`에 `roles` 필드 추가**
```ts
/** 이 provider가 적합한 작업. 비우면 모든 작업 가능. */
roles?: ('recommend' | 'debate' | 'conclude')[];
```
- gemini: `['recommend', 'conclude']` (품질·안정)
- groq: `['debate']`
- cerebras: `['debate']`
- openrouter: 모든 작업 (폴백 범용)

**B-2. 라우팅 헬퍼**
- `lib/ai/client.ts` 또는 `lib/ai/providers.ts`에 `pickProvider(role, availableProviders)` 추가.
- 사용자가 키를 등록한 provider 중에서 `role`에 맞는 것을 우선 선택. 없으면 아무거나.
- `recommendPersonas` / `generateSpeech` / `generateConclusion` 호출부에서 활용.
- **중요**: 사용자가 키를 1개만 넣었으면 그 1개로 다 돌아가야 한다. 라우팅은 "여러 키가 있을 때의 최적화"일 뿐, 강제가 아니다.

### Phase C — rate limit 폴백 (권장)

- `generateSpeech` 등에서 429 / quota 에러를 잡으면, 같은 role의 다른 provider로 1회 재시도.
- 무한 루프 방지: 폴백은 provider당 1회까지. 전부 실패하면 기존처럼 에러를 throw.
- `testApiKey`의 에러 정규화 로직(429 → "호출 한도 초과")이 이미 있으니 같은 패턴 재사용.

---

## 4. 손대지 말 것

- `store/api-key.ts` — 이미 공급사별 다중 키 저장 구조라 **수정 불필요**. 새 provider 키도 자동 수용된다.
- `store/sessions.ts`, `useDebate.ts`의 상태 머신 — 이번 작업 범위 밖.
- 페르소나 프롬프트(`data/personas.json`, `data/prompts.json`) — 건드리지 말 것.
- `types/debate.ts`의 `Session.aiProvider` 및 Supabase `sessions.ai_provider` enum은 `'gemini' | 'groq' | 'claude'`로 되어 있다. openrouter/cerebras를 세션에 저장해야 하면 이 enum도 함께 넓혀야 하니, **이 부분이 필요해지면 작업 전에 보고**하고 진행.

---

## 5. 권장 작업 순서

1. Phase A 먼저 완성 → typecheck / build 통과 → 커밋.
2. §6 검증 (특히 Cerebras CORS, 구조화 출력) 통과 확인.
3. Phase B → 커밋.
4. Phase C → 커밋.

페이즈마다 커밋을 쪼갠다. A만으로도 동작하는 상태여야 한다.

---

## 6. 검증 기준 (전부 통과해야 완료)

- [ ] `pnpm typecheck` 무에러 (strict + `noUncheckedIndexedAccess`).
- [ ] `pnpm build` 성공.
- [ ] `pnpm dev`로 `/settings` 진입 → OpenRouter·Cerebras 카드가 보이고, 키 입력 → "저장 + 테스트" → 연결 성공 토스트.
- [ ] **CORS 실측**: 각 provider를 실제 브라우저에서 호출해 성공하는지 확인. provider 문서 신뢰 금지 — 브라우저 네트워크 탭으로 직접 확인. Cerebras가 CORS 막히면 `browserDirect: false`로 두고 BYOK 목록에서 제외.
- [ ] **구조화 출력**: 각 provider로 `/session/new` 페르소나 추천이 정상 동작 (`generateObject` + enum 스키마가 깨지지 않음).
- [ ] **굴복 테스트**: 새 provider로 토론을 1세션 돌리고, 사용자가 강하게 압박하는 발언을 넣었을 때 페르소나가 "맞습니다 대표님" 류로 무너지지 않는지 확인. 무너지면 그 모델은 `modelId` 후보에서 제외.
- [ ] Phase B/C 구현 시: 키를 1개만 넣어도 전 기능이 동작하는지 확인.

---

## 7. 막히면 — Opus로 에스컬레이션할 상황

- 새 무료 모델이 한국어 + 구조화 출력 + 굴복 방지를 **동시에** 못 해서 modelId 선택이 애매할 때 → 모델 비교 판단은 Opus.
- `Session.aiProvider` enum 확장이 Supabase 스키마/마이그레이션까지 번지면 → 설계 영향 범위 판단은 Opus.
- 그 외 단순 구현·디버깅은 Sonnet 단독 진행.

---

## 8. 참고 — 현재 관련 파일

```
lib/ai/providers.ts   # AiProvider union, PROVIDERS, ProviderConfig, BYOK_PROVIDERS
lib/ai/client.ts      # getModel, testApiKey, generateSpeech, recommendPersonas, generateConclusion
store/api-key.ts      # 공급사별 키 다중 저장 (수정 불필요)
components/settings/ApiKeyForm.tsx   # BYOK_PROVIDERS 순회 렌더
```
