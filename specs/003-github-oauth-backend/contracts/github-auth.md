# Contract: GitHub App OAuth Flow

---

## Purpose

Handles the GitHub App OAuth callback, exchanges the authorization code for user tokens, stores the GitHub provider tokens in `user_github_tokens`, and establishes a Supabase session for the user.

---

## Endpoints

### Initiate Sign-In

**Trigger**: User clicks "Sign in with GitHub" in the extension popup.

**Action**: Extension opens a browser tab to the Supabase Auth GitHub provider URL. Supabase handles the redirect to GitHub's OAuth authorization page.

**Route**: Managed by Supabase Auth — no custom route needed for initiation.

---

### OAuth Callback

**Endpoint**: `GET /api/auth/callback`
**Route file**: `app/api/auth/callback/route.ts`

**Query Parameters** (provided by GitHub redirect):

| Parameter | Description |
|-----------|-------------|
| `code` | Authorization code from GitHub |
| `state` | CSRF state token (validated by Supabase) |

**Processing Logic**:

1. Exchange `code` for a Supabase session using Supabase Auth's `exchangeCodeForSession(code)`
2. Extract `provider_token` (GitHub access token) and `provider_refresh_token` from the session
3. Upsert a row in `user_github_tokens` with the access token, refresh token, and expiry timestamps
4. Trigger GitHub App installation check: verify an installation exists for this user; if not, redirect to the GitHub App installation URL
5. Redirect user back to the extension popup with a success indicator

**Responses**:

| Condition | Response |
|-----------|----------|
| Success | Redirect to extension popup URL with `?auth=success` |
| No installation found | Redirect to GitHub App installation URL |
| Code exchange fails | Redirect to extension popup URL with `?auth=error&reason=exchange_failed` |
| Token storage fails | 500 — logged, user prompted to retry |

---

### Token Refresh (Internal)

**Trigger**: Server-side, when `access_token_expires_at` is within 60 minutes of current time.

**Action**: Call GitHub's token refresh endpoint using the stored `refresh_token`. Update `user_github_tokens` with new tokens and expiry timestamps.

**Not a public endpoint** — triggered by the webhook receiver or any other server-side operation that needs a valid GitHub token.

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | For server-side token storage writes |
| `GITHUB_APP_ID` | GitHub App identifier |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key (PEM format) for installation tokens |
| `GITHUB_CLIENT_ID` | GitHub App OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub App OAuth client secret |
