# 워크오더 T-3 — 접속 모드 3종 + 데모 서명 링크

설계: Fable / 판정: David / 기준: origin/main = 0896025

**Supabase·계정은 이 워크오더 범위가 아니다.** 데모까지는 계정 없이 간다 —
서명 링크(`gate.ts` HMAC 티켓)가 신원 역할을 하고 TTL 이 어뷰즈를 막는다.
계정·쿼터·유료는 T-4 로 미룬다.

---

## §0 현행 구조 (실측)

```
insight-out 임베드 → postMessage(ticket) → EmbedBridge.setTicket()
  → /api/ai/config (x-council-ticket) → setServerProviders()
  → isServerMode() = !!ticket && serverProviders.length > 0
  → access.resolveKeys() 가 센티넬 맵 반환 → getModel 이 프록시로 전환
```

문제: 티켓 진입 경로가 **postMessage 하나뿐**이라 독립 앱은 영영 BYOK 로 떨어진다.
2026-09-08 프로덕션 실측에서 확인됨(하단에 "COUNCIL · BYOK 모드" 표시).

## §0-1 목표 상태

| mode | 대상 | 키 | 진입 |
|---|---|---|---|
| `byok` | 내부 테스트 | 사용자 키 | 티켓 없음 (기본) |
| `demo` | 데모 대상자 | 무료 서버키 | **서명 링크 `?t=<ticket>`** |
| `paid` | 유료 사용자 | 유료 서버키 | insight-out 임베드 (현행) |

**현행 임베드 경로를 깨뜨리지 말 것.** 프로덕션에서 돌고 있다.

---

## §A `lib/ai/gate.ts` — 티켓에 mode 추가

`TicketPayload` 에 `mode?: 'demo' | 'paid'` 를 추가한다.

- `mintTicket(userId, mode, ttlSeconds)` 로 시그니처 확장. 기존 호출부가 있으면 유지되게 기본값을 둔다.
- `verifyTicket` 은 **`mode` 가 없으면 `'paid'` 로 간주한다.** insight-out 이 이미
  발급한 기존 티켓과의 하위 호환이다. 이 기본값을 바꾸지 말 것.
- HMAC 대상(body)은 payload JSON 전체이므로 필드 추가만으로 서명이 자연히 커버된다.
  서명 알고리즘은 건드리지 마라 — insight-out 측이 같은 로직을 쓴다.

## §B 티켓 URL 진입 — 서명 링크

현행 `EmbedBridge` postMessage 경로는 그대로 두고, **URL 쿼리 진입을 추가**한다.

- `?t=<ticket>` 이 있으면 `setTicket` 하고 `/api/ai/config` 를 같은 방식으로 조회한다.
- 읽은 뒤 **URL 에서 `t` 파라미터를 제거**한다 (`router.replace`). 히스토리·어깨너머 노출 방지.
- 티켓은 **sessionStorage** 에 보관한다. 새로고침은 견디고 탭을 닫으면 사라진다.
  localStorage 는 쓰지 마라 — 티켓은 짧은 수명이다.
- 새 클라이언트 컴포넌트로 분리하고 루트 레이아웃에 얹는다. `EmbedBridge` 를 고치지 마라.

## §C `lib/ai/access.ts` — 모드 축

```ts
export type AccessMode = 'byok' | 'demo' | 'paid';
export function currentMode(): AccessMode;
```

- 티켓이 없거나 서버 공급사가 비면 `'byok'`.
- 있으면 티켓 payload 의 `mode` 를 따른다 (없으면 `'paid'`).
- 클라이언트가 payload 를 읽어야 하므로 `/api/ai/config` 응답에 `mode` 를 실어 보낸다.
  **클라이언트에서 티켓을 직접 디코드하지 마라** — 서버가 검증한 값만 신뢰한다.
- `resolveKeys()` 의 배타적 return 구조는 **그대로 둔다.** 병합하지 마라.
  한 사용자는 한 모드에만 속한다(David 판정).

## §D 모드별 청크 라우팅

| mode | 청크 공급사 |
|---|---|
| `paid` | **Gemini 고정** (세션 8.4원. Groq 라우팅이면 26.4원으로 3배) |
| `demo` | 등록된 무료 공급사 **라운드로빈** |
| `byok` | 현행 그대로 (사용자 키 기준) |

### D-1 라운드로빈은 세션 단위 — 청크마다 바꾸지 말 것

청크마다 모델이 바뀌면 P-A 보이스 카드가 잡아둔 페르소나 목소리가
**장면마다 다른 사람처럼** 들린다. 데모에서 가장 티 나는 실패다.

**상태를 저장하지 말고 `sessionId` 해시로 결정한다:**

```
index = hash(sessionId) % 후보수
```

세션 내내 같은 공급사가 나오고, 새로고침해도 동일하며, 세션마다 달라진다.
저장소가 필요 없다.

### D-2 구현 위치

`runWithFallback` 이 `available` 을 모드에 맞게 **미리 걸러서** `pickProvider` 에 넘긴다.
`pickProvider` 시그니처는 건드리지 마라 — 호출부 연쇄 수정이 딸려온다.

폴백은 그대로 살아 있어야 한다. 1순위가 실패하면 T-2 의 `isRetryable` 경로로
다음 후보로 넘어간다.

## §E `/admin` — 데모 링크 발급 UI

`/admin` 에 데모 링크 생성 화면을 추가한다 (기존 어드민 인증 아래).

- 입력: 대상자 라벨(예: `demo-hong`), TTL(기본 24시간)
- 출력: `https://<origin>/?t=<ticket>` 복사 버튼
- **서버 액션 또는 API 라우트로 발급한다.** `mintTicket` 은 `node:crypto` 를 쓰는
  서버 전용 모듈이다 — 클라이언트로 import 하면 빌드가 깨진다.
- 발급 이력은 저장하지 않는다 (저장소 없음). 링크는 생성 시점에만 보인다.

---

## §F 하지 말 것

- **Supabase·계정·쿼터 일체 금지.** T-4 범위다.
- `lib/prompts/*` 무수정.
- `store/usage.ts` · `lib/ai/pricing.ts` 무수정 (T-1 완료분).
- `lib/ai/errors.ts` · `runWithFallback` 의 폴백 분류 로직 무수정 (T-2 완료분).
  `runWithFallback` 은 §D-2 의 후보 필터만 추가한다.
- `components/embed/EmbedBridge.tsx` 무수정. 현행 임베드 경로를 깨면 안 된다.
- 클라이언트에서 티켓 payload 를 디코드하지 말 것.
- 공급사 신규 추가 금지 (mistral 등 5종은 보류 판정).

## §G 합격선

1. `pnpm typecheck` · `pnpm build` 통과.
2. `gate.ts` 단위 테스트 — `mode` 없는 기존 티켓이 `'paid'` 로 검증될 것 (하위 호환).
3. 티켓 없이 접속 → `byok` 모드, 설정 화면에서 키 요구 (현행 동작 유지).
4. `?t=` 링크 접속 → 서버 모드 진입, URL 에서 `t` 제거됨, 새로고침해도 유지.
5. 같은 `sessionId` 는 항상 같은 데모 공급사로 라우팅될 것 (해시 결정성).

## §H 검증 (David 손)

1. `/admin` 에서 데모 링크 발급 → 시크릿 창에서 열기 → 키 입력 없이 토론 시작되는지.
2. 세션 1회 완주 후 `/admin/usage` 에서 공급사 확인 — **한 세션 안에서 공급사가
   하나로 유지되는지**가 §D-1 검증이다.
3. 프로덕션 기본 URL(티켓 없음)이 여전히 BYOK 로 뜨는지 — 회귀 확인.
