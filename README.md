# COUNCIL

> "내 고민을 들고 들어가면, 내가 섭외한 전문가들이 눈치 없이 싸워주는 곳"

혼자 결정해야 하는 창업자/1인 개발자에게 AI 전문가 패널이 서로 반박하며 토론해주는 의사결정 도구.
**사용자가 감독, AI가 배우.** "맞습니다 대표님"은 시스템 레벨에서 차단.

설계 원칙·로드맵·페르소나 명세 등 모든 컨텍스트는 상위 `../CLAUDE.md`에 정리되어 있다.

---

## 빠른 시작

```bash
# 의존성 설치
pnpm install
# (pnpm이 없다면 npm install / yarn 도 가능)

# 환경변수 — 1-2단계 BYOK 모드만 쓸 거면 ANTHROPIC_API_KEY 생략 가능
cp .env.example .env.local

# 개발 서버
pnpm dev
# → http://localhost:3000
```

처음 들어가면 홈에 "API 키 먼저 설정" 안내가 뜬다.
설정 페이지에서 Gemini 또는 Groq 무료 키를 발급받아 저장 + 연결 테스트하면 BYOK 모드 활성화.

---

## 현재 구현된 범위 (STEP 1-7 전체)

- [x] **STEP 1** — 10명 페르소나 시스템 프롬프트 + 토론 오케스트레이터 + 추천 로직 (`lib/prompts/`)
- [x] **STEP 2** — BYOK API 키 설정 화면 (`/settings`)
  - Gemini / Groq 두 공급사 지원
  - 키 발급 직링크, 30초 가이드, 즉시 연결 테스트
  - "키는 이 기기에만 저장됨" 보안 안내
- [x] **STEP 3** — 고민 입력 + 페르소나 추천 + 패널 구성 (`/session/new`)
  - INPUT → ANALYZING → PICKING 3단계 상태머신
  - `recommendPersonas` (Zod enum으로 LLM 환각 ID 차단)
  - 사회자 자동 포함, 풀에서 토글로 추가/제거
  - 도메인 전문가 동적 분야 주입
- [x] **STEP 4** — 실시간 자동 토론 엔진 (`/session/[id]`)
  - `useDebate` 훅 — status 머신 (idle/running/paused/concluding/concluded/error)
  - `decideNextSpeaker` (rule-based, LLM 비용 0) → `generateSpeech` 루프
  - 동일 페르소나 3회 연속 금지, 균등 발언 분배, 사회자 SOFT_LIMIT 트리거
  - 발언 카드 + 반박 연결선 + 질문 뱃지 + 자동 스크롤
  - "생각 중…" 인디케이터 (스켈레톤 금지)
  - 일시정지/재개/결론 트리거 sticky 컨트롤
  - HARD_LIMIT 도달 시 자동 결론 전환
- [x] **STEP 6** — 결론 요약 화면 (`/session/[id]/summary`)
  - 핵심 결론 / 주요 리스크 3 / 페르소나별 입장 / 추천 액션 3
  - 결론 완료 시 회의실에서 자동 배너 표시
- [x] **STEP 5** — 사용자 개입 (`components/debate/UserInput.tsx`)
  - 3탭: 발언 / 지시 / 페르소나+
  - 발언: 사용자 메시지로 추가 → 페르소나들이 반응 (paused면 자동 재개)
  - 지시: 메타 지시 (5개 프리셋 칩) → buildDebateContext에 강제 주입
  - 페르소나+: 풀에서 진행 중 추가
- [x] **STEP 7** — Supabase 스캐폴딩 (env 미설정 시 LocalStorage 폴백)
  - `supabase/migrations/0001_init.sql` — sessions/personas/messages/conclusions + RLS + Realtime
  - `supabase/seed.sql` — 10명 페르소나 시드
  - `lib/supabase/{client,server,types,sync}.ts` — env 가드 + write-through 헬퍼
  - 익명 device_id 기반 격리 (로그인 전), `auth.uid()` 격리 (로그인 후)
- [x] 홈 + `/history` 실제 데이터 연결 (LocalStorage Zustand persist)
- [x] 디자인 시스템 (Pretendard CDN, Syne, JetBrains Mono, 다크 테마, PersonaOrb)

---

## 폴더 구조

```
council/
├── app/
│   ├── layout.tsx              # 폰트, 메타데이터, Toaster
│   ├── globals.css             # 디자인 토큰 (CSS 변수)
│   └── (main)/
│       ├── layout.tsx          # 헤더(로고 + 설정 버튼)
│       ├── page.tsx            # 홈
│       ├── settings/page.tsx   # BYOK 키 설정
│       ├── history/page.tsx    # 회의 기록 전체
│       └── session/
│           ├── new/page.tsx           # 고민 → 추천 → 패널 구성
│           └── [id]/
│               ├── page.tsx           # 실시간 회의실 (DebateFeed + Controls)
│               └── summary/page.tsx   # 결론 4섹션
├── components/
│   ├── home/                   # HomeHero, RecentSessions
│   ├── settings/               # ApiKeyForm (BYOK)
│   ├── persona/                # PersonaOrb, PersonaCard
│   ├── session/                # ConcernInput, PersonaPicker
│   ├── debate/                 # MessageCard, TypingIndicator, DebateFeed, DebateControls
│   └── ui/                     # shadcn/ui — Button, Input, Label, Card, Textarea
├── hooks/
│   ├── useHasMounted.ts        # SSR 하이드레이션 가드
│   └── useDebate.ts            # 자동 토론 루프 (status 머신 + LLM)
├── lib/
│   ├── ai/
│   │   ├── client.ts           # 브라우저 직접 호출 + recommend/speech/conclusion
│   │   └── providers.ts        # 공급사 추상화
│   ├── prompts/
│   │   ├── base.ts             # 공통 굴복 방지 베이스
│   │   ├── orchestrator.ts     # 토론 규칙 + 컨텍스트 + 결론 schema
│   │   ├── recommender.ts      # 페르소나 추천 schema (enum)
│   │   └── personas/index.ts   # 10명 페르소나 마스터 데이터
│   └── utils.ts                # cn() 헬퍼
├── store/
│   ├── api-key.ts              # BYOK 키 (Zustand persist)
│   └── sessions.ts             # 세션/메시지/도메인 (LocalStorage)
├── types/
│   ├── debate.ts               # Session, Message
│   └── persona.ts              # Persona, DebateStyle
└── env.ts                      # T3 Env (타입 안전 환경변수)
```

---

## 기술 스택

- **Framework**: Next.js 14 App Router + TypeScript strict
- **Styling**: Tailwind CSS v3 + shadcn/ui + CSS 변수
- **State**: Zustand v5 (persist) — 추후 TanStack Query v5 (서버 데이터)
- **AI**: Vercel AI SDK v4 (`generateObject` 필수) + Gemini/Groq/Claude 어댑터
- **Validation**: Zod
- **Toast**: sonner v1
- **Icons**: lucide-react
- **Forms**: React Hook Form + Zod (다음 단계부터)
- **DnD**: @dnd-kit/core (STEP 3에서)

---

## 절대 원칙

1. **굴복 금지** — `lib/prompts/base.ts` 의 굴복 방지 규칙은 모든 페르소나에 강제 prepend.
2. **단순함 우선** — 1인 유지보수. MSA·Redis·k8s 금지.
3. **비용 0원** — 오픈 베타는 BYOK. 서버 AI 비용 $0.
4. **모바일 퍼스트** — 회의실은 세로 스크롤 최적화.

자세한 금지 항목은 `../CLAUDE.md ⓬ 하지 말 것` 참조.

---

## 검증

```bash
pnpm typecheck   # strict + noUncheckedIndexedAccess
pnpm lint
pnpm build
```

---

## Supabase 연결 (선택)

`.env.local` 에 두 값을 채우면 Supabase 사용 가능. 비워두면 LocalStorage만으로 정상 동작.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

스키마 적용:

1. **Supabase Studio** → SQL Editor 열기
2. `supabase/migrations/0001_init.sql` 내용 붙여 실행 (테이블 + RLS + Realtime)
3. `supabase/seed.sql` 붙여 실행 (페르소나 10명 시드)

또는 Supabase CLI:
```bash
supabase link --project-ref YOUR_PROJECT
supabase db push        # 마이그레이션
psql -h db.YOUR.supabase.co -U postgres -f supabase/seed.sql
```

RLS는 두 가지 격리 모드를 지원한다:
- **익명 모드** (1-2단계): 클라이언트가 `x-device-id` 헤더로 LocalStorage device_id 전달 → `current_device_id()` 함수로 세션 격리
- **로그인 모드** (3단계): `auth.uid()` 기반 격리

현재 코드는 `lib/supabase/{client,server,sync}.ts`에 write-through 헬퍼만 준비된 상태.
실제 store와의 양방향 동기화 + Realtime 구독은 다음 마일스톤.

## 다음 마일스톤 후보

- **Supabase write-through 통합** — `useSessionsStore`의 action에서 `pushSession`/`pushMessage`/`pushConclusion` 호출 + 앱 로드 시 `pullSessions`로 머지
- **Realtime 구독** — 다른 디바이스에서 발언 추가 시 즉시 동기화
- **Auth (Supabase magic link)** — 익명 device_id를 user_id로 마이그레이션
- **드래그 인터랙션** — `@dnd-kit`으로 PersonaPicker 고도화
- **모션 디테일** — `motion` 으로 발언 카드 등장 애니메이션 / orb 호흡
- **결제(3단계)** — Stripe/토스 + `user_credits` 차감 + Anthropic 서버 호출
