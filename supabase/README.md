# Supabase SQL + Functions

This folder contains SQL you can run in Supabase Dashboard -> SQL Editor.

Recommended order:

1) `supabase/sql/001_init.sql`

Notes:

- These scripts only touch the `public` schema and add a trigger on `auth.users`.
- Do NOT run destructive drops in production without understanding the impact.
