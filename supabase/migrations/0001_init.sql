-- ============================================================
-- COUNCIL — 초기 스키마
-- ============================================================
-- 적용 방법:
--   1) Supabase 프로젝트 생성 후 .env.local 에 URL/ANON_KEY 추가
--   2) 이 파일을 Supabase Studio → SQL Editor 에 붙여 실행
--      (또는 supabase CLI: `supabase db push`)
-- ============================================================

-- 안전한 재실행을 위해 IF NOT EXISTS / OR REPLACE 사용.

-- ───────────────────────────────────────────── extensions
create extension if not exists "pgcrypto";  -- gen_random_uuid

-- ───────────────────────────────────────────── sessions
create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete cascade,  -- nullable: 비로그인 허용
  device_id    text,                                          -- 익명 모드 식별자 (LocalStorage device_id)
  title        text not null,
  concern      text not null,
  status       text not null default 'active' check (status in ('active', 'concluded')),
  ai_provider  text not null default 'gemini' check (ai_provider in ('gemini', 'groq', 'claude')),
  domain       text,                                          -- 도메인 전문가 동적 분야
  created_at   timestamptz not null default now()
);

create index if not exists sessions_user_idx     on public.sessions (user_id, created_at desc);
create index if not exists sessions_device_idx   on public.sessions (device_id, created_at desc);

-- ───────────────────────────────────────────── personas (마스터 데이터, optional)
-- 코드에서 PERSONA_MAP 으로 가지고 있어 DB에 두지 않아도 동작.
-- DB에 두면 사용자가 커스텀 페르소나를 추가할 수 있는 확장 여지가 생긴다.
create table if not exists public.personas (
  id              text primary key,                            -- slug (cold-investor 등)
  name            text not null,
  role            text not null,
  core_value      text not null,
  debate_style    text not null,
  non_negotiable  text not null,
  weakness        text not null,
  system_prompt   text not null,
  color_from      text not null,
  color_to        text not null,
  is_dynamic      boolean not null default false,
  is_builtin      boolean not null default true,               -- 코드에서 동기화한 기본 10명
  created_at      timestamptz not null default now()
);

-- ───────────────────────────────────────────── session_personas (M:N)
create table if not exists public.session_personas (
  session_id  uuid not null references public.sessions on delete cascade,
  persona_id  text not null references public.personas,
  is_active   boolean not null default true,
  joined_at   timestamptz not null default now(),
  primary key (session_id, persona_id)
);

-- ───────────────────────────────────────────── messages
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions on delete cascade,
  speaker_id  text references public.personas,                -- null = 사용자 발언/지시
  kind        text not null default 'speech' check (kind in ('speech', 'instruction')),
  content     text not null,
  reply_to    uuid references public.messages,
  is_question boolean not null default false,
  token_count integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists messages_session_idx on public.messages (session_id, created_at);

-- ───────────────────────────────────────────── conclusions
-- 4섹션 결론을 JSON으로 보관. 페르소나 입장은 personaPositions 배열.
create table if not exists public.conclusions (
  session_id           uuid primary key references public.sessions on delete cascade,
  key_conclusion       text not null,
  risks                jsonb not null,        -- string[]
  persona_positions    jsonb not null,        -- { personaId, position }[]
  recommended_actions  jsonb not null,        -- string[]
  created_at           timestamptz not null default now()
);

-- ───────────────────────────────────────────── user_credits (3단계 유료)
create table if not exists public.user_credits (
  user_id            uuid primary key references auth.users on delete cascade,
  credits_remaining  integer not null default 0,
  credits_purchased  integer not null default 0,
  updated_at         timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.sessions          enable row level security;
alter table public.session_personas  enable row level security;
alter table public.messages          enable row level security;
alter table public.conclusions       enable row level security;
alter table public.user_credits      enable row level security;
alter table public.personas          enable row level security;

-- personas: 읽기만 누구나
drop policy if exists "personas readable" on public.personas;
create policy "personas readable" on public.personas
  for select using (true);

-- 헬퍼 — 현재 요청자의 device_id (커스텀 헤더 X-Device-Id)
-- Supabase Edge Function 또는 클라이언트 RLS 요청에서 헤더로 전달.
-- 익명 모드용. 로그인 후에는 user_id로 격리.
create or replace function public.current_device_id() returns text
  language sql stable as $$
    select coalesce(current_setting('request.headers', true)::json->>'x-device-id', '')::text;
  $$;

-- sessions
drop policy if exists "sessions own select" on public.sessions;
create policy "sessions own select" on public.sessions
  for select using (
    (auth.uid() is not null and user_id = auth.uid())
    or (auth.uid() is null and device_id is not null and device_id = public.current_device_id())
  );

drop policy if exists "sessions own write" on public.sessions;
create policy "sessions own write" on public.sessions
  for all using (
    (auth.uid() is not null and user_id = auth.uid())
    or (auth.uid() is null and device_id is not null and device_id = public.current_device_id())
  )
  with check (
    (auth.uid() is not null and user_id = auth.uid())
    or (auth.uid() is null and device_id is not null and device_id = public.current_device_id())
  );

-- session_personas, messages, conclusions: 부모 세션을 통한 격리
drop policy if exists "session_personas via session" on public.session_personas;
create policy "session_personas via session" on public.session_personas
  for all using (
    exists (select 1 from public.sessions s where s.id = session_id and (
      (auth.uid() is not null and s.user_id = auth.uid())
      or (auth.uid() is null and s.device_id = public.current_device_id())
    ))
  );

drop policy if exists "messages via session" on public.messages;
create policy "messages via session" on public.messages
  for all using (
    exists (select 1 from public.sessions s where s.id = session_id and (
      (auth.uid() is not null and s.user_id = auth.uid())
      or (auth.uid() is null and s.device_id = public.current_device_id())
    ))
  );

drop policy if exists "conclusions via session" on public.conclusions;
create policy "conclusions via session" on public.conclusions
  for all using (
    exists (select 1 from public.sessions s where s.id = session_id and (
      (auth.uid() is not null and s.user_id = auth.uid())
      or (auth.uid() is null and s.device_id = public.current_device_id())
    ))
  );

-- user_credits
drop policy if exists "credits own" on public.user_credits;
create policy "credits own" on public.user_credits
  for select using (user_id = auth.uid());

-- ============================================================
-- Realtime
-- ============================================================
-- STEP 7 후속: 메시지 추가 시 다른 탭/디바이스로 푸시
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.conclusions;
