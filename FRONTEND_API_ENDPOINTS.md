# Frontend API Endpoints

This repo uses **Supabase Auth** for authentication and a **NestJS backend** for profile/onboarding APIs.

Your frontend calls two "API surfaces":

1) Supabase Auth (via `@supabase/supabase-js`)
2) Backend REST endpoints (via `fetch` in `front_end/src/backendApi.js`)

---

## Backend (NestJS) REST API

Base URL

- Default: `http://localhost:3004`
- Configurable in frontend with: `VITE_BACKEND_URL`

Auth

- All endpoints below require:

```
Authorization: Bearer <supabase_access_token>
```

The frontend automatically adds this header in:

- `front_end/src/backendApi.js`

Endpoints

### Get current user + profile

- `GET /api/me`
- Response:
  - `{ user: { id, email }, profile }`

### Save personal info

- `PUT /api/me/personal`
- JSON body:

```json
{
  "firstName": "string",
  "lastName": "string",
  "dateOfBirth": "YYYY-MM-DD",
  "gender": "male|female|other|prefer_not_to_say" 
}
```

### Save physical info

- `PUT /api/me/physical`
- JSON body:

```json
{
  "level": "string",
  "weightKg": 70.5,
  "heightCm": 180.2
}
```

Validation notes:
- `weightKg` max is `500`
- `heightCm` max is `300`

### Upload avatar

- `POST /api/me/avatar`
- Content-Type: `multipart/form-data`
- Form field name: `file`
- Allowed types: `image/jpeg`, `image/png`, `image/webp`
- Response:
  - `{ avatarUrl }`

---

## Supabase Auth (used by the frontend)

These are not backend endpoints you host; they are calls made by the Supabase client.

Configured by:

- `front_end/src/supabaseClient.js`
- `front_end/.env`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

Frontend flows

- Signup: `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })`
- Login: `supabase.auth.signInWithPassword({ email, password })`
- Google OAuth: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`
- Resend verification email: `supabase.auth.resend({ type: 'signup', email })`
- Forgot password: `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
- Reset password: `supabase.auth.updateUser({ password: newPassword })`
- Logout: `supabase.auth.signOut()`

Frontend routes used by Supabase redirects

- `/auth/callback`
- `/reset-password`
