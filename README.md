# pace42

## Docker (one command)

### Option A (recommended): local Supabase + app

```bash
./dev.sh up
```

Stop everything:

```bash
./dev.sh down
```

### Option B: app only (use hosted Supabase)

1) Create an env file:

```bash
cp .env.docker.example .env
```

Fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Also set:
- `VITE_SUPABASE_URL` (usually same as `SUPABASE_URL`)
- `VITE_SUPABASE_ANON_KEY` (usually same as `SUPABASE_ANON_KEY`)

2) Run everything (db + backend + frontend):

```bash
docker compose up --build
```

URLs
- Frontend: http://localhost:5173
- Backend: http://localhost:3004

Notes
- The backend container runs `prisma db push` on startup against the local `db` container.

# Hosted Supabase + DB

# DB (Supabase)
DATABASE_URL="postgresql://postgres.vxwmbmgxblusfrdmfcvd:Fsl4qwn3oWp5@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"
DIRECT_URL="postgresql://postgres.vxwmbmgxblusfrdmfcvd:Fsl4qwn3oWp5@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Supabase (backend)
SUPABASE_URL="https://vxwmbmgxblusfrdmfcvd.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4d21ibWd4Ymx1c2ZyZG1mY3ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDMzOTcsImV4cCI6MjA4NzYxOTM5N30.7ZE_UFRaayRTPgSGckXV4os7hHbTjwu90n4UOhOdqio"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4d21ibWd4Ymx1c2ZyZG1mY3ZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA0MzM5NywiZXhwIjoyMDg3NjE5Mzk3fQ.1_MiYQV3YORkBi8wt7cFSIXaYEm2jaOD5knhyoeaurQ"
SUPABASE_JWT_SECRET="wiQL4YVKCZv9BS5Lao8bFcqXyOEoVIMaFhwjOJbGBRii1yG1prCHXQZ0AKtWGHx8IgMu6epXNHWAbsfnNHzStA=="

SUPABASE_AVATARS_BUCKET="test"
SUPABASE_ACTIVITY_MEDIA_BUCKET="activity-media"
SUPABASE_GPX_BUCKET="gpx"
SUPABASE_IMPORT_GPX_FUNCTION="import-gpx"
SUPABASE_HTTP_TIMEOUT_MS=60000

# Backend
PORT=3004
CORS_ORIGIN=http://localhost:5173

# Frontend
VITE_BACKEND_URL=http://localhost:3004
VITE_SUPABASE_URL="https://vxwmbmgxblusfrdmfcvd.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4d21ibWd4Ymx1c2ZyZG1mY3ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDMzOTcsImV4cCI6MjA4NzYxOTM5N30.7ZE_UFRaayRTPgSGckXV4os7hHbTjwu90n4UOhOdqio"
