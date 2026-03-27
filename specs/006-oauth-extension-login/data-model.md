# Data Model: OAuth Login in Chrome Extension

**Feature**: 006-oauth-extension-login
**Date**: 2026-03-27

---

## Extension Storage Entities

### AuthSession (`chrome.storage.local` key: `authSession`)

Represents the persisted Supabase session inside the extension. Written after a successful OAuth exchange; read on every popup open to determine the current screen.

```typescript
interface StoredAuthSession {
  accessToken: string;            // Supabase JWT (expires in ~1 hour by default)
  refreshToken: string;           // Supabase refresh token (long-lived)
  expiresAt: number;              // Unix timestamp (seconds) — when accessToken expires
  userId: string;                 // Supabase user UUID
  githubLogin: string;            // GitHub username (from user_metadata.user_name)
  githubEmail: string | null;     // GitHub email, if provided
}
```

**Validation rules**:
- `accessToken` and `refreshToken` must be non-empty strings
- `expiresAt` must be a positive integer (Unix seconds)
- `userId` must be a non-empty UUID string
- Entire key is absent when the user is logged out; presence of the key implies an existing session

**State transitions**:

```
absent
  ↓ (successful OAuth exchange → supabase.auth.exchangeCodeForSession)
StoredAuthSession { all fields populated }
  ↓ (access token near expiry → supabase.auth.refreshSession)
StoredAuthSession { accessToken, expiresAt updated; all others unchanged }
  ↓ (user signs out OR token revoked externally)
absent
```

**Lifecycle**:
- Created: after `chrome.identity.launchWebAuthFlow()` completes and code is exchanged
- Updated: when the popup opens and `expiresAt` is within 5 minutes of current time
- Deleted: on explicit sign-out or unrecoverable refresh failure

---

### PopupScreen (in-memory only, not persisted)

Represents the currently displayed screen in the extension popup. Not stored; re-derived on every popup open.

```typescript
type PopupScreen = 'intro' | 'login' | 'main';
```

**Derivation logic on DOMContentLoaded**:

```
chrome.storage.local has 'authSession' key?
  YES → screen = 'main'
  NO  → screen = 'intro' (timer starts → 'login' after ~3 s)
```

---

### TabState (`chrome.storage.session` key: `tabState`) — **unchanged**

Existing entity; no modifications in this feature. Documented here for completeness.

```typescript
interface TabState {
  url: string;
  hostname: string;
  classification: 'degenerative' | 'neutral';
  tabId: number;
  timestamp: number;
}
```

---

## Backend Entities (existing, no changes required)

The following Supabase tables are used by the existing OAuth flow and are not modified by this feature. The extension's OAuth flow reuses the same Supabase project; no new tables or columns are needed.

| Table | Owned By | Relevant to this feature? |
|-------|----------|--------------------------|
| `user_github_tokens` | 003-github-oauth-backend | Yes — populated by existing `/api/auth/callback` (called indirectly via Supabase OAuth); extension reads user identity from the session JWT only |
| `webhook_installations` | 003-github-oauth-backend | No direct interaction from extension |
| `webhook_events` | 003-github-oauth-backend | No direct interaction from extension |
| `commit_events` | 003-github-oauth-backend | No direct interaction from extension |

**Note**: The extension does not call any Supabase database tables directly. It only interacts with Supabase Auth (OAuth exchange and session refresh). All webhook and commit-event logic continues to flow through the existing backend routes.

---

## Connection Status Derivation

Connection status displayed in the tamagotchi view is derived at render time from `chrome.storage.local`:

```
authSession present AND expiresAt > now - refresh_threshold
  → status = 'connected'  (green indicator)

authSession absent OR expired AND refresh failed
  → status = 'disconnected'  (grey indicator)
```

This is a read-only computed value; it has no independent persistence.
