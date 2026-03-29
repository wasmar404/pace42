# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Pace42 is a fitness/activity tracking social network (Strava-like) — a monorepo with a NestJS backend, React+Vite frontend, and a self-hosted or cloud Supabase stack for auth, database, storage, and real-time features.

## Development Commands

### Local Development (without Docker)

```bash
# Terminal 1 — Backend
cd backend && npm install && npm run start:dev

# Terminal 2 — Frontend
cd front_end && npm install && npm run dev
```

Service URLs:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3004`
- Supabase Studio: `http://localhost:54323`
- PostgreSQL: `localhost:54322`

### Docker Development

```bash
# Full local stack (Supabase + backend + frontend)
./dev.sh up
./dev.sh down

# Docker with hosted Supabase
cp .env.docker.example .env  # fill in hosted Supabase credentials
docker compose up --build
```

### Backend

```bash
cd backend
npm run start:dev       # watch mode
npm run build           # compile TypeScript → dist/
npm run start:prod      # run compiled dist/main.js
npm run typecheck       # type-check without emitting
npm run prisma:generate # regenerate Prisma client after schema changes
npm run prisma:db:push  # apply schema.prisma to database
```

### Frontend

```bash
cd front_end
npm run dev     # Vite dev server
npm run build   # production build
npm run lint    # ESLint (--max-warnings 0)
npm run preview # preview production build
```

## Architecture

### Monorepo Layout

```
pace42/
├── backend/          # NestJS API
├── front_end/        # React + Vite SPA
├── supabase/         # Local Supabase config & volumes
├── docker-compose.yml
├── dev.sh            # Dev orchestration script
└── .env              # Shared environment config
```

### Backend (NestJS)

Feature-based modules under `backend/src/`:

| Module | Purpose |
|--------|---------|
| `auth/` | Supabase JWT guard via `passport-jwt` + `jwks-rsa` |
| `me/` | Authenticated user's own profile & data |
| `users/` | User search and public profiles |
| `activities/` | Activity CRUD, kudos, comments, media |
| `chat/` | Real-time messaging — Socket.io gateway + REST |
| `home/` | Feed and summary endpoints |
| `auth-policy/` | Authorization policies |
| `public-api/` | API-key authenticated public access |

Key files:
- `main.ts` — Bootstrap: CORS, compression, cookie-parser, global validation pipe, exception filter
- `app.module.ts` — Root module registering all feature modules
- `prisma.ts` — Prisma client singleton (import from here, not `@prisma/client` directly)
- `supabase/` — Supabase Admin client integration

### Frontend (React + Vite)

Pages in `front_end/src/pages/`. Auth flow: `Login` → `Verification`/`AuthCallback` → `Mfa` → `Personal-info` → `Home`.

Key utilities:
- `src/backendApi.js` — HTTP client wrapping all backend calls
- `src/supabaseClient.js` — Supabase JS client initialization
- `src/routes/ProtectedRoute.jsx` — Auth guard for protected routes

### Database

- PostgreSQL 15 via Supabase; Prisma ORM (`backend/prisma/schema.prisma`)
- Core models: `Profile`, `Activity`, `ActivityKudo`, `ActivityComment`, `ActivityMedia`, `Follow`
- Migrations live in `backend/migrations/`; use `prisma db push` in development (schema-first), proper migrations for production

### Authentication Flow

1. Supabase Auth issues JWTs (supports email OTP and Google OAuth)
2. Backend validates JWTs using `jwks-rsa` against the Supabase JWKS endpoint
3. `AuthGuard` (passport-jwt) protects all non-public routes
4. `PublicApiModule` uses API-key auth for external integrations

## Environment Variables

The `.env` file is read by both Docker Compose and the backend. Minimum required:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
PORT=3004
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<jwt>
SUPABASE_SERVICE_ROLE_KEY=<service-key>
SUPABASE_JWT_SECRET=<32+ chars>
VITE_BACKEND_URL=http://localhost:3004
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<jwt>
```

Use `.env.example` and `.env.docker.example` as references.
