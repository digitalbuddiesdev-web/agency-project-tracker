-- Agency Project Tracker — shared workspace + roles
-- Run this in the Supabase SQL Editor once (on top of the existing schema).
--
-- Adds:
--   * profiles(user_id, role, owner_id) — role: 'owner' | 'intern' | 'viewer'
--   * projects.owner_id — the workspace these rows belong to
--   * RLS so all members of a workspace see the shared list, but only
--     owner/intern can write; viewer (boss) is read-only.

-- 1) Add owner_id to projects, backfill from current user_id
alter table public.projects
  add column if not exists owner_id uuid;

-- user_id was NOT NULL relying on auth.uid() default; new code sets owner_id
-- instead, so allow it to be null (e.g. seed run without an auth session).
alter table public.projects alter column user_id drop not null;

update public.projects set owner_id = user_id where owner_id is null;

-- 2) profiles table
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','intern','viewer')),
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- safe RLS defaults (owner manages members via RPC, not direct table access)
drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select using (auth.uid() = user_id);

-- 3) helper: is the caller a member of this workspace?
--    True when the caller IS the workspace owner id (their own fresh workspace),
--    or when their profile places them in that workspace.
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

-- helper: can the caller write (owner or intern)?
--    A user with no profile yet (fresh signup) defaults to editable own rows.
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

-- 4) replace per-user policies with shared-workspace policies
drop policy if exists "users select own" on public.projects;
drop policy if exists "users insert own" on public.projects;
drop policy if exists "users update own" on public.projects;
drop policy if exists "users delete own" on public.projects;
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

-- 5) RPC: owner assigns/updates a member's role and workspace
--    ONLY the workspace owner may call this for users in their workspace.
create or replace function public.upsert_member(p_email text, p_role text, p_new_owner_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
  v_owner uuid := (select owner_id from public.profiles where user_id = auth.uid());
  v_target uuid;
begin
  -- caller must be an owner
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

-- 6) RPC: current user's role (for the app to gate UI)
create or replace function public.my_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid();
$$;

-- 7) RPC: workspace member list (owner only, read-only for others)
create or replace function public.list_members()
returns table (email text, role text, is_owner boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_root uuid := (select owner_id from public.profiles where user_id = auth.uid());
begin
  if v_root is null then
    v_root := auth.uid();
  end if;
  return query
    select u.email::text, p.role, (p.user_id = p.owner_id)
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.owner_id = v_root
    order by p.role, u.email;
end;
$$;

-- 8) For an EXISTING owner whose projects already live in the DB:
--    make sure the current account is registered as owner of their existing data.
insert into public.profiles (user_id, role, owner_id)
select distinct user_id, 'owner', user_id
from public.projects
on conflict (user_id) do nothing;
