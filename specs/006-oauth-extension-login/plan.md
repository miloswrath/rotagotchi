# Implementation Plan: OAuth Login in Chrome Extension

**Branch**: `006-oauth-extension-login` | **Date**: 2026-03-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-oauth-extension-login/spec.md`

## Summary

Add GitHub OAuth login to the Chrome extension, mirroring the existing web-app flow via the Chrome Identity API. The extension popup displays a tamagotchi intro animation (~3 s) on first open (no session), then transitions to a login screen. On successful authentication, a connection-status indicator appears within the tamagotchi view. Returning users with a valid persisted session skip directly to the tamagotchi view.

## Technical Context

**Language/Version**: TypeScript 5.x, targeting Chrome 88+ (Manifest V3)
**Primary Dependencies**: `lottie-web` (animation, already bundled), `@supabase/supabase-js` (browser client, added to extension bundle), `esbuild` (existing bundler)
**Storage**: `chrome.storage.local` (persist Supabase session across restarts); Supabase Postgres `user_github_tokens` (server-side, existing)
**Testing**: Vitest (unit stubs for auth module), Playwright (e2e smoke — extension load and auth flow simulation)
**Target Platform**: Chrome Extension Manifest V3 popup + service worker
**Project Type**: Browser extension with companion Next.js web backend
**Performance Goals**: Connection status indicator visible within 500 ms of popup open; intro animation ≤ 5 s before login prompt
**Constraints**: Extension popup cannot perform browser redirects; must use `chrome.identity.launchWebAuthFlow()` for OAuth; Supabase redirect URL allowlist must include the `chrome.identity` redirect URI
**Scale/Scope**: Single authenticated user per extension install

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Commit-Triggered Enforcement | ✅ PASS | This feature provides the auth layer that enables commit-event association (Principle I requires commit + author binding). Login is prerequisite infrastructure. |
| II. Proportional Degenerative Time | ✅ PASS | Not affected — no changes to time-mapping logic. |
| III. Mandatory Watch Gate | ✅ PASS | Not affected — no changes to gate enforcement. |
| IV. Avatar Vitality Coupling | ✅ PASS | Not affected — vitality model unchanged. |
| V. Deterministic Activity Classification | ✅ PASS | Not affected — classification rules unchanged. |

**Constitution Gate**: PASS — no violations. Feature is prerequisite infrastructure for Principle I.

## Project Structure

### Documentation (this feature)

```text
specs/006-oauth-extension-login/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── extension-auth.md
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
extension/
├── src/
│   ├── auth.ts          (NEW — session storage, OAuth launch, auth state)
│   ├── popup.ts         (MODIFIED — multi-screen: intro → login → tamagotchi)
│   ├── background.ts    (MODIFIED — initialize auth state on install/startup)
│   ├── classify.ts      (unchanged)
│   └── options.ts       (unchanged)
├── popup.html           (MODIFIED — login screen + connection-status indicator)
└── manifest.json        (MODIFIED — add identity permission)

scripts/
└── build-extension.js   (MODIFIED — add auth.ts entry point or include in popup bundle)

app/
└── (no new routes required — existing /api/auth/callback handles token exchange)
```

**Structure Decision**: Single-project; the extension's popup.ts is extended with screen-routing logic. Auth state is isolated in a new `auth.ts` module. No new Next.js routes needed; the existing Supabase OAuth callback flow is reused by pointing the `chrome.identity` redirect URI at a Supabase-registered redirect URL.
