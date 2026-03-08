# import-gpx (Edge Function)

Purpose:

- Import a `.gpx` file uploaded to Supabase Storage
- Parse a `.gpx` file uploaded to Supabase Storage
- Return computed fields to the backend

This function currently:

- Parses track points
- Computes distance (meters)
- Computes duration (seconds) when timestamps are present
- Generates an encoded polyline and stores it in `activities.route_polyline`

This function does NOT write to the database.
The backend uses the ORM to insert `activities` and `activity_media`.

Deploy (Supabase CLI):

```bash
supabase functions deploy import-gpx
```

Invoke:

- Backend endpoint: `POST /api/activities/import/gpx` uploads the file then calls this function.

Required function env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
