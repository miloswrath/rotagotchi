# Contract: Extension Auth Module

**Feature**: 006-oauth-extension-login
**Date**: 2026-03-27
**Consumer**: `extension/src/popup.ts`, `extension/src/background.ts`

---

## Overview

`extension/src/auth.ts` is the single source of truth for authentication state in the Chrome extension. All other extension modules interact with auth state only through this module's exported functions — never by reading `chrome.storage.local` directly.

---

## Exported Interface

### `getSession(): Promise<StoredAuthSession | null>`

Returns the current session from `chrome.storage.local`, or `null` if the user is not signed in.

- Does **not** attempt a refresh. Callers that need a guaranteed-fresh token should use `getValidSession()`.

---

### `getValidSession(): Promise<StoredAuthSession | null>`

Returns a valid (non-expired) session. If the stored access token expires within 5 minutes, attempts a silent refresh via `supabase.auth.refreshSession()` and updates `chrome.storage.local` before returning. Returns `null` if no session exists or if the refresh fails (e.g., refresh token expired or network error).

**Callers should treat a `null` return as "user is signed out" and transition to the login screen.**

---

### `launchOAuthFlow(): Promise<StoredAuthSession>`

Initiates the GitHub OAuth flow via `chrome.identity.launchWebAuthFlow()`:
1. Generates a PKCE code verifier and challenge
2. Constructs the Supabase OAuth URL with the `chrome.identity` redirect URI and code challenge
3. Opens the Chrome auth window
4. On return, extracts the authorization code from the redirect URL
5. Exchanges the code for a session via `supabase.auth.exchangeCodeForSession()`
6. Persists the session to `chrome.storage.local`
7. Returns the stored session

**Throws** if the user cancels the flow, the network is unavailable, or the code exchange fails.

---

### `signOut(): Promise<void>`

Signs the user out:
1. Calls `supabase.auth.signOut()` to invalidate the server-side session
2. Removes `authSession` from `chrome.storage.local`

Does **not** throw on network errors during `supabase.auth.signOut()` (best-effort server invalidation); always clears local storage.

---

### `onSessionChanged(callback: (session: StoredAuthSession | null) => void): () => void`

Registers a listener that fires whenever the auth session changes in `chrome.storage.local` (added, updated, or removed). Returns an unsubscribe function.

Used by `popup.ts` to reactively update the connection-status indicator without polling.

---

## Storage Key Contract

| Key | Store | Type | Written by | Read by |
|-----|-------|------|-----------|---------|
| `authSession` | `chrome.storage.local` | `StoredAuthSession \| undefined` | `auth.ts` only | `auth.ts` only (via exports above) |

No other module may read or write the `authSession` key directly.

---

## Error Handling Contract

| Scenario | Behavior |
|----------|----------|
| User cancels OAuth flow | `launchOAuthFlow()` throws with message `"OAuth flow cancelled"` |
| Network error during code exchange | `launchOAuthFlow()` throws with network error |
| Refresh token expired | `getValidSession()` clears local session, returns `null` |
| Network error during refresh | `getValidSession()` returns existing (potentially near-expiry) session with a warning logged; does not clear it |
| `signOut()` network error | Server invalidation fails silently; local session is always cleared |

---

## Supabase OAuth URL Parameters

The OAuth URL constructed by `launchOAuthFlow()` must include:

| Parameter | Value |
|-----------|-------|
| `provider` | `github` |
| `redirect_to` | `chrome.identity.getRedirectURL()` |
| `code_challenge` | PKCE SHA-256 challenge (base64url) |
| `code_challenge_method` | `S256` |
| `scopes` | `read:user user:email` (matches web app) |

The `redirect_to` value must be registered in the Supabase project's "Redirect URLs" list before the flow will succeed. See `quickstart.md` for setup instructions.
