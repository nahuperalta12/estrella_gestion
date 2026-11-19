-- Phase 1: roles are assigned only through trusted database administration.
create type public.app_role as enum ('admin', 'collaborator');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  role public.app_role not null default 'collaborator',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- No client write access in phase 1. Disabled accounts cannot read profiles.
create policy profiles_read_self on public.profiles for select to authenticated
  using (id = (select auth.uid()) and active);
-- SECURITY DEFINER prevents recursive RLS; only returns a boolean for the caller.
create function public.is_active_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and active and role = 'admin') $$;
revoke all on function public.is_active_admin() from public, anon;
grant execute on function public.is_active_admin() to authenticated;
create policy profiles_read_admin on public.profiles for select to authenticated
  using ((select public.is_active_admin()));
