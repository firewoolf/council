create table if not exists public.user_profile (
  device_id         text primary key,
  observed_patterns jsonb not null default '[]'::jsonb,
  updated_at        timestamptz not null default now()
);

alter table public.user_profile enable row level security;

drop policy if exists "user_profile own" on public.user_profile;
create policy "user_profile own" on public.user_profile
  for all using (
    device_id = public.current_device_id()
  )
  with check (
    device_id = public.current_device_id()
  );
