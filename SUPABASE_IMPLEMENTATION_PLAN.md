# Supabase-First Implementation Plan (Strava Replica)

This document describes what we are going to create/configure to build a Supabase-first Strava-style app.

Current state in this repo:

- Frontend already uses Supabase Auth (`front_end/src/supabaseClient.js`) and calls backend for profile endpoints.
- Backend already verifies Supabase tokens and exposes profile endpoints under `/api/me/*`.

Goal:

- Use Supabase as much as possible: Auth, Postgres, RLS, Storage, Edge Functions.
- Keep backend small (only for things that must be server-side).

---

## Phase 0: Supabase Project Configuration

We will configure the Supabase project settings:

- Auth Providers
  - Enable Email/Password
  - Enable Google OAuth
- Auth URL Configuration
  - Site URL: `http://localhost:5173`
  - Redirect URLs:
    - `http://localhost:5173/auth/callback`
    - `http://localhost:5173/verification`
    - `http://localhost:5173/reset-password`
- SMTP
  - Use Supabase default for development, or configure a real SMTP provider.

---

## Phase 1: Database Schema (Supabase Postgres)

We will create/maintain these tables in the `public` schema.

### 1) `profiles`

Purpose: app-facing user profile data (not auth).

Fields (planned):

- `id uuid primary key references auth.users(id) on delete cascade`
- `username text not null unique`
- `first_name text`
- `last_name text`
- `avatar_url text`
- `level text`
- `bio text`
- `onboarding_completed_at timestamptz`
- `updated_at timestamptz not null default now()`

Notes:

- We store Supabase user id (UUID) as the profile primary key.

### 2) `activities`

Purpose: a Strava-like activity.

Fields (planned):

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `sport text not null` (ex: `run`, `walk`, `ride`)
- `title text`
- `description text`
- `started_at timestamptz not null`
- `duration_seconds int not null`
- `distance_meters int not null`
- `visibility text not null` (one of: `public`, `followers`, `only_me`)
- `source text not null` (one of: `manual`, `gpx`)
- `route_polyline text` (optional)
- `map_image_url text` (optional)
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Notes:

- Use integers for distance/duration to avoid numeric overflow and simplify validation.

### 3) `activity_media`

Purpose: attach photos/map images/GPX files to activities.

Fields (planned):

- `id uuid primary key default gen_random_uuid()`
- `activity_id uuid not null references public.activities(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `kind text not null` (one of: `photo`, `map`, `gpx`)
- `storage_bucket text not null`
- `storage_path text not null`
- `public_url text`
- `created_at timestamptz not null default now()`

### 4) `follows`

Purpose: follower graph.

Fields (planned):

- `follower_id uuid not null references auth.users(id) on delete cascade`
- `following_id uuid not null references auth.users(id) on delete cascade`
- `created_at timestamptz not null default now()`
- Primary key: `(follower_id, following_id)`

---

## Phase 2: Automatic Profile + Username Generation

We will generate a username automatically in Postgres.

What we will create:

- A Postgres function (trigger function)
  - Runs on `auth.users` insert
  - Creates `public.profiles` row
  - Generates `username` as `user_<short>` using the UUID (example: first 8 chars)
  - Ensures uniqueness (retry with a suffix if needed)

Why:

- No frontend logic required
- No duplicate username races
- Keeps identity handling inside Supabase

---

## Phase 3: RLS Policies (Security)

We will enable RLS and add policies.

### `profiles`

- Select: public can read limited profile fields (or everyone can read all profile fields if you prefer)
- Insert: only the trigger inserts
- Update: only the owner (`auth.uid() = id`)

### `activities`

- Insert/Update/Delete: owner only (`auth.uid() = user_id`)
- Select:
  - public: `visibility = 'public'`
  - owner: can always read own
  - followers: can read `visibility = 'followers'` if a follow row exists

### `activity_media`

- Insert/Delete: owner only
- Select: allowed when the corresponding activity is readable

### `follows`

- Insert/Delete: follower is current user
- Select: optional (for profile pages)

---

## Phase 4: Storage Buckets

We will create these buckets in Supabase Storage:

- `avatars`
  - Stores profile avatars
- `activity-media`
  - Stores activity photos + generated map images
- `gpx`
  - Stores raw GPX uploads

Storage policies:

- Simplest dev setup: buckets public.
- Production setup: private buckets + signed URLs + RLS-like policies.

---

## Phase 5: Edge Functions (GPX Import + Map Generation)

We will implement a Supabase Edge Function:

- Function: `import-gpx`

Input:

- `activity_id` (optional; create new if missing)
- `gpx_storage_path` (where the GPX file was uploaded)
- `visibility`, `title`, `description` (optional overrides)

Behavior:

- Download GPX from Storage
- Parse track points
- Compute:
  - distance
  - duration
  - polyline
- Generate a static map image (via a map provider API)
- Upload map image to `activity-media`
- Update `activities` fields and add `activity_media` rows

Notes:

- We will need a map provider API key (Mapbox/Google/etc.). This stays as an Edge Function secret.

---

## Phase 6: API Endpoints Needed by Frontend

We will keep the backend minimal. The frontend will mostly talk directly to Supabase.

### Backend endpoints (keep)

- `GET /api/me`
- `PUT /api/me/personal`
- `PUT /api/me/physical`
- `POST /api/me/avatar`

### Supabase direct access (frontend)

- Activities: use `supabase.from('activities')...` for CRUD (RLS enforced)
- Feed queries: via SQL view or RPC function if needed
- Media uploads: direct Storage upload from frontend (or signed upload)

---

## Phase 7: Frontend Pages We Will Implement/Update

We will implement these pages and connect them to the DB:

- Activity create (manual)
- Activity details
- Profile page
- User activities list
- Feed
- Follow/unfollow UI

---

## Deliverables (What Will Be Added To The Repo)

1) SQL migrations (stored as SQL files under a `supabase/` or `backend/sql/` folder)
   - Tables
   - Trigger for profile + username
   - RLS policies

2) Supabase Edge Function code
   - `supabase/functions/import-gpx/*`

3) Frontend feature code
   - Activities pages + components
   - Supabase queries
   - Upload flows

4) Backend minimal changes (only if needed)
   - Keep auth guard
   - Keep `/api/me/*`
   - Optional: endpoint(s) for signed uploads

---

## Decisions Needed Before We Start Coding

1) Username format
   - `user_<uuid8>` (recommended)
   - or based on first/last name + suffix

2) Bucket privacy
   - Public (fast) vs private with signed URLs (more correct)

3) Map provider
   - Mapbox Static Images vs Google Static Maps vs other
