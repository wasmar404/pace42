# pace42

## Docker (one command)

1) Create an env file:

```bash
cp .env.docker.example .env
```

Fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

2) Run everything (db + backend + frontend):

```bash
```

URLs
- Frontend: http://localhost:5173
- Backend: http://localhost:3004

Notes
- The backend container runs `prisma db push` on startup against the local `db` container.
