-- Agency Project Tracker schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor).
-- Applies RLS so each user only sees their own projects (per-user accounts).

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  client text,
  status text,
  type text,
  start date,
  last_activity date,
  duration int,
  hours numeric,
  location text,
  tech text,
  scope text,
  team text,
  billing text,
  commits text,
  folder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- enable RLS
alter table public.projects enable row level security;

-- each user can only select/insert/update/delete their own rows
create policy "users select own" on public.projects
  for select using (auth.uid() = user_id);

create policy "users insert own" on public.projects
  for insert with check (auth.uid() = user_id);

create policy "users update own" on public.projects
  for update using (auth.uid() = user_id);

create policy "users delete own" on public.projects
  for delete using (auth.uid() = user_id);
