# Quickstart: OAuth Login in Chrome Extension

**Feature**: 006-oauth-extension-login
**Date**: 2026-03-27

---

## Prerequisites

- Extension already loads in Chrome (feature 005 complete — `npm run build:extension` produces a valid `extension/dist/`)
- Supabase project credentials in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- GitHub OAuth App configured in the Supabase project (provider enabled)

---

## One-Time Setup: Register Extension Redirect URL in Supabase

The Chrome Identity API uses an extension-specific redirect URL. This URL must be added to the Supabase project's allowed redirect URLs once before the OAuth flow will work.

**Step 1 — Find your extension's redirect URL:**

In Chrome, open the Extensions page (`chrome://extensions/`), enable Developer Mode, find the Rotagotchi extension, and copy the extension ID (a 32-character string like `abcdefghijklmnopqrstuvwxyz012345`).

The redirect URL is: `https://<extension-id>.chromiumapp.org/`

Alternatively, log this in the browser console from a temporary extension script:
```javascript
console.log(chrome.identity.getRedirectURL());
```

**Step 2 — Add to Supabase:**

1. Go to your Supabase project → Authentication → URL Configuration
2. Under "Redirect URLs", add: `https://<extension-id>.chromiumapp.org/`
3. Save

**Note**: The extension ID is stable for a given unpacked extension load path. If you move the extension directory or load it from a different path, the ID may change and you will need to update this URL.

---

## Build

```bash
# From repo root
npm run build:extension
```

This compiles `extension/src/*.ts` (including the new `auth.ts`) and outputs to `extension/dist/`.

---

## Load Extension in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" → select `extension/dist/`
4. The Rotagotchi extension icon appears in the toolbar

---

## Verify First-Run Flow

1. Click the Rotagotchi extension icon
2. The tamagotchi idle animation plays for ~3 seconds
3. The popup transitions to the "Sign in with GitHub" screen
4. Click "Sign in with GitHub"
5. A Chrome auth window opens and navigates to GitHub's authorization page
6. Authorize the app on GitHub
7. The auth window closes; the extension popup transitions to the tamagotchi view
8. The connection-status badge shows "● Connected"

---

## Verify Returning-User Flow

1. Close and reopen the extension popup
2. The tamagotchi view loads immediately with "● Connected" — no intro animation or login prompt

---

## Verify Sign-Out Flow

1. In the tamagotchi view, click "Sign out" (or the disconnected badge)
2. The intro animation plays again (~3 s)
3. The login screen appears

---

## Verify Disconnected-State Indicator

1. Open the extension before signing in (or after signing out)
2. If the extension is on the tamagotchi view for any reason, the badge shows "● Disconnected"
3. Clicking the badge navigates to the login screen

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| OAuth window opens but redirects back with error | Redirect URL not registered in Supabase | Follow "One-Time Setup" above |
| "OAuth flow cancelled" error after closing auth window | User closed the Chrome auth window | Expected — show retry UI |
| Session not persisted after login | `chrome.storage.local` write failed | Check extension permissions; `"storage"` must be in manifest |
| Connection badge never shows "Connected" | `authSession` key missing or malformed | Check DevTools → Application → Extension Storage |
| Extension ID changed after reinstall | New load path generates new ID | Re-run one-time setup with new redirect URL |
