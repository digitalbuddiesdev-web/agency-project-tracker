-- Agency Project Tracker schema — FRESH INSTALL (roles + shared workspace)
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor) on a new database.
-- NOTE: If you already have the older per-user schema, run supabase/migration_roles.sql instead.

-- 1) profiles — every user maps to a workspace owner and has a role
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','intern','viewer')),
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- members see their own profile row directly
drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select using (auth.uid() = user_id);

-- 2) projects — payloads owned by a workspace via owner_id
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  client text,
  status text,
  type text,
  start date,
  last_activity date,
  duration int,
  hours numeric,
  progress int,
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

alter table public.projects enable row level security;

-- 3) helpers (security definer to avoid RLS recursion)
create or replace function public.is_workspace_member(p_owner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select p_owner_id = auth.uid()
     or exists (
        select 1 from public.profiles
        where owner_id = p_owner_id
          and user_id = auth.uid()
     );
$$;

create or replace function public.can_write()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select role in ('owner','intern') from public.profiles
    where user_id = auth.uid()
  ), true);
$$;

-- 4) shared-workspace policies
drop policy if exists "workspace select" on public.projects;
drop policy if exists "workspace write" on public.projects;
drop policy if exists "workspace update" on public.projects;
drop policy if exists "workspace delete" on public.projects;

create policy "workspace select" on public.projects
  for select using (public.is_workspace_member(owner_id));

create policy "workspace write" on public.projects
  for insert with check (public.is_workspace_member(owner_id) and public.can_write());

create policy "workspace update" on public.projects
  for update using (public.is_workspace_member(owner_id) and public.can_write());

create policy "workspace delete" on public.projects
  for delete using (public.is_workspace_member(owner_id) and public.can_write());

-- 5) RPCs
create or replace function public.my_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid();
$$;

create or replace function public.list_members()
returns table (email text, role text, is_owner boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := (select owner_id from public.profiles where user_id = auth.uid());
begin
  return query
    select u.email::text, p.role, (u.id = p.owner_id)
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.owner_id = v_owner
    order by p.role, u.email;
end;
$$;

create or replace function public.upsert_member(p_email text, p_role text, p_new_owner_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := (select owner_id from public.profiles where user_id = auth.uid());
  v_target uuid;
  v_member uuid;
begin
  if not exists (select 1 from public.profiles where user_id = auth.uid() and role = 'owner' and owner_id = v_owner) then
    raise exception 'Only the workspace owner can manage members';
  end if;

  v_target := (select id from auth.users where email = lower(trim(p_email)) limit 1);
  if v_target is null then
    raise exception 'No user found for email %. Tell them to sign up in the app first.', p_email;
  end if;

  v_member := coalesce(p_new_owner_id, v_owner);

  insert into public.profiles (user_id, role, owner_id, updated_at)
  values (v_target, p_role, v_member, now())
  on conflict (user_id)
  do update set role = excluded.role, owner_id = excluded.owner_id, updated_at = now();

  return 'ok';
end;
$$;
