-- Supabase-first schema for Strava replica (public schema)
-- Safe to run multiple times where possible.

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  first_name varchar(100),
  last_name varchar(100),
  date_of_birth date,
  gender varchar(20),
  level varchar(50),
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  bio text,
  onboarding_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Add missing columns for existing tables (if your table was created earlier)
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;

-- Backfill username for existing rows, then enforce uniqueness + not null.
update public.profiles
set username = coalesce(username, 'user_' || left(replace(user_id::text, '-', ''), 10))
where username is null;

create unique index if not exists profiles_username_key on public.profiles(username);

alter table public.profiles
  alter column username set not null;

-- ---------------------------------------------------------------------
-- Auto-create profile + username on signup
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  i int;
begin
  -- Prefer provider name if available; fall back to 'user'
  base := lower(coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    'user'
  ));

  -- Convert to a simple slug-like format
  base := regexp_replace(base, '[^a-z0-9]+', '_', 'g');
  base := trim(both '_' from base);
  if base = '' then
    base := 'user';
  end if;
  if length(base) > 20 then
    base := left(base, 20);
  end if;

  -- Deterministic suffix from UUID
  candidate := base || '_' || left(replace(new.id::text, '-', ''), 6);

  for i in 1..5 loop
    begin
      insert into public.profiles (user_id, username)
      values (new.id, candidate)
      on conflict (user_id) do update
        set username = coalesce(public.profiles.username, excluded.username);
      return new;
    exception when unique_violation then
      candidate := base || '_' || left(replace(gen_random_uuid()::text, '-', ''), 8);
    end;
  end loop;

  -- Last-resort fallback
  insert into public.profiles (user_id, username)
  values (new.id, 'user_' || left(replace(new.id::text, '-', ''), 10))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Follow graph
-- ---------------------------------------------------------------------

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);

-- ---------------------------------------------------------------------
-- Activities
-- ---------------------------------------------------------------------

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  sport text not null,
  title text,
  description text,

  started_at timestamptz not null,
  duration_seconds int not null,
  distance_meters int not null,

  visibility text not null,
  source text not null default 'manual',

  route_polyline text,
  map_image_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_user_id_idx on public.activities(user_id);
create index if not exists activities_started_at_idx on public.activities(started_at desc);
create index if not exists activities_visibility_idx on public.activities(visibility);

-- Basic check constraints
alter table public.activities
  drop constraint if exists activities_visibility_check;
alter table public.activities
  add constraint activities_visibility_check
  check (visibility in ('public', 'followers', 'only_me'));

alter table public.activities
  drop constraint if exists activities_source_check;
alter table public.activities
  add constraint activities_source_check
  check (source in ('manual', 'gpx'));

-- ---------------------------------------------------------------------
-- Activity media
-- ---------------------------------------------------------------------

create table if not exists public.activity_media (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  kind text not null,
  storage_bucket text not null,
  storage_path text not null,
  public_url text,

  created_at timestamptz not null default now()
);

create index if not exists activity_media_activity_id_idx on public.activity_media(activity_id);
create index if not exists activity_media_user_id_idx on public.activity_media(user_id);

alter table public.activity_media
  drop constraint if exists activity_media_kind_check;
alter table public.activity_media
  add constraint activity_media_kind_check
  check (kind in ('photo', 'map', 'gpx'));

-- ---------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_activities_updated_at on public.activities;
create trigger set_activities_updated_at
before update on public.activities
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.activity_media enable row level security;
alter table public.follows enable row level security;

-- Profiles policies
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles
for select
to public
using (true);

drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update" on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Activities policies
drop policy if exists "activities_owner_insert" on public.activities;
create policy "activities_owner_insert" on public.activities
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "activities_owner_update" on public.activities;
create policy "activities_owner_update" on public.activities
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "activities_owner_delete" on public.activities;
create policy "activities_owner_delete" on public.activities
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "activities_select_visibility" on public.activities;
create policy "activities_select_visibility" on public.activities
for select
to public
using (
  visibility = 'public'
  or auth.uid() = user_id
  or (
    visibility = 'followers'
    and auth.uid() is not null
    and exists (
      select 1
      from public.follows f
      where f.following_id = public.activities.user_id
        and f.follower_id = auth.uid()
    )
  )
);

-- Activity media policies
drop policy if exists "media_owner_insert" on public.activity_media;
create policy "media_owner_insert" on public.activity_media
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "media_owner_delete" on public.activity_media;
create policy "media_owner_delete" on public.activity_media
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "media_select_if_activity_visible" on public.activity_media;
create policy "media_select_if_activity_visible" on public.activity_media
for select
to public
using (
  exists (
    select 1
    from public.activities a
    where a.id = public.activity_media.activity_id
      and (
        a.visibility = 'public'
        or auth.uid() = a.user_id
        or (
          a.visibility = 'followers'
          and auth.uid() is not null
          and exists (
            select 1
            from public.follows f
            where f.following_id = a.user_id
              and f.follower_id = auth.uid()
          )
        )
      )
  )
);

-- Follow policies
drop policy if exists "follows_select_public" on public.follows;
create policy "follows_select_public" on public.follows
for select
to public
using (true);

drop policy if exists "follows_owner_insert" on public.follows;
create policy "follows_owner_insert" on public.follows
for insert
to authenticated
with check (auth.uid() = follower_id);

drop policy if exists "follows_owner_delete" on public.follows;
create policy "follows_owner_delete" on public.follows
for delete
to authenticated
using (auth.uid() = follower_id);
