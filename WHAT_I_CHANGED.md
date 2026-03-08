# What I Changed

This file tracks the changes made while starting the Supabase-first implementation.

## Added

- `SUPABASE_IMPLEMENTATION_PLAN.md`
  - High-level plan: tables, RLS, Storage, Edge Function milestone.
- `supabase/README.md`
  - How to apply SQL in Supabase.
- `supabase/sql/001_init.sql`
  - Creates/extends core tables in `public`:
    - `profiles` (adds `username`, `bio`, etc.)
    - `activities`
    - `activity_media`
    - `follows`
  - Adds trigger on `auth.users` to auto-create profile + auto-generate username.
  - Enables RLS and creates policies for all tables.

- Backend activities + users modules:
  - `backend/src/modules/activities/activities.controller.ts`
  - `backend/src/modules/activities/activities.module.ts`
  - `backend/src/modules/activities/activities.dto.ts`
  - `backend/src/modules/activities/gpx.dto.ts`
  - `backend/src/modules/users/users.controller.ts`
  - `backend/src/modules/users/users.module.ts`
  - `backend/src/supabase/supabase.request.ts`

- Edge Function:
  - `supabase/functions/import-gpx/index.ts`
  - `supabase/functions/import-gpx/README.md`
  - Note: function now only parses GPX and returns stats (no DB writes), so backend can use ORM.

- Frontend API helpers:
  - `front_end/src/api/activities.js`

- Docs:
  - `FRONTEND_API_ENDPOINTS.md`

## Modified

- `backend/src/app.module.ts`
  - Registered `UsersModule` and `ActivitiesModule`.
- `backend/src/auth/supabase.guard.ts`
  - Stores the verified Supabase access token on the request for downstream Supabase calls.
- `backend/src/me/me.dto.ts`
  - Added `UpdateMeDto` for `PUT /api/me` (single update endpoint).
- `backend/src/modules/me/me.controller.ts`
  - Added `PUT /api/me` and `GET /api/me/activities`.
- `front_end/src/backendApi.js`
  - Default backend base URL now `http://localhost:3004`.

## How To Use

1) Open Supabase Dashboard -> SQL Editor
2) Run: `supabase/sql/001_init.sql`

After this:

- New signups will automatically get a `profiles` row.
- `username` is auto-generated and unique.
- Activity visibility is enforced by RLS.

Next required step (Supabase):

- Run `supabase/sql/001_init.sql` in the Supabase SQL editor (creates `activities`, `activity_media`, `follows`, and the profile trigger).
