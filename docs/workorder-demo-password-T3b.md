# 워크오더 T-3b — 데모 비밀번호 게이트 (고정 링크)

설계: Fable / 판정: David / 기준: origin/main = 5be9b24

T-3 의 서명 링크는 **링크 자체가 열쇠**라 회수가 불가능하고, 그래서 TTL 상한(2주)이
유일한 안전장치였다. David 판정 — **비밀번호를 게이트로 두어 링크를 고정한다.**

| | T-3 서명 링크 | T-3b 비밀번호 |
|---|---|---|
| 주소 | 발급마다 다름, 2주 만료 | **`/demo` 고정. 만료 없음** |
| 회수 | 불가 (SECRET 교체 = 전체 무효) | **`DEMO_PASSWORD` 교체로 즉시 차단** |
| 만료 시 | 어드민 로그인해 재발급 | **비밀번호 다시 입력** |

`/admin` 로그인(`lib/admin/auth.ts`)과 같은 패턴을 재사용한다. 새로 발명하지 마라.

---

## §A `env.ts` + `.env.example` — DEMO_PASSWORD

`ADMIN_PASSWORD` 와 같은 방식으로 `DEMO_PASSWORD` 를 추가한다 (optional, 서버 전용).
**`NEXT_PUBLIC_` 접두 금지.**

## §B `lib/demo/auth.ts` — 신설

`lib/admin/auth.ts` 의 `isAdminEnabled` / `checkPassword` 를 그대로 본떠서:

- `isDemoEnabled(): boolean` — `DEMO_PASSWORD` 설정 여부 (최소 8자)
- `checkDemoPassword(input: string): boolean` — `timingSafeEqual`, 길이 선가드 포함

**쿠키는 쓰지 않는다.** 어드민과 달리 데모는 티켓을 발급한다(§C).

## §C `app/api/demo/login/route.ts` — 신설

`POST { password }` → 검증 → **demo 티켓 발급**.

- `checkDemoPassword` 실패 시 401. `/api/admin/login` 과 같은 무차별 대입 딜레이를 둔다.
- `isDemoEnabled()` false → 503, `gateEnabled()` false → 503.
- 성공 시 `mintTicket('demo', 'demo', TTL)` 로 발급해 `{ ticket }` 반환.
  - `sub` 은 `'demo'` 고정. 비밀번호 방식엔 개인 식별이 없고, 사용량은 어차피
    브라우저 로컬 집계라 라벨을 받아도 구분되지 않는다.
  - TTL 은 **1년 고정**(`60*60*24*365`). 데모 환경은 본인 전용(시연·내부 사용)이라
    공유하지 않는다 — 다른 사용자는 BYOK 또는 유료로 들어온다. 그래서 정기 갱신도
    회수 장치도 두지 않는다.
- 미들웨어 matcher 는 `/admin/:path*` · `/api/admin/:path*` 뿐이라 이 경로는
  자동으로 공개다. **matcher 를 건드리지 마라.**

## §D `app/demo/page.tsx` + 입력 폼 — 신설

- 비밀번호 입력 한 칸 + 제출. `app/admin/login` 의 `LoginForm` 구조를 참고한다.
- 성공 시 응답의 ticket 을 **localStorage 키 `council:access-ticket`** 에 저장하고
  `/` 로 이동한다. 그러면 기존 `AccessTicketBridge` 가 복원 경로로 집어 든다 —
  키 이름을 반드시 그대로 맞출 것. 저장은 `AccessTicketBridge` 가 내보내는
  헬퍼(`writeStoredTicket`)로만 한다 — `#t=` URL 진입 경로와 로그인 폼 경로가
  서로 다른 저장소를 보면 조용히 어긋난다.
  (데모 환경은 본인 전용이라 tab 종료로 사라지는 sessionStorage 대신
  localStorage 로 굳는다 — TTL 1년짜리 티켓과 짝이 맞다.)
- 실패 시 에러 문구만 표시. 비밀번호를 URL 어디에도 남기지 마라.
- `DEMO_PASSWORD` 미설정이면 안내 문구만 띄운다.

## §E 기존 `/admin/demo-links` — 그대로 둔다

삭제하지 마라. 비밀번호 전달이 번거로운 상대에게 링크만 주는 용도로 남긴다.
단, 안내 문구의 `?t=<ticket>` 표기가 실제 `#t=` 와 다르다 — **이것만 고친다.**

---

## §F 하지 말 것

- Supabase·계정·쿼터 일체 금지 (T-4 범위).
- `lib/prompts/*` 무수정.
- `store/usage.ts` · `lib/ai/pricing.ts` · `lib/ai/errors.ts` · `runWithFallback` 무수정
  (T-1·T-2 완료분).
- `components/access/AccessTicketBridge.tsx` · `components/embed/EmbedBridge.tsx` 무수정.
- `middleware.ts` matcher 무수정.
- `lib/ai/gate.ts` 서명 로직 무수정 — `mintTicket` 을 호출만 한다.
- 데모 비밀번호를 쿠키·localStorage 에 저장하지 마라. 티켓만 sessionStorage 로.

## §G 합격선

1. `pnpm typecheck` · `pnpm build` 통과.
2. `DEMO_PASSWORD` 미설정 시 `/demo` 가 안내 문구를 띄우고 500 이 나지 않을 것.
3. 틀린 비밀번호 → 401, 티켓 미발급.
4. 맞는 비밀번호 → `/` 이동 후 키 입력 없이 토론 시작 가능(= 서버 모드 진입).
5. 기존 `/admin/demo-links` 발급 링크가 여전히 동작할 것 (회귀).

## §H 검증 (David 손)

1. Vercel 에 `DEMO_PASSWORD` 등록 후 Redeploy.
2. 시크릿 창에서 `/demo` → 비밀번호 → 토론 시작되는지.
3. `DEMO_PASSWORD` 를 바꾸고 Redeploy → **기존 세션은 티켓 TTL 까지 유지되지만
   새 로그인은 옛 비밀번호로 안 되는지** (차단 동작 확인).
