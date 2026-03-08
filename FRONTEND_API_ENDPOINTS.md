# Frontend APIs (Strava Replica)

The frontend talks to two "API surfaces":

1) Supabase Auth (directly from the browser)
2) Your backend (NestJS) for app endpoints + uploads

Backend base URL

- `VITE_BACKEND_URL` (default in code: `http://localhost:3004`)
- All backend routes are prefixed with `/api`.

Auth header

- Protected backend routes require:

```
Authorization: Bearer <supabase_access_token>
```

---

## Supabase Auth (frontend)

Used in the frontend via `@supabase/supabase-js`.

- Signup: `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })`
- Login: `supabase.auth.signInWithPassword({ email, password })`
- Google OAuth: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`
- Resend verification email: `supabase.auth.resend({ type: 'signup', email })`
- Forgot password: `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
- Reset password: `supabase.auth.updateUser({ password })`
- Logout: `supabase.auth.signOut()`

Redirect routes (allowlist in Supabase Dashboard):

- `/auth/callback`
- `/verification`
- `/reset-password`

---

## Profile + User API (backend)

### Get my user + profile

- `GET /api/me`
- Auth: required

### Update my profile (single endpoint)

- `PUT /api/me`
- Auth: required
- Body: partial update (any fields may be omitted)

```json
{
  "firstName": "A",
  "lastName": "B",
  "dateOfBirth": "2000-01-01",
  "gender": "male",
  "level": "beginner",
  "weightKg": 70.5,
  "heightCm": 180.2,
  "onboardingCompletedAt": "2026-03-07T00:00:00.000Z"
}
```

### Update personal info (legacy)

- `PUT /api/me/personal`
- Auth: required

### Update physical info (legacy)

- `PUT /api/me/physical`
- Auth: required

### Upload avatar

- `POST /api/me/avatar`
- Auth: required
- multipart field: `file`

### Public user profile

- `GET /api/users/:id`
- Auth: optional

### Public user activities

- `GET /api/users/:id/activities`
- Auth: optional

---

## Activities API (backend)

### Create manual activity

- `POST /api/activities`
- Auth: required

```json
{
  "sport": "run",
  "title": "Morning run",
  "description": "easy",
  "startedAt": "2026-03-07T06:00:00.000Z",
  "durationSeconds": 1800,
  "distanceMeters": 5000,
  "visibility": "public"
}
```

### Get activity

- `GET /api/activities/:id`
- Auth: optional

### My activities

- `GET /api/me/activities`
- Auth: required

### Delete activity

- `DELETE /api/activities/:id`
- Auth: required (owner)

### Upload activity photo

- `POST /api/activities/:id/media`
- Auth: required
- multipart field: `file`

### Import activity from GPX

- `POST /api/activities/import/gpx`
- Auth: required
- multipart field: `file`
- optional fields: `title`, `description`, `visibility`, `sport`
