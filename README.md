# pace42

## Env (single source)

Both the backend and frontend read env vars from the root `.env`.

Required keys for hosted Supabase:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Backend DB:
- `DATABASE_URL`
- `DIRECT_URL`

## Run (no Docker)

Terminal 1 (backend):

```bash
cd backend
npm install
npm run start:dev
```

Terminal 2 (frontend):

```bash
cd front_end
npm install
npm run dev
```

## Docker (optional)

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
- The backend container runs `prisma db push` on startup against the configured database.
