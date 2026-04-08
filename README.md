# Pace42

*This project has been created as part of the 42 curriculum by raldanda, wasmar.*

---

## Description

**Pace42** is a full-stack sports activity tracking and social platform inspired by Strava. It allows users to log workouts (running, walking, cycling), import GPX files with route mapping, interact with other athletes through a real-time chat system, and track their training progress over time. The platform features a social feed with kudos and comments, user profiles with activity statistics, a follow system, and a public REST API for third-party integrations.

### Key Features

- Activity logging with manual entry or GPX file import
- Interactive route maps powered by Leaflet
- Social feed with kudos (likes) and comments
- Real-time private messaging via WebSockets
- User profiles with activity history and statistics
- Follow/unfollow system with user recommendations
- Training dashboard with filters, sorting, search, and pagination
- Two-Factor Authentication (TOTP) via authenticator apps
- Google OAuth and email/password authentication
- Photo uploads for activities and avatar management
- Public REST API with shared-key authentication and rate limiting
- Units preference (km/mi) across the entire app
- Account management (email change, password change, avatar upload, account deletion)

---

## Instructions

### Prerequisites

- **Docker** and **Docker Compose**
- **Node.js** v20+ (if running outside Docker)
- **npm** (bundled with Node.js)
- A **Supabase** project (for authentication and storage)
- A **PostgreSQL** database (provided by Supabase or standalone)

### Environment Variables

Create a `.env` file at the project root with the following variables (see `.env.example` for a template):

```
# Supabase
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_URL=<your-supabase-url>
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
SUPABASE_JWT_SECRET=<your-supabase-jwt-secret>

# Database
DATABASE_URL=<your-postgresql-connection-string>
DIRECT_URL=<your-postgresql-direct-connection-string>

# Backend
PORT=3004
CORS_ORIGIN=http://localhost:5173
VITE_BACKEND_URL=http://localhost:3004

# Supabase Storage Buckets (optional — defaults shown)
SUPABASE_AVATARS_BUCKET=test
SUPABASE_ACTIVITY_MEDIA_BUCKET=activity-media
SUPABASE_GPX_BUCKET=gpx
SUPABASE_IMPORT_GPX_FUNCTION=import-gpx
SUPABASE_HTTP_TIMEOUT_MS=60000

# Public API
PUBLIC_API_KEY=<your-shared-api-key>
```

### Running with Docker

The recommended way to run Pace42 is with Docker Compose. Both services are containerized using Node 20 Alpine images.

**1. Make sure your `.env` file is in the project root** (see above).

**2. Build and start the containers:**

```bash
docker compose up --build
```

This will start two services:

- **backend** — NestJS API server on `http://localhost:3004`. On startup, the entrypoint script automatically installs dependencies if needed, waits for the database to be reachable, runs `prisma generate`, and pushes the schema with `prisma db push`.
- **frontend** — Vite dev server on `http://localhost:5173`. Depends on the backend service.

Both services use volume mounts for live code reloading during development (`./backend:/app` and `./front_end:/app`), with separate named volumes for `node_modules` to avoid conflicts with the host.

**3. Stop the containers:**

```bash
docker compose down
```

**4. Rebuild after dependency changes:**

```bash
docker compose up --build --force-recreate
```

### Running Manually (Development)

**Backend:**

```bash
cd backend
npm ci
npx prisma generate
npx prisma db push
npm run start:dev
```

The backend runs on `http://localhost:3004` by default.

**Frontend:**

```bash
cd front_end
npm ci
npm run dev
```

The frontend runs on `http://localhost:5173` by default.

### Build for Production

```bash
# Frontend
cd front_end
npm run build
npm run preview

# Backend
cd backend
npm run build
npm run start:prod
```

---

## Resources

- [React 18 Documentation](https://react.dev/)
- [Vite Build Tool](https://vitejs.dev/)
- [NestJS Framework](https://docs.nestjs.com/)
- [Prisma ORM Documentation](https://www.prisma.io/docs)
- [Supabase Auth & Storage](https://supabase.com/docs)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Leaflet.js Maps](https://leafletjs.com/)
- [React Leaflet](https://react-leaflet.js.org/)
- [Multiavatar Avatars](https://github.com/multiavatar/multiavatar)
- [Lucide React Icons](https://lucide.dev/)
- [Docker Documentation](https://docs.docker.com/)

### AI Usage

AI tools (primarily ChatGPT and Claude) were used as a development aid throughout the project, but not as a replacement for writing and understanding the code ourselves. Here's how we used them:

- **Debugging and troubleshooting** — when we got stuck on specific errors (Prisma migration issues, Supabase JWT verification edge cases, CORS problems between frontend and backend), we used AI to help diagnose the issue and suggest fixes. We always tested and adapted the suggestions to our codebase rather than copy-pasting blindly.
- **Learning unfamiliar APIs** — for things like the Supabase MFA enrollment flow, Socket.IO room management, and Leaflet polyline rendering, we asked AI to explain how these APIs work and give usage examples. The actual implementation was written by us based on that understanding.
- **Boilerplate and repetitive code** — AI helped speed up writing repetitive structures like NestJS DTOs, Prisma schema mappings, and CSS layout scaffolding. We then customized and refined everything to fit our design and logic.
- **Code review and refactoring** — we occasionally asked AI to review sections of our code for potential bugs, security issues, or cleaner patterns.
- **README generation** — this README was drafted with AI assistance based on our actual codebase and then reviewed and edited by the team.

---

## Team Information

| Member | Role(s) | Responsibilities |
|--------|---------|-----------------|
| **raldanda** | Product Owner (PO) · Frontend Developer | Defines and prioritizes features; maintains the product vision. Owns all frontend development — UI/UX design, React components, pages, styling, client-side routing, and state management. |
| **wasmar** | Tech Lead · Backend Developer | Oversees technical architecture and stack decisions; ensures code quality. Owns all backend development — NestJS API, Prisma ORM, database schema, authentication, WebSocket chat, and public API. |
| **raldanda & wasmar** | Scrum Master (shared) · Integration | Both members jointly facilitate sprint planning, track progress, and unblock each other. Collaborative work on frontend–backend integration, API contracts, WebSocket communication, and end-to-end feature wiring. |

> **Note on team size:** With a 2-person team the roles above are shared. raldanda acts as PO and primary frontend developer; wasmar acts as Tech Lead and primary backend developer; both share Scrum Master duties and all integration work.

---

## Project Management

### Organization

The work was split naturally between frontend and backend. raldanda owned all frontend development (React pages, components, styling, client-side logic) while wasmar owned the backend (NestJS API, database, authentication, WebSockets). Integration work — connecting the frontend to the backend APIs, WebSocket events, and file upload flows — was done collaboratively, with both team members working together to define API contracts, test end-to-end flows, and debug cross-layer issues.

We worked in an iterative approach with informal sprints of roughly one week each:

1. **Sprint 1 — Core:** Authentication (email/password, Google OAuth), user onboarding, basic activity CRUD.
2. **Sprint 2 — Social:** Social feed, kudos, comments, follow system, user profiles.
3. **Sprint 3 — Real-time & Media:** WebSocket chat, GPX import, file uploads (photos, avatars).
4. **Sprint 4 — Polish:** 2FA, public API, training dashboard filters, settings, privacy/terms pages.

### Task Distribution

- Each feature was assigned to its primary owner (frontend or backend) before development started.
- Integration tasks were listed explicitly and tackled together in shared sessions.
- No formal issue tracker was used; tasks were managed as a shared checklist on Discord.

### Communication

- **Discord** — daily async communication, screen-sharing sessions for debugging, and weekly planning calls.
- **GitHub** — version control, pull-request reviews, and commit history as the source of truth for progress.

---

## Technical Stack

### Frontend

| Technology | Version | Role |
|-----------|---------|------|
| React | 18 | UI library — functional components and hooks |
| Vite | 5 | Development server and production build tool |
| React Router | v7 | Client-side SPA routing with protected routes |
| Leaflet / React Leaflet | latest | Interactive maps for GPX route visualization |
| Socket.IO Client | latest | WebSocket communication for real-time chat |
| Supabase JS Client | latest | Auth (email/password, Google OAuth, MFA) |
| Lucide React | latest | Icon library |
| Multiavatar | latest | Auto-generated user avatars |
| react-otp-input | latest | OTP input component for 2FA |
| CSS (hand-written) | — | Custom stylesheets; no CSS framework |

**Why React + Vite?** React's component model and ecosystem (React Router, React Leaflet) are a strong fit for the feature-rich SPA we needed. Vite's HMR and fast cold-start significantly improved the development cycle compared to alternatives like CRA.

### Backend

| Technology | Version | Role |
|-----------|---------|------|
| NestJS | 10 | Modular Node.js framework with TypeScript |
| Prisma | 6 | Type-safe ORM for PostgreSQL |
| Socket.IO | latest | WebSocket server for real-time chat |
| Supabase Auth | — | JWT verification, MFA, admin operations |
| class-validator / class-transformer | latest | DTO validation and transformation |
| jsonwebtoken / jwks-rsa | latest | JWT verification against Supabase JWKS |
| compression | latest | HTTP response compression middleware |

**Why NestJS?** Its module/controller/service architecture enforces separation of concerns from the start and scales well as the feature set grows. Built-in dependency injection and decorators (Guards, Pipes, Interceptors) let us implement auth and validation cleanly without boilerplate.

### Database

| Technology | Details |
|-----------|---------|
| PostgreSQL | Relational database hosted via Supabase |
| Prisma ORM | Declarative schema, type-safe queries, `prisma db push` migrations |

**Why PostgreSQL?** Its strong relational model (foreign keys, cascade deletes, composite keys) maps cleanly to our social graph (follows, kudos, participants). Supabase provides managed PostgreSQL with built-in auth and storage, reducing infrastructure overhead for a two-person team.

### Infrastructure

| Technology | Role |
|-----------|------|
| Docker / Docker Compose | Containerized frontend and backend (Node 20 Alpine); single-command startup |
| Supabase | Managed auth, file storage (photos, avatars, GPX), and PostgreSQL hosting |

---

## Database Schema

The database consists of **9 tables** managed through Prisma ORM. All tables use `UUID` primary keys and `timestamptz` for date/time fields.

### Tables and Key Fields

#### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | PK — matches Supabase auth user ID |
| `username` | `VARCHAR` | Unique |
| `name` | `VARCHAR` | Display name |
| `avatar_url` | `TEXT` | Supabase storage path |
| `bio` | `TEXT` | Optional |
| `date_of_birth` | `DATE` | Optional |
| `gender` | `VARCHAR` | Optional |
| `weekly_goal` | `FLOAT` | Distance goal in km |
| `onboarded` | `BOOLEAN` | Whether onboarding is complete |
| `created_at` | `TIMESTAMPTZ` | |

#### `activities`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `profiles.id` |
| `title` | `VARCHAR` | |
| `description` | `TEXT` | Optional |
| `sport_type` | `VARCHAR` | e.g. `running`, `cycling`, `walking` |
| `distance` | `FLOAT` | Metres |
| `duration` | `INTEGER` | Seconds |
| `started_at` | `TIMESTAMPTZ` | |
| `source` | `VARCHAR` | `manual` or `gpx` |
| `route_polyline` | `TEXT` | Encoded polyline for Leaflet |
| `map_image_url` | `TEXT` | Optional static map preview |
| `created_at` | `TIMESTAMPTZ` | |

#### `activity_media`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | PK |
| `activity_id` | `UUID` | FK → `activities.id` (cascade delete) |
| `bucket` | `VARCHAR` | Supabase storage bucket name |
| `path` | `TEXT` | File path within bucket |
| `created_at` | `TIMESTAMPTZ` | |

#### `activity_kudos`
| Column | Type | Notes |
|--------|------|-------|
| `activity_id` | `UUID` | FK → `activities.id` (cascade delete) — composite PK |
| `user_id` | `UUID` | FK → `profiles.id` — composite PK |
| `created_at` | `TIMESTAMPTZ` | |

#### `activity_comments`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | PK |
| `activity_id` | `UUID` | FK → `activities.id` (cascade delete) |
| `user_id` | `UUID` | FK → `profiles.id` |
| `content` | `TEXT` | |
| `created_at` | `TIMESTAMPTZ` | |

#### `follows`
| Column | Type | Notes |
|--------|------|-------|
| `follower_id` | `UUID` | FK → `profiles.id` — composite PK |
| `following_id` | `UUID` | FK → `profiles.id` — composite PK |
| `created_at` | `TIMESTAMPTZ` | |

#### `conversations`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | PK |
| `last_message` | `TEXT` | Preview of last message |
| `last_message_at` | `TIMESTAMPTZ` | For sorting |
| `created_at` | `TIMESTAMPTZ` | |

#### `conversation_participants`
| Column | Type | Notes |
|--------|------|-------|
| `conversation_id` | `UUID` | FK → `conversations.id` (cascade delete) — composite PK |
| `user_id` | `UUID` | FK → `profiles.id` — composite PK |

#### `messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | PK |
| `conversation_id` | `UUID` | FK → `conversations.id` (cascade delete) |
| `sender_id` | `UUID` | FK → `profiles.id` |
| `content` | `TEXT` | |
| `created_at` | `TIMESTAMPTZ` | |

### Entity Relationships

```
profiles ──< activities ──< activity_media
         ──< activity_kudos
         ──< activity_comments
         ──< follows (follower / following)
         ──< conversation_participants >── conversations ──< messages
```

- Activities cascade-delete their kudos, comments, and media.
- Conversations cascade-delete their participants and messages.
- Indexes are placed on `activities.user_id`, `activities.started_at`, `messages.conversation_id`, `messages.created_at`, and `follows.follower_id` / `follows.following_id`.

---

## Features List

| Feature | Built by | Description |
|---------|----------|-------------|
| **Email/Password Auth** | raldanda (UI) · wasmar (backend) | Sign up and log in with email and password via Supabase Auth |
| **Google OAuth** | raldanda (UI) · wasmar (policy) | One-click sign in with Google, with auth policy enforcement preventing method mixing |
| **Two-Factor Auth (TOTP)** | raldanda (UI) · wasmar (backend) | Enable/disable 2FA in settings using authenticator apps (Google Authenticator, Authy, 1Password) |
| **Auth Policy Enforcement** | wasmar | Backend prevents duplicate accounts and cross-method login conflicts |
| **User Onboarding** | raldanda | Personal info collection flow after first sign-up |
| **Activity Logging** | raldanda (UI) · wasmar (API) | Manual entry of workouts with sport type, distance, duration, date, title, and description |
| **GPX Import** | raldanda (UI) · wasmar (parser) | Upload GPX files to auto-populate route, distance, and duration data |
| **Route Maps** | raldanda | Interactive Leaflet maps displaying activity routes from polyline data |
| **Activity Photos** | raldanda (UI) · wasmar (storage) | Upload and attach photos to activities with progress tracking |
| **Social Feed** | raldanda (UI) · wasmar (API) | Home feed showing activities from followed users with activity cards |
| **Kudos & Comments** | raldanda (UI) · wasmar (API) | Like/unlike and comment on activities |
| **User Profiles** | raldanda (UI) · wasmar (API) | Profile with stats (followers, following, total activities), recent activities, and photos |
| **Follow System** | raldanda (UI) · wasmar (API) | Follow/unfollow users, with recommended user suggestions on the home page |
| **User Search** | raldanda (UI) · wasmar (API) | Search for users by username or name |
| **Real-Time Chat** | raldanda (UI) · wasmar (gateway) | Private messaging with WebSocket-based real-time delivery and online presence |
| **Training Dashboard** | raldanda (UI) · wasmar (API) | Filterable, sortable, paginated list of all personal activities with advanced search |
| **Weekly Goals** | raldanda (UI) · wasmar (API) | Set a weekly distance goal and track progress on the home dashboard |
| **Units Preference** | raldanda | Toggle between kilometers and miles across the entire application |
| **Settings** | raldanda (UI) · wasmar (API) | Change email, password, upload avatar, enable/disable 2FA, set weekly goal, delete account |
| **Public REST API** | wasmar | Shared-key API for third-party access with rate limiting (6 endpoints) |
| **API Documentation** | raldanda | In-app API docs page with endpoint reference and cURL examples |
| **Privacy Policy & ToS** | raldanda | Legal pages accessible from the landing page |

---

## Modules

| Module | Type | Pts | Built by | Justification & Implementation |
|--------|------|-----|----------|-------------------------------|
| **Use a Framework (Frontend & Backend)** | Major | 2 | raldanda (frontend) · wasmar (backend) | **Frontend:** React 18 with Vite as the build tool, React Router v7 for SPA routing, and a component-based architecture across 15+ pages. **Backend:** NestJS 10 with TypeScript, using modules, controllers, guards, DTOs, pipes, and dependency injection for a clean, scalable architecture. |
| **Real-Time Features (WebSockets)** | Major | 2 | wasmar (gateway) · raldanda (client UI) | Real-time private chat implemented with Socket.IO. The backend uses a NestJS WebSocket gateway (`@WebSocketGateway`) with JWT-authenticated connections. Features include instant message delivery, online/offline presence tracking, and conversation-scoped rooms. The frontend connects via `socket.io-client`. |
| **User Social Interaction** | Major | 2 | raldanda (UI) · wasmar (API) | **Chat:** Full private messaging system with conversations, message history, and real-time delivery. **Profiles:** User profiles with avatar, bio, stats (followers, following, activities), recent activities, and photo gallery. **Follow system:** Follow/unfollow users, followers/following lists with modals, and recommended users on the home feed. |
| **Public API** | Major | 2 | wasmar | 6 REST endpoints secured with a shared API key (`PUBLIC_API_KEY`), rate limiting per key + IP, and an in-app documentation page: `GET /api/public/health`, `GET /api/public/users`, `GET /api/public/activities`, `POST /api/public/activities`, `PUT /api/public/activities/:id`, `DELETE /api/public/activities/:id`. |
| **Standard User Management & Authentication** | Major | 2 | raldanda (UI) · wasmar (backend) | Email/password sign-up and login, Google OAuth integration, email verification, session management via Supabase Auth with JWT tokens, profile onboarding flow, account settings (change email, change password, delete account), and auth policy enforcement preventing duplicate accounts and cross-method conflicts. |
| **ORM for Database** | Minor | 1 | wasmar | Prisma 6 ORM with a declarative schema (`schema.prisma`) defining 9 models with relations, indexes, UUID primary keys, and mapped table/column names. Prisma Client provides type-safe queries, and migrations are handled via `prisma db push`. |
| **Custom Design System** | Minor | 1 | raldanda | 14 reusable components: `Avatar`, `NavBar`, `Footer`, `RouteMap`, `Pill`, `SegmentedControl`, `TimeText`, `ActivityCard`, `AthleteSummaryWidget`, `FeedEmpty`, `FeedSkeleton`, `SocialModal`, `FollowModal`, `Widget`. Consistent color palette, typography, and icon system (Lucide React) across 20+ hand-written CSS stylesheets. |
| **Advanced Search with Filters, Sorting & Pagination** | Minor | 1 | raldanda (UI) · wasmar (API) | Training dashboard with text search, dynamic filter system (sport type, distance range, duration range, date range, source), multi-column sorting (date, distance, duration, sport — ascending/descending), configurable items per page (10/25/50), and page navigation. User search page with real-time query. |
| **File Upload & Management** | Minor | 1 | raldanda (UI) · wasmar (storage + API) | Activity photo uploads with progress bar tracking via `XMLHttpRequest`, GPX file import and parsing, avatar image upload in settings, all stored in Supabase Storage buckets with public URL generation. Backend handles file validation, storage path management, and media records in the database. |
| **Two-Factor Authentication (2FA)** | Minor | 1 | raldanda (UI) · wasmar (backend) | Full TOTP-based 2FA flow: enrollment with QR code display, 6-digit code verification, factor activation/deactivation in settings, and a dedicated MFA challenge page on login. Integrated with Supabase MFA (AAL2) and supports Google Authenticator, Authy, and 1Password. |

**Total: 5 Majors (10 pts) + 5 Minors (5 pts) = 15 points**

---

## Individual Contributions

### raldanda — Product Owner & Frontend Developer

- Defined and prioritized features, maintained the product vision, and validated completed work against user needs.
- Built the entire frontend application from scratch using React 18 and Vite.
- Designed and implemented 15+ pages: Landing, Login, Signup, Home, Profile, UserProfile, Settings, Training, Chat, ChatThread, AddActivity, ActivityDetails, Search, ApiDocs, Mfa, PersonalInfo, PrivacyPolicy, TermsOfService, Verification.
- Created the custom design system with 14 reusable components and 20+ CSS stylesheets.
- Implemented client-side authentication flows (email/password login, Google OAuth redirect, MFA challenge page).
- Built the social feed UI with activity cards, kudos, comments, and social modals.
- Developed the training dashboard with filters, sorting, pagination, and search.
- Integrated Leaflet maps for route visualization.
- Implemented file upload UI with progress tracking (activity photos, GPX files, avatars).
- Built the real-time chat interface with Socket.IO client.
- Implemented units preference (km/mi) with app-wide reactivity.
- Collaborated with wasmar on API integration and WebSocket communication.

**Challenges faced:** Getting the Leaflet map to render correctly inside React and avoiding double-initialization on hot reloads required wrapping the map in a key-controlled container and lazily importing Leaflet to prevent SSR-style issues with Vite. Supabase MFA's two-step enrollment flow (enroll → challenge → verify) was not well-documented, requiring careful study of the AAL (Authenticator Assurance Level) model before the UI flow worked reliably.

---

### wasmar — Tech Lead & Backend Developer

- Defined the technical architecture, made all major stack decisions, and ensured code quality across the backend.
- Architected and built the entire backend using NestJS 10 with TypeScript.
- Designed the PostgreSQL database schema (9 tables) with Prisma ORM.
- Implemented Supabase JWT authentication with custom guards and middleware.
- Built the auth policy enforcement system preventing duplicate accounts and cross-method login conflicts.
- Developed API endpoints for activities (GPX import), users (search, profiles, follow), home feed, and account management.
- Implemented the WebSocket chat gateway with Socket.IO (real-time messaging, online presence).
- Built the public API module with 6 endpoints, shared-key authentication, and rate limiting.
- Set up Supabase Storage integration for file uploads (photos, avatars).
- Configured Docker containerization for the backend (Node 20 Alpine).
- Collaborated with raldanda on API contracts and frontend–backend integration.

**Challenges faced:**  Implementing rate limiting for the public API while keeping it stateless (no Redis) was handled with an in-memory sliding window per key+IP, which required testing under concurrent load. 

---

## Usage

1. Open `http://localhost:5173` in your browser.
2. Sign up with email/password or Google.
3. Complete the onboarding form (personal info).
4. Log your first activity manually or import a GPX file.
5. Search for and follow other users.
6. Interact with the feed — give kudos and leave comments.
7. Start a conversation with another user via the chat.
8. Track your progress on the training dashboard.
9. Customize your settings (units, avatar, 2FA, weekly goal).

---

## License

This project was developed as part of the 42 school curriculum.
