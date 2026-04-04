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

Create a `.env` file at the project root with the following variables:

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
| **raldanda** | Frontend Developer | All frontend development — UI/UX design, React components, pages, styling, client-side routing, and state management |
| **wasmar** | Backend Developer | All backend development — NestJS API, Prisma ORM, database schema, authentication, WebSocket chat, and public API |
| **raldanda & wasmar** | Integration | Collaborative work on frontend–backend integration, API contracts, WebSocket communication, and end-to-end feature wiring |

---

## Project Management

### Organization

The work was split naturally between frontend and backend. raldanda owned all frontend development (React pages, components, styling, client-side logic) while wasmar owned the backend (NestJS API, database, authentication, WebSockets). Integration work — connecting the frontend to the backend APIs, WebSocket events, and file upload flows — was done collaboratively, with both team members working together to define API contracts, test end-to-end flows, and debug cross-layer issues.

We worked in an iterative approach: core features (auth, activities, profiles) were built first, followed by social features (feed, kudos, comments, follow), then chat, and finally polish items (2FA, public API, training dashboard filters, settings). Regular check-ins ensured frontend and backend stayed in sync.

### Tools

- **GitHub** — version control and code collaboration
- **Discord** — daily communication, screen sharing for debugging, and planning discussions

---

## Technical Stack

### Frontend

- **React 18** — UI library with functional components and hooks
- **Vite 5** — fast development server and build tool
- **React Router v7** — client-side routing with protected routes
- **Leaflet / React Leaflet** — interactive maps for activity routes
- **Socket.IO Client** — real-time WebSocket communication for chat
- **Supabase JS Client** — authentication (email/password, Google OAuth, MFA)
- **Lucide React** — icon library
- **Multiavatar** — unique auto-generated user avatars
- **react-otp-input** — OTP input component for 2FA verification
- **CSS** — custom hand-written stylesheets (no CSS framework)

### Backend

- **NestJS 10** — modular Node.js framework with TypeScript
- **Prisma 6** — type-safe ORM for PostgreSQL
- **Socket.IO** — WebSocket server for real-time chat
- **Supabase Auth** — JWT verification, MFA, and admin operations
- **class-validator / class-transformer** — DTO validation and transformation
- **jsonwebtoken / jwks-rsa** — JWT token verification against Supabase JWKS
- **compression** — HTTP response compression middleware

### Database

- **PostgreSQL** — relational database (provided via Supabase)
- Chosen for its reliability, strong relational model, and seamless integration with both Prisma and Supabase

### Infrastructure

- **Docker** — containerized frontend and backend (Node 20 Alpine)
- **Supabase** — managed authentication, file storage (activity photos, avatars), and PostgreSQL hosting

---

## Database Schema

The database consists of **8 tables** managed through Prisma ORM:

### Core Tables

- **profiles** — user profile data (username, avatar, name, date of birth, gender, bio, weekly goal, onboarding status)
- **activities** — workout entries (sport type, title, description, start time, duration, distance, source, route polyline, map image)
- **activity_media** — photos and media attached to activities (storage bucket/path references)

### Social Tables

- **activity_kudos** — likes on activities (composite key: activity + user)
- **activity_comments** — comments on activities with timestamps
- **follows** — follower/following relationships between users

### Messaging Tables

- **conversations** — chat threads with last message preview and timestamp
- **conversation_participants** — many-to-many link between users and conversations
- **messages** — individual chat messages within conversations

### Relationships

- Activities have many kudos, comments, and media (cascade delete)
- Conversations have many participants and messages (cascade delete)
- All tables use UUID primary keys and timestamptz for date fields
- Indexes on foreign keys and frequently queried columns (userId, startedAt, createdAt)

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

| Module | Type | Pts | Justification & Implementation |
|--------|------|-----|-------------------------------|
| **Use a Framework (Frontend & Backend)** | Major | 2 | **Frontend:** React 18 with Vite as the build tool, React Router v7 for SPA routing, and a component-based architecture across 15+ pages. **Backend:** NestJS 10 with TypeScript, using modules, controllers, guards, DTOs, pipes, and dependency injection for a clean, scalable architecture. |
| **Real-Time Features (WebSockets)** | Major | 2 | Real-time private chat implemented with Socket.IO. The backend uses a NestJS WebSocket gateway (`@WebSocketGateway`) with JWT-authenticated connections. Features include instant message delivery, online/offline presence tracking, and conversation-scoped rooms. The frontend connects via `socket.io-client`. |
| **User Social Interaction** | Major | 2 | **Chat:** Full private messaging system with conversations, message history, and real-time delivery. **Profiles:** User profiles with avatar, bio, stats (followers, following, activities), recent activities, and photo gallery. **Follow system:** Follow/unfollow users, followers/following lists with modals, and recommended users on the home feed. |
| **Public API** | Major | 2 | 6 REST endpoints secured with a shared API key (`PUBLIC_API_KEY`), rate limiting per key + IP, and an in-app documentation page: `GET /api/public/health`, `GET /api/public/users`, `GET /api/public/activities`, `POST /api/public/activities`, `PUT /api/public/activities/:id`, `DELETE /api/public/activities/:id`. |
| **Standard User Management & Authentication** | Major | 2 | Email/password sign-up and login, Google OAuth integration, email verification, session management via Supabase Auth with JWT tokens, profile onboarding flow, account settings (change email, change password, delete account), and auth policy enforcement preventing duplicate accounts and cross-method conflicts. |
| **ORM for Database** | Minor | 1 | Prisma 6 ORM with a declarative schema (`schema.prisma`) defining 8 models with relations, indexes, UUID primary keys, and mapped table/column names. Prisma Client provides type-safe queries, and migrations are handled via `prisma db push`. |
| **Custom Design System** | Minor | 1 | 14 reusable components: `Avatar`, `NavBar`, `Footer`, `RouteMap`, `Pill`, `SegmentedControl`, `TimeText`, `ActivityCard`, `AthleteSummaryWidget`, `FeedEmpty`, `FeedSkeleton`, `SocialModal`, `FollowModal`, `Widget`. Consistent color palette, typography, and icon system (Lucide React) across 20+ hand-written CSS stylesheets. |
| **Advanced Search with Filters, Sorting & Pagination** | Minor | 1 | Training dashboard with text search, dynamic filter system (sport type, distance range, duration range, date range, source), multi-column sorting (date, distance, duration, sport — ascending/descending), configurable items per page (10/25/50), and page navigation. User search page with real-time query. |
| **File Upload & Management** | Minor | 1 | Activity photo uploads with progress bar tracking via `XMLHttpRequest`, GPX file import and parsing, avatar image upload in settings, all stored in Supabase Storage buckets with public URL generation. Backend handles file validation, storage path management, and media records in the database. |
| **Two-Factor Authentication (2FA)** | Minor | 1 | Full TOTP-based 2FA flow: enrollment with QR code display, 6-digit code verification, factor activation/deactivation in settings, and a dedicated MFA challenge page on login. Integrated with Supabase MFA (AAL2) and supports Google Authenticator, Authy, and 1Password. |

**Total: 5 Majors (10 pts) + 5 Minors (5 pts) = 15 points**

---

## Individual Contributions

### raldanda — Frontend Developer

- Built the entire frontend application from scratch using React 18 and Vite
- Designed and implemented 15+ pages: Landing, Login, Signup, Home, Profile, UserProfile, Settings, Training, Chat, ChatThread, AddActivity, ActivityDetails, Search, ApiDocs, Mfa, PersonalInfo, PrivacyPolicy, TermsOfService, Verification
- Created the custom design system with 14 reusable components and 20+ CSS stylesheets
- Implemented client-side authentication flows (email/password login, Google OAuth redirect, MFA challenge page)
- Built the social feed UI with activity cards, kudos, comments, and social modals
- Developed the training dashboard with filters, sorting, pagination, and search
- Integrated Leaflet maps for route visualization
- Implemented file upload UI with progress tracking (activity photos, GPX files, avatars)
- Built the real-time chat interface with Socket.IO client
- Implemented units preference (km/mi) with app-wide reactivity
- Collaborated with wasmar on API integration and WebSocket communication

### wasmar — Backend Developer

- Architected and built the entire backend using NestJS 10 with TypeScript
- Designed the PostgreSQL database schema (8 tables) with Prisma ORM
- Implemented Supabase JWT authentication with custom guards and middleware
- Built the auth policy enforcement system preventing duplicate accounts and cross-method login conflicts
- Developed RESTful API endpoints for activities (CRUD, GPX import), users (search, profiles, follow), home feed, and account management
- Implemented the WebSocket chat gateway with Socket.IO (real-time messaging, online presence)
- Built the public API module with 6 endpoints, shared-key authentication, and rate limiting
- Set up Supabase Storage integration for file uploads (photos, avatars)
- Configured Docker containerization for the backend (Node 20 Alpine)
- Collaborated with raldanda on API contracts and frontend–backend integration

---

## Usage

1. Open `http://localhost:5173` in your browser
2. Sign up with email/password or Google
3. Complete the onboarding form (personal info)
4. Log your first activity manually or import a GPX file
5. Search for and follow other users
6. Interact with the feed — give kudos and leave comments
7. Start a conversation with another user via the chat
8. Track your progress on the training dashboard
9. Customize your settings (units, avatar, 2FA, weekly goal)

---

## License

This project was developed as part of the 42 school curriculum.
