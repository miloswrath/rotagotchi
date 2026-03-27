# Research: OAuth Login in Chrome Extension

**Feature**: 006-oauth-extension-login
**Date**: 2026-03-27

---

## R-001: OAuth in Chrome Extension Manifest V3 (MV3)

**Decision**: Use `chrome.identity.launchWebAuthFlow()` to initiate the GitHub OAuth dance inside the extension, with the `chrome.identity` redirect URI registered in Supabase as an allowed callback URL.

**Rationale**:
- Extension popups cannot perform top-level browser redirects — a redirect in the popup would close it.
- `chrome.identity.launchWebAuthFlow()` opens a dedicated Chrome auth window, handles the OAuth redirect URL interception, and returns the final redirect URL (containing the auth code/token) back to the extension. This is the canonical MV3 approach for OAuth.
- The existing web app uses Supabase `signInWithOAuth()` which just constructs an OAuth URL and redirects to it. The extension replicates this by constructing the same URL manually and passing it to `launchWebAuthFlow()`.
- `chrome.identity.getRedirectURL()` returns the extension-specific redirect URL (e.g., `https://<id>.chromiumapp.org/`). This URL must be added to the Supabase project's "Redirect URLs" allowlist.

**Alternatives considered**:
- **Open a new tab to the main web app**: Simpler but requires a separate mechanism (e.g., `externally_connectable` + `chrome.runtime.sendMessage`) to pass tokens back to the extension. Fragile and creates UX friction.
- **Service worker intercepts a redirect**: Not supported in MV3 — service workers cannot intercept navigation events.

---

## R-002: Supabase Session in the Extension

**Decision**: After `launchWebAuthFlow()` returns the redirect URL, extract the Supabase access token and refresh token from the URL fragment, then call `supabase.auth.setSession()` to hydrate the browser client. Persist the raw session object in `chrome.storage.local` under key `authSession`.

**Rationale**:
- Supabase's redirect callback appends tokens as a URL fragment (`#access_token=...&refresh_token=...`) when using the `implicit` flow, or appends an auth code in the query string when using `PKCE`. PKCE is the recommended approach for public clients.
- For PKCE, the extension generates a code verifier/challenge, passes the challenge in the OAuth URL, and after `launchWebAuthFlow()` returns the code, exchanges it with `supabase.auth.exchangeCodeForSession()`.
- The resulting session (access token + refresh token + expiry) is stored in `chrome.storage.local` so it survives browser restarts (unlike `chrome.storage.session`).
- On each popup open, the extension reads the stored session, checks expiry, and calls `supabase.auth.refreshSession()` if the access token is near expiry — matching the existing server-side `refreshGitHubTokenIfNeeded()` pattern.

**Alternatives considered**:
- **Implicit flow (token in URL hash)**: Simpler to implement but deprecated by OAuth 2.1 / Supabase 2.x best practices. PKCE is the secure default.
- **Store only the Supabase user ID**: Insufficient — the extension needs a valid access token to call the Supabase backend for any future feature needs.

---

## R-003: Popup Multi-Screen Architecture

**Decision**: Implement screen routing in `popup.ts` using a simple string state variable (`'intro' | 'login' | 'main'`) stored only in memory (not persisted). The active screen is selected on DOMContentLoaded based on auth state in `chrome.storage.local`, then transitions are driven by timers and user events.

**Rationale**:
- The existing popup.ts already has a single rendering path (load animation from session storage). Extending it with a screen router keeps the complexity contained in one module.
- Three screens:
  1. **intro**: Plays tamagotchi idle animation for ~3 s with no interaction (timer-driven).
  2. **login**: Shows "Sign in with GitHub" button; launches OAuth flow on click.
  3. **main**: Shows tamagotchi animation + connection-status indicator.
- Session detection (chrome.storage.local `authSession`) on DOMContentLoaded determines whether to start at `intro` (no session) or jump directly to `main` (valid session).
- The intro screen only plays once per cold install. Subsequent opens go straight to `main`.

**Alternatives considered**:
- **Separate HTML files per screen (login.html, main.html)**: Cleaner separation but requires `chrome.action.setPopup()` calls and reloading the popup window between screens — causes flicker and is harder to animate transitions.
- **iframe-based screen switching**: Unnecessary complexity.

---

## R-004: Connection-Status Indicator Design

**Decision**: Add a small status badge element to `popup.html` that is always visible in the tamagotchi view. It shows "● Connected" (green) when a valid session exists and "● Disconnected" (grey/amber) when not. Clicking the disconnected badge navigates to the login screen.

**Rationale**:
- The existing popup.html already has indicator orbs at the top and a status label at the bottom; the connection badge fits naturally in the existing aesthetic.
- The badge reads auth state from `chrome.storage.local` synchronously on popup open and updates reactively via `chrome.storage.onChanged` (the same pattern already used for tab state).
- No additional animations or overlays needed — consistent with the retro tamagotchi aesthetic.

**Alternatives considered**:
- **Full overlay when disconnected**: Disruptive; the tamagotchi view should remain visible.
- **Toast notification**: Too ephemeral; users need persistent ambient status.

---

## R-005: Manifest Changes Required

**Decision**: Add `"identity"` to the extension's `permissions` array in `manifest.json`.

**Rationale**:
- `chrome.identity.launchWebAuthFlow()` requires the `"identity"` permission.
- No other manifest changes are needed; `"storage"` permission is already declared.

**Supabase side**: The extension developer must add `chrome.identity.getRedirectURL()` (e.g., `https://axxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.chromiumapp.org/`) to the Supabase project's "Redirect URLs" list. This is a one-time manual setup step documented in quickstart.md.

---

## R-006: Sign-Out in Extension

**Decision**: Add a "Sign out" action (small button or tap on status badge) in the main tamagotchi view that clears `authSession` from `chrome.storage.local` and calls `supabase.auth.signOut()`, then transitions the screen back to `intro` (replaying the animation) → `login`.

**Rationale**:
- FR-009 requires the extension to support explicit sign-out and reset to the intro/login flow.
- `supabase.auth.signOut()` invalidates the Supabase session server-side; clearing `chrome.storage.local` ensures the extension no longer has the stale token.
- Replaying the intro animation before the login screen provides a consistent first-open experience.
