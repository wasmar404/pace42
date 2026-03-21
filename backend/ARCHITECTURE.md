# Pace42 Backend Architecture Guide (NestJS + Prisma + Supabase)

This document is written for someone who does *not* know TypeScript or NestJS deeply yet.

The goal is that you can open any backend file in this repo and explain:

- why it exists
- what it does
- how it connects to the rest of the system
- whether it is well-designed (and how you might improve it)

It teaches concepts first, then maps those concepts to the actual code you have.

## Table of contents

- What this backend is (in one minute)
- The 4 core building blocks (NestJS mental model)
- Request lifecycle: what happens to one HTTP request
- Auth: how Supabase login becomes `req.user`
- Database layer: Prisma and the schema
- How features are organized (modules/controllers/services)
- Endpoint map (controller-by-controller)
- WebSockets: chat + presence
- How to read any file (a practical checklist)
- Design review: what is good, what is risky, what is missing
- Refactor roadmap (incremental, safe improvements)
- TypeScript survival guide (only the parts used here)

---

## What this backend is (in one minute)

Pace42's backend is a NestJS app that:

- exposes a JSON HTTP API under the `/api` prefix
- uses Supabase Auth for identity (the client sends a Supabase JWT access token)
- uses Prisma as the database client (Postgres)
- uploads/downloads media via Supabase Storage
- runs a Socket.IO WebSocket server for chat and presence

If you can explain those 5 bullets, you can explain the architecture at a high level.

---

## The 4 core building blocks (NestJS mental model)

If you know Express: think of NestJS as Express + structure.

1) Modules

- A module is a folder-sized feature boundary.
- It groups controllers (HTTP endpoints) and providers (services) and can import other modules.
- In this repo: `backend/src/modules/*/*.module.ts` files.

2) Controllers

- A controller defines routes/endpoints.
- It is where you see decorators like `@Controller('me')`, `@Get()`, `@Post()`.
- Controllers should ideally do: parse request + call domain logic + return response.

3) Providers (Services)

- A provider is a class that Nest can create and inject into other classes.
- It is where business logic should live.
- In this repo, the main example is `backend/src/modules/chat/chat.service.ts`.
- Many other features put logic directly into controllers (we will critique that later).

4) Dependency Injection (DI)

- Nest creates objects for you and passes them into constructors.
- Example: a controller asks for `PrismaService` and `ConfigService` in its constructor; Nest provides them.
- Why it matters: testability, shared resources (DB client), clean boundaries.

When you open a file, ask: is this a module, controller, provider, or a helper?

---

## Request lifecycle: what happens to one HTTP request

Understanding the request lifecycle is how you stop feeling "lost" in NestJS.

We will trace a request like `GET /api/me`.

### Step 0: Node starts the app

- Entry point: `backend/src/main.ts`
- It creates the Nest app from `AppModule`:
  - `NestFactory.create(AppModule)`
  - sets up middleware, CORS, global filters, and global validation
  - sets the global prefix to `/api`

Key lines in `backend/src/main.ts`:

- `app.use(requestTimingMiddleware)` adds per-request timing logs
- `app.use(compression())` compresses HTTP responses
- `app.use(helmet())` adds security headers
- `app.use(cookieParser())` parses cookies (not heavily used in this code)
- `app.enableCors(...)` configures cross-origin access
- `app.setGlobalPrefix('api')` means `@Controller('me')` becomes `/api/me`
- `app.useGlobalFilters(new HttpExceptionFilter())` makes error responses consistent
- `app.useGlobalPipes(new ValidationPipe(...))` validates and transforms DTOs

### Step 1: Express middleware runs

NestJS sits on Express by default. Middleware runs before controllers.

- `backend/src/common/request-timing.middleware.ts` measures request duration and logs it.

### Step 2: Nest applies global pipes (validation)

The global `ValidationPipe` in `backend/src/main.ts` does 3 important things:

- `whitelist: true`: strip properties that are not in the DTO
- `forbidNonWhitelisted: true`: reject requests with unexpected properties
- `transform: true`: run class-transformer (ex: turn query `take="10"` into number)

This is why DTO files matter: DTOs are not just types; they are runtime validation rules.

Example DTO: `backend/src/modules/activities/activities.dto.ts`.

### Step 3: Guards run (auth)

Guards decide if the request is allowed to proceed.

Example: `backend/src/modules/me/me.controller.ts` has:

- `@UseGuards(SupabaseAuthGuard)` on the class

So before any `me` endpoints run, `SupabaseAuthGuard` runs.

Guard file: `backend/src/auth/supabase.guard.ts`.

What it does:

- reads the `Authorization: Bearer <token>` header
- verifies the token (fast path via JWKS or secret; slow fallback via Supabase API)
- attaches these fields onto the Express request:
  - `req.user = { userId, email? }`
  - `req.supabaseAuth = { accessToken }`

### Step 4: Controller handler runs

Now the controller method runs.

Example: `backend/src/modules/me/me.controller.ts`:

- `@Get()` `getMe(@CurrentUser() user)`
- It upserts a `Profile` row if missing.
- Returns a JSON response containing both `user` and `profile`.

Notice that controller calls Prisma directly via `this.prisma`.

### Step 5: Response is sent

If the handler returns a plain object, Nest serializes it as JSON.

### Step 6: If an error is thrown, the global exception filter shapes it

File: `backend/src/common/http-exception.filter.ts`

- catches any error (Nest `HttpException` or unexpected errors)
- produces a consistent JSON error envelope:

```json
{
  "error": {
    "statusCode": 400,
    "message": "...",
    "path": "/api/...",
    "timestamp": "..."
  }
}
```

This is good for frontend consistency.

---

## Auth: how Supabase login becomes `req.user`

There are two auth "worlds" in this repo:

1) The one actually used: Supabase JWT verification
2) A legacy/unused Passport JWT strategy (`backend/src/auth/auth.jwt.ts`)

### The real one: Supabase guards

Files:

- `backend/src/auth/supabase.guard.ts` (required auth)
- `backend/src/auth/supabase.optional.guard.ts` (auth optional)
- `backend/src/auth/supabase.jwt.ts` (verification strategies)
- `backend/src/auth/supabase.user.ts` (the `@CurrentUser()` decorator)

How it works in plain English:

- The frontend logs in via Supabase Auth.
- Supabase returns an access token (JWT).
- The frontend calls backend endpoints with `Authorization: Bearer <token>`.
- The guard verifies it and sets `req.user`.
- Controllers read it via `@CurrentUser()`.

### Why the guard has a cache

`SupabaseAuthGuard` keeps a small in-memory cache of token -> userId for 60 seconds.

Purpose:

- avoid repeating network calls to Supabase Auth on every request
- keep TTL short because tokens can be revoked

Tradeoff:

- it is per-process memory; if you run multiple backend instances, each has its own cache

### How token verification works (3 strategies)

File: `backend/src/auth/supabase.jwt.ts`

Strategy order:

1) RS* tokens (typical modern Supabase): verify locally via JWKS
   - uses `jwks-rsa` to fetch signing keys from `SUPABASE_URL/auth/v1/keys`
2) HS256 tokens (legacy): verify locally via `SUPABASE_JWT_SECRET` if set
3) Compatibility fallback: call Supabase `anon.auth.getUser(token)`

This layered approach is good engineering: fast path first, reliable fallback last.

### Optional auth guard

Some endpoints behave differently if a viewer is logged in.

Example: `GET /api/activities/:id` lets anonymous users view public activities, but respects privacy.

That endpoint uses `OptionalSupabaseAuthGuard` so it can read `req.user` when present, but not require it.

### The CurrentUser decorator

File: `backend/src/auth/supabase.user.ts`

`@CurrentUser()` is just a convenience to avoid writing:

```ts
const viewerId = req.user.userId
```

Instead, Nest injects what was attached to `request.user`.

### The legacy JWT strategy file

File: `backend/src/auth/auth.jwt.ts`

It defines a Passport JWT strategy and `JwtAuthGuard`, but this guard is not referenced by other files.

You should be able to say:

- "This looks like leftover scaffolding or a previous auth system. It is currently unused, and having two auth systems in the codebase can confuse new contributors. I'd either delete it or clearly document it as legacy." 

---

## Database layer: Prisma and the schema

Prisma is the DB client and the source of truth for the app's data model.

Key files:

- `backend/schema.prisma` (models, relations, indexes)
- `backend/src/prisma.ts` (Nest global Prisma module/service)
- `backend/prisma.config.ts` (loads `.env` for Prisma CLI)

### How Prisma is wired into Nest

File: `backend/src/prisma.ts`

- `PrismaService extends PrismaClient`
- It reads `DATABASE_URL` using Nest's `ConfigService`
- It connects in `onModuleInit()` and disconnects in `onModuleDestroy()`
- `PrismaModule` is marked `@Global()` so any module can inject `PrismaService` without importing PrismaModule explicitly

This is a common Nest pattern.

### Why `backend/prisma.config.ts` exists

Prisma's newer config format can disable automatic `.env` loading.

This file manually loads `.env` and `.env.local` so `prisma generate` and `prisma db push` work consistently.

### How to read `schema.prisma` like an architect

Think in these terms:

- Entities (nouns): Profile, Activity, Club, Message...
- Relationships (edges): one-to-many, many-to-many, optional relations
- Access-control implications: which tables imply ownership or visibility
- Indexes: what queries the app expects to run often

#### Data model overview

Profiles

- `Profile` is keyed by `userId` (UUID from Supabase Auth).
- Stores display data + privacy.

Activities

- `Activity` is a workout; it has `visibility` and `source` (manual vs gpx).
- Media is stored in `ActivityMedia` (photos and GPX).
- Social actions are `ActivityKudo` and `ActivityComment`.

Social graph

- `Follow` is a join table: follower -> following.
- Privacy rules use `Follow` to decide whether a viewer can see follower-only activities.

Clubs

- `Club` is the organization.
- `ClubMember` is membership with a `role` (owner/admin/member).
- `ClubInvite` supports invite-only clubs.
- `ClubPost` is club feed content; it can link to an `Activity`.
- `ClubPostMedia` stores post image URLs.

Chat

- `Conversation` is a thread.
- `ConversationParticipant` is membership and unread counters.
- `Message` is a chat message.

When you review a backend file, you will repeatedly map code to these tables.

---

## How features are organized (modules/controllers/services)

The true "architecture" is the directory layout plus how dependencies flow.

Start at the root module:

File: `backend/src/app.module.ts`

- imports ConfigModule globally
- imports feature modules:
  - `MeModule`
  - `UsersModule`
  - `ActivitiesModule`
  - `NotificationsModule`
  - `ChatModule`
  - `AuthPolicyModule`
  - `IntraAuthModule`
  - `HomeModule`
  - `ClubsModule`
  - `PublicApiModule`

It also registers `HealthController`.

### Why modules are tiny here

Most feature modules in this repo only list controllers and do not list providers.

That is because most business logic is in controllers, not services.

You should recognize this as a design choice (or a stage of project maturity) rather than "how Nest must be".

---

## Endpoint map (controller-by-controller)

All HTTP routes are prefixed with `/api` because of `app.setGlobalPrefix('api')`.

When reading endpoints, remember:

- `@Controller('me')` => `/api/me`
- `@Get('summary')` => `/api/me/summary`
- `@Post(':id([0-9a-fA-F-]{36})/kudos')` => UUID-constrained routes

### Health

File: `backend/src/health.controller.ts`

- `GET /api/health`
  - used for liveness checks; also excluded from request timing logs

### Me (current user)

File: `backend/src/modules/me/me.controller.ts`
Guard: `SupabaseAuthGuard` (must be logged in)

- `GET /api/me`
  - returns auth user + profile; creates profile if missing
- `GET /api/me/summary`
  - returns profile + stats + recent activities/photos; 5s in-memory cache
- `GET /api/me/performance`
  - aggregates distances/time and computes "best efforts" estimates from runs
- `PUT /api/me/personal`
  - onboarding profile details
- `PUT /api/me`
  - convenience update endpoint; includes privacy and weekly goal
- `POST /api/me/avatar` (multipart)
  - uploads avatar image to Supabase Storage and stores public URL
- `GET /api/me/export`
  - returns a large JSON export of your data
- `GET /api/me/export.zip`
  - streams a ZIP containing JSON + downloaded media
- `POST /api/me/delete-account`
  - deletes Supabase Auth user (requires typing DELETE)
- `GET /api/me/activities?take=...`
  - lightweight activities list for the logged-in user

Concepts you should explain from this controller:

- "Profile is created lazily on first use" (common pattern)
- "We store only the Supabase userId and treat Supabase as identity provider"
- "Exports use archiver streaming to avoid loading the full zip into memory"
- "Media uploads go through Supabase service role so server can upload regardless of RLS"

### Users + follow system

File: `backend/src/modules/users/users.controller.ts`

- `GET /api/users/:id/summary`
  - optional auth; shapes the response based on viewer relationship and privacy
- `GET /api/users/:id`
  - public profile card (but blocks users without onboarding completed)
- `GET /api/users/:id/activities`
  - optional auth; returns visible activities based on follow + privacy
- `POST /api/users/:id/follow`
- `DELETE /api/users/:id/follow`

File: `backend/src/modules/users/search.controller.ts`

- `GET /api/search/users?q=...`
  - optional auth; returns `isFollowing` flag if viewer is logged in

Concepts you should explain here:

- "Privacy and follow relationships impact which activities are visible"
- "Some endpoints intentionally return 'not found' instead of 'forbidden' to avoid leaking private existence" (see activities)

### Activities (workouts) + media + social

File: `backend/src/modules/activities/activities.controller.ts`

- `GET /api/activities/mine` (logged in)
  - filter/search endpoints for your own activities
- `POST /api/activities` (logged in)
  - create a manual activity; enforces title and startedAt sanity
  - optional: also creates a club post if `clubId` is provided
- `GET /api/activities/:id?includeRoute=1` (optional auth)
  - returns activity; includes route data only if requested
- `DELETE /api/activities/:id` (logged in)
- `POST /api/activities/:id/media` (logged in, multipart)
  - uploads a photo to Supabase Storage + creates `ActivityMedia`
- `POST /api/activities/import/gpx` (logged in, multipart)
  - uploads GPX to storage
  - invokes Supabase Edge Function to parse the GPX
  - stores a new Activity + ActivityMedia(kind=gpx)
  - optionally shares into a club via ClubPost

Social:

- `POST /api/activities/:id/kudos`
- `GET /api/activities/:id/kudos`
- `DELETE /api/activities/:id/kudos`
- `GET /api/activities/:id/comments`
- `POST /api/activities/:id/comments`

Key concepts to explain:

- "Visibility is a property of an activity, but account privacy can override public -> followers"
- "Large fields (routePolyline/mapImageUrl) are optionally included to avoid huge payloads by default"
- "UUID regex route constraints prevent collisions with fixed routes" (ex: `mine` vs `:id`)

### Home feed

File: `backend/src/modules/home/home.controller.ts`

- `GET /api/home/feed?take=...`
  - if you follow users: show their recent activities
  - if you follow nobody: show explore feed (public activities) but filter out private accounts
  - includes social counts (kudos/comments) and whether viewer has kudoed

- `GET /api/home/recommended-users?take=...`
  - suggests some recent onboarded profiles you do not follow

- `GET /api/home/goals?days=...&goalKm=...`
  - calculates distance over a time window and compares to stored weekly goal

Concepts:

- "Feed is an aggregation endpoint: it joins Activity + Profile + Media + Social counts"
- "Explore mode intentionally hides private accounts even if activities are public" (product decision)

### Clubs (organizations)

File: `backend/src/modules/clubs/clubs.controller.ts`
Guard: `SupabaseAuthGuard` (all club endpoints require login)

Core:

- `POST /api/clubs` (multipart: avatar + banner)
- `POST /api/clubs/:id/update` (multipart: avatar/banner optional)
- `POST /api/clubs/:id/delete` (body confirm=DELETE)

Discovery + membership:

- `GET /api/clubs/mine`
- `GET /api/clubs/discover?take=...&q=...&seed=...`
- `GET /api/clubs/:id`
- `POST /api/clubs/:id/join`
- `POST /api/clubs/:id/leave`

Members + roles:

- `GET /api/clubs/:id/members`
- `POST /api/clubs/:id/members/:userId/role` (owner only)
- `POST /api/clubs/:id/members/:userId/remove` (owner/admin)

Leaderboard + feed:

- `GET /api/clubs/:id/leaderboard?days=...`
- `GET /api/clubs/:id/feed?take=...`

Posts:

- `GET /api/clubs/:id/posts?take=...`
- `POST /api/clubs/:id/posts` (multipart images[])

Invites:

- `POST /api/clubs/:id/invites` (owner/admin)
- `GET /api/clubs/invites` (my pending invites)
- `POST /api/clubs/invites/:inviteId/accept`
- `POST /api/clubs/invites/:inviteId/decline`

Concepts:

- "A club is owned by one userId but authorization is based on membership role"
- "Invite-only is enforced in join path and via invite acceptance flow"
- "Club feed filters activities by club sport mapping" (cycle -> ride, hike -> walk)

### Notifications

File: `backend/src/modules/notifications/notifications.controller.ts`

- `GET /api/notifications/unread?since=<ms>`
  - counts new follows, unread message convos, new kudos/comments, pending invites since a timestamp
- `GET /api/notifications`
  - returns a mixed list of notifications (follow/kudo/comment/message/invite)

Concept:

- "Notifications are computed on the fly from other tables, not stored as their own table"

### Chat (HTTP) + Chat (WebSocket)

HTTP controller: `backend/src/modules/chat/chat.controller.ts`

- `GET /api/chat/unread`
- `GET /api/chat/conversations`
- `GET /api/chat/mutuals?q=...`
- `POST /api/chat/conversations/with/:otherUserId`
- `GET /api/chat/conversations/:id/messages?limit=...&before=...`
- `POST /api/chat/conversations/:id/messages`
- `POST /api/chat/conversations/:id/read`

Service: `backend/src/modules/chat/chat.service.ts`

WebSocket gateway: `backend/src/modules/chat/chat.gateway.ts` (namespace `/chat`)

### Auth policy + Intra auth

File: `backend/src/modules/auth-policy/auth-policy.controller.ts`

- `POST /api/auth/policy/enforce` (logged in)
  - uses Supabase Admin API to enforce signup/login policy across providers
- `POST /api/auth/reject-oauth` (logged in)
  - best-effort cleanup: deletes the just-created auth user when signup is not allowed

File: `backend/src/modules/intra-auth/intra-auth.controller.ts`

- `GET /api/auth/intra/debug`
- `GET /api/auth/intra/start?mode=login|signup&next=/path`
  - redirects to 42 Intra OAuth authorize endpoint
- `GET /api/auth/intra/callback?code=...&state=...`
  - exchanges code for token
  - fetches user email
  - creates or validates a Supabase Auth user
  - generates a Supabase magic link that redirects into the SPA

Concepts:

- "This backend acts as the OAuth 'broker' for Intra, then hands off to Supabase session handling" 
- "State is HMAC-signed to prevent CSRF and tampering" 

### Public API (API key protected)

Guard: `backend/src/modules/public-api/public-api.guard.ts`
Controller: `backend/src/modules/public-api/public-api.controller.ts`

All routes live under `/api/public/*` and require `PUBLIC_API_KEY`.

- `GET /api/public/health`
- `GET /api/public/users?q=...&take=...`
- `GET /api/public/activities?since=...&take=...`
- `GET /api/public/clubs?q=...&take=...`
- `POST /api/public/clubs`
- `PUT /api/public/clubs/:id`
- `DELETE /api/public/clubs/:id`

Guard details:

- reads API key from `x-api-key` or `Authorization: Bearer ...`
- rate limits in-memory per (apiKey + ip)
- emits `X-RateLimit-*` headers

System owner detail:

- public API writes clubs "as" a deterministic system user derived from the API key
- it upserts a private profile for that system user

---

## WebSockets: chat + presence

File: `backend/src/modules/chat/chat.gateway.ts`

This file is the WebSocket entry point.

Key ideas:

- Socket.IO uses a handshake, not an HTTP Authorization header by default.
- This gateway accepts tokens in 3 places:
  - header `Authorization: Bearer ...`
  - `handshake.auth.token`
  - `handshake.query.token`
- It verifies the token using the same Supabase verifier used by HTTP guards.

### Rooms

The gateway uses two kinds of rooms:

- personal room: `u:<userId>`
- conversation room: `c:<conversationId>` (joined after access is validated)

When sending messages, it emits only to personal rooms to avoid duplicates.

### Presence

Presence is in-memory (per server instance):

- `onlineSocketsByUser`: userId -> socketId set
- `lastSeenByUser`: userId -> timestamp
- watch tracking:
  - `watchedBySocket`: socketId -> watched userIds
  - `watchersByUser`: watched userId -> socketIds

Events:

- client sends: `presence:watch` with `{ userIds }`
- server emits:
  - `presence:state` (initial state)
  - `presence:update` (updates when someone goes online/offline)

Important limitation:

- if you scale horizontally (multiple backend instances), presence will be wrong unless you add a shared adapter (Redis) or store presence elsewhere.

---

## How to read any file (a practical checklist)

When you open a backend file, do this in order:

1) Identify the "role" of the file

- Entry point? (`main.ts`)
- Module? (`*.module.ts`)
- Controller? (`*.controller.ts`)
- Service/provider? (`*.service.ts`)
- Guard? (`*.guard.ts`)
- DTO? (`*.dto.ts`)
- Common infra? (`common/*`)

2) Scan imports to see what it depends on

- `@nestjs/common` -> it's using Nest decorators/exceptions
- `PrismaService` -> it touches the database
- `ConfigService` -> it relies on environment variables
- `createSupabaseClients` -> it touches Supabase (storage/auth/admin)

3) Look for decorators first (they tell you how it is wired)

- `@Controller('x')` => routing prefix
- `@UseGuards(...)` => security boundary
- `@UseInterceptors(...)` => file uploads / transforms
- `@WebSocketGateway(...)` => websocket boundary

4) For each endpoint method, ask 3 questions

- What is the input contract?
  - DTO validation? manual parsing? query params? multipart?
- What is the authorization rule?
  - who is allowed? how is it checked?
- What tables does it touch?
  - Prisma calls show the tables

5) Evaluate design (quick smell test)

- Does it mix a lot of unrelated logic (validation + auth + DB + formatting)?
- Is there duplicated access-control logic across controllers?
- Is there any `any` typing or unsafe casts?
- Is it doing N+1 DB queries?
- Is it using in-memory caches for something that might need multi-instance support?

If you can do this checklist, you can explain the file.

---

## Design review: what is good, what is risky, what is missing

This section helps you sound like an architect in a review.

### Strong points

- Global validation + consistent error envelope (`ValidationPipe`, `HttpExceptionFilter`) makes the API predictable.
- Supabase token verification is robust (JWKS fast path + fallback).
- UUID regex in routes avoids common routing footguns.
- Prisma is centralized as a global module; DB client lifecycle is handled properly.
- Some endpoints deliberately avoid leaking private data by returning 404-like responses.

### Risks / code smells to notice (without being harsh)

- Controllers are very large and contain business logic (ex: `backend/src/modules/me/me.controller.ts`).
  - Consequence: harder testing, harder reuse, logic duplication.
- Authorization logic is duplicated across controllers (privacy checks appear in Activities/Home/Users/Clubs).
  - Consequence: easy for rules to drift and create inconsistencies.
- In-memory caches and rate limiting are per-process.
  - Works on a single instance, but breaks under horizontal scaling.
- `backend/src/auth/auth.jwt.ts` appears unused.
  - Confusing to new developers; should be removed or clearly labeled.
- Some endpoints use POST for update/delete semantics (`/clubs/:id/update`, `/clubs/:id/delete`).
  - Not wrong, but inconsistent with REST conventions; can matter for clients/proxies.
- Media export and download logic performs many sequential network calls.
  - Might be slow for users with lots of data; could benefit from concurrency limits or async job.

### Things that are "fine for now" but become important later

- No dedicated pagination/cursors in many list endpoints (some have `take` only).
- No transaction boundaries in some multi-write flows (some do use `$transaction`).
- No clear separation between "API shape" and "database shape" (controllers often return raw Prisma data).

---

## Refactor roadmap (incremental, safe improvements)

If you want to improve the backend without rewriting it, do it in small steps.

1) Introduce service layers for big controllers

- Move logic from controllers into `*.service.ts` files.
- Keep controllers thin: validate inputs, call service, return result.
- Start with `ActivitiesController`, `ClubsController`, `MeController`.

2) Centralize access-control rules

- Create a `VisibilityService` or `AccessControlService` that answers questions like:
  - canViewerSeeActivity(viewerId, activity)
  - canViewerSeeUserProfile(viewerId, profile)
  - canManageClub(userId, clubId)

3) Standardize list endpoints

- Replace some `take` usage with cursor pagination (`cursor`, `before`, `after`).
- This avoids missing items when new rows arrive.

4) Replace in-memory rate limiting/presence if you scale

- Use Redis-backed rate limiting
- Use Socket.IO Redis adapter for presence and cross-instance rooms

5) Remove or isolate legacy code

- Delete `backend/src/auth/auth.jwt.ts` if it is truly unused.
- If you keep it, add a doc comment "legacy" and ensure nothing depends on it.

---

## TypeScript survival guide (only what you need here)

You can read most of this backend with a small TypeScript toolkit.

### Types vs runtime

- TypeScript types disappear at runtime.
- DTO validation *does* run at runtime because it uses decorators from `class-validator`.

If you see a plain type like:

```ts
type SupabaseRequestUser = { userId: string; email?: string }
```

That helps developers, but it does not validate data at runtime.

### Decorators

- `@Controller`, `@Get`, `@Post` are decorators.
- Think of them as metadata: they tell Nest how to route calls.

### Optional values

- `x?: string` means it might be undefined.
- `x ?? y` means use y only if x is null/undefined.

### Type assertions vs `satisfies`

You will see patterns like:

```ts
req.user = { userId, email } satisfies SupabaseRequestUser
```

`satisfies` is a compile-time check: it ensures the object matches the type.
It is safer than `as SupabaseRequestUser` because it still checks fields.

### `import type`

`import type { Request } from 'express'` imports only the type (no runtime import).

---

## Appendix: file map (what exists and why)

Entry + app wiring

- `backend/src/main.ts`: bootstraps Nest, configures global middleware/validation/error handling
- `backend/src/app.module.ts`: root module listing feature modules
- `backend/src/health.controller.ts`: basic health endpoint

Infra

- `backend/src/prisma.ts`: PrismaService + PrismaModule (global DB client)
- `backend/src/common/http-exception.filter.ts`: consistent error responses
- `backend/src/common/request-timing.middleware.ts`: request timing logs
- `backend/src/common/time.ts`: timing helpers used in activities import

Auth + Supabase

- `backend/src/auth/supabase.guard.ts`: required JWT auth
- `backend/src/auth/supabase.optional.guard.ts`: optional JWT auth
- `backend/src/auth/supabase.jwt.ts`: verify token via JWKS/secret/fallback
- `backend/src/auth/supabase.auth.ts`: creates Supabase clients with timeouts
- `backend/src/auth/supabase.user.ts`: `@CurrentUser()` decorator
- `backend/src/supabase/supabase.request.ts`: per-request Supabase client helper
- `backend/src/auth/auth.jwt.ts`: legacy Passport JWT auth (likely unused)

Features

- `backend/src/modules/me/me.controller.ts`: current user endpoints, profile, export, avatar
- `backend/src/modules/users/users.controller.ts`: user profiles + follow system
- `backend/src/modules/users/search.controller.ts`: user search
- `backend/src/modules/activities/activities.controller.ts`: activities + social + media + GPX import
- `backend/src/modules/clubs/clubs.controller.ts`: clubs + invites + roles + posts + feed/leaderboard
- `backend/src/modules/home/home.controller.ts`: home feed + goals + recommendations
- `backend/src/modules/chat/chat.controller.ts`: chat over HTTP
- `backend/src/modules/chat/chat.service.ts`: chat business logic
- `backend/src/modules/chat/chat.gateway.ts`: chat/presence over WebSockets
- `backend/src/modules/notifications/notifications.controller.ts`: computed notifications
- `backend/src/modules/auth-policy/auth-policy.controller.ts`: Supabase auth policy enforcement
- `backend/src/modules/intra-auth/intra-auth.controller.ts`: 42 Intra OAuth bridge
- `backend/src/modules/public-api/*`: API-key protected endpoints + in-memory rate limiting

DTOs

- `backend/src/me/me.dto.ts`: profile update validation
- `backend/src/modules/activities/activities.dto.ts`: create activity validation
- `backend/src/modules/activities/gpx.dto.ts`: GPX import validation (note: controller currently parses body manually)
- `backend/src/modules/clubs/clubs.dto.ts`: club create/update/invite/role validation
- `backend/src/modules/public-api/public-api.dto.ts`: public API query/body validation

Prisma

- `backend/schema.prisma`: data models and relations
- `backend/prisma.config.ts`: dotenv loading for Prisma CLI
- `backend/prisma/migrations/000000_baseline/migration.sql`: baseline migration snapshot

---

## Suggested learning path (use this doc actively)

1) Read `backend/src/main.ts` until you can explain middleware/filters/pipes in your own words.
2) Read `backend/src/auth/supabase.guard.ts` + `backend/src/auth/supabase.jwt.ts` until you can explain the 3 verification strategies.
3) Pick one feature and trace end-to-end:
   - example: create activity -> upload media -> view in home feed.
4) Read `backend/schema.prisma` and match tables to endpoints.
5) Re-read this doc and write your own 10-sentence architecture summary.
