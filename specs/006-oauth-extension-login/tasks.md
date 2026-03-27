# Tasks: OAuth Login in Chrome Extension

**Input**: Design documents from `/specs/006-oauth-extension-login/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

## Path Conventions

Extension source lives in `extension/src/`; built output in `extension/dist/`. Build scripts in `scripts/`. No new Next.js routes needed for this feature.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pre-conditions and manifest changes required before any auth code can run.

- [x] T001 Add `"identity"` to the `permissions` array in `extension/manifest.json`
- [x] T002 [P] Create `extension/src/auth.ts` with the module skeleton: exported function stubs matching the contract in `specs/006-oauth-extension-login/contracts/extension-auth.md` (empty bodies, correct TypeScript signatures)
- [x] T003 [P] Define the `StoredAuthSession` interface and `PopupScreen` type in `extension/src/auth.ts` per `specs/006-oauth-extension-login/data-model.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Complete `extension/src/auth.ts` module — all user story phases depend on it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Implement `getSession(): Promise<StoredAuthSession | null>` in `extension/src/auth.ts` — reads `authSession` key from `chrome.storage.local`, returns null if absent
- [x] T005 [P] Implement `onSessionChanged(callback)` in `extension/src/auth.ts` — wraps `chrome.storage.onChanged`, fires callback with new `StoredAuthSession` or null when the `authSession` key changes; returns unsubscribe function
- [x] T006 Implement PKCE helpers (code verifier generation, SHA-256 challenge, base64url encoding) as private functions in `extension/src/auth.ts`
- [x] T007 Implement `launchOAuthFlow(): Promise<StoredAuthSession>` in `extension/src/auth.ts` — constructs Supabase OAuth URL with PKCE challenge and `chrome.identity.getRedirectURL()` as `redirect_to`, calls `chrome.identity.launchWebAuthFlow()`, extracts auth code from returned URL, exchanges via `supabase.auth.exchangeCodeForSession()`, persists result to `chrome.storage.local` as `authSession`
- [x] T008 Implement `getValidSession(): Promise<StoredAuthSession | null>` in `extension/src/auth.ts` — calls `getSession()`, refreshes via `supabase.auth.refreshSession()` if `expiresAt` is within 5 minutes, updates `chrome.storage.local`, returns null on unrecoverable failure
- [x] T009 Implement `signOut(): Promise<void>` in `extension/src/auth.ts` — calls `supabase.auth.signOut()` (best-effort), then removes `authSession` from `chrome.storage.local` unconditionally

**Checkpoint**: `auth.ts` module complete — all exported functions match the contract. User story implementation can now begin.

---

## Phase 3: User Story 1 — First-Time Extension Login Prompt (Priority: P1) 🎯 MVP

**Goal**: First-time users see a ~3-second tamagotchi intro, then an automatic transition to the GitHub OAuth login prompt. Completing login returns them to the tamagotchi view.

**Independent Test**: Install extension fresh (no prior session), open popup — observe intro animation → login screen auto-transition → complete GitHub OAuth → verify tamagotchi view appears with no errors.

### Implementation for User Story 1

- [x] T010 [US1] Add a login screen `<section id="login-screen">` to `extension/popup.html` containing a "Sign in with GitHub" button and an error/retry area (hidden by default via CSS `display:none`)
- [x] T011 [US1] Add CSS rules to `extension/popup.html` for the `.screen-hidden` / `.screen-active` utility classes that show/hide the intro container, login screen, and main tamagotchi container
- [x] T012 [US1] Add a `PopupScreen` state variable and `showScreen(screen: PopupScreen)` function to `extension/src/popup.ts` that toggles `.screen-active` on the correct section and `.screen-hidden` on the others
- [x] T013 [US1] Update `DOMContentLoaded` handler in `extension/src/popup.ts` to call `getValidSession()` and route to `'main'` if a session exists, or start on `'intro'` with a 3-second `setTimeout` that calls `showScreen('login')` if no session
- [x] T014 [US1] Wire the "Sign in with GitHub" button click in `extension/src/popup.ts` to call `launchOAuthFlow()`, then on success call `showScreen('main')` and render the tamagotchi animation
- [x] T015 [US1] Implement error handling in `extension/src/popup.ts` for `launchOAuthFlow()` failures — display the error message area within `#login-screen` and show a retry button that re-triggers the flow

**Checkpoint**: User Story 1 independently functional — first-time login flow works end-to-end.

---

## Phase 4: User Story 2 — OAuth Connection Status in Tamagotchi View (Priority: P2)

**Goal**: A persistent status badge in the tamagotchi view shows "● Connected" (green) or "● Disconnected" (grey) based on live auth state, and tapping the disconnected badge navigates to the login screen.

**Independent Test**: Open extension signed-in — badge shows connected. Sign out — badge shows disconnected. Click disconnected badge — login screen appears.

### Implementation for User Story 2

- [x] T016 [US2] Add a `<div id="connection-badge">` element inside the main tamagotchi container in `extension/popup.html` with two child spans: `.badge-connected` and `.badge-disconnected` (only one visible at a time)
- [x] T017 [US2] Add CSS to `extension/popup.html` for the connection badge: connected state uses `--glow` green, disconnected uses amber/grey; badge is positioned in the bottom bar alongside the existing status label; disconnected badge has `cursor:pointer`
- [x] T018 [US2] Implement `renderConnectionBadge(session: StoredAuthSession | null)` in `extension/src/popup.ts` — shows `.badge-connected` if session present, `.badge-disconnected` otherwise
- [x] T019 [US2] Call `renderConnectionBadge` on initial `main` screen render and subscribe via `onSessionChanged()` in `extension/src/popup.ts` so the badge updates reactively without a popup reload
- [x] T020 [US2] Attach a click handler to `.badge-disconnected` in `extension/src/popup.ts` that calls `showScreen('login')`
- [x] T021 [US2] Add a "Sign out" button (small, styled to match retro aesthetic) inside the main tamagotchi container in `extension/popup.html`, and wire its click handler in `extension/src/popup.ts` to call `signOut()` then `showScreen('intro')` (which restarts the 3-second timer → login)

**Checkpoint**: User Story 2 independently functional — connection badge visible and reactive; sign-out resets flow.

---

## Phase 5: User Story 3 — Returning User Session Persistence (Priority: P3)

**Goal**: Users with a valid persisted session skip intro and login entirely on every subsequent popup open, including after browser restarts.

**Independent Test**: Sign in, close and fully restart Chrome, reopen popup — tamagotchi view appears immediately with connected badge. No intro animation or login prompt shown.

### Implementation for User Story 3

- [x] T022 [US3] Verify the `DOMContentLoaded` path in `extension/src/popup.ts` (from T013) correctly handles the case where `getValidSession()` performs a token refresh before routing to `'main'` — add a brief loading state (e.g., show the tamagotchi container but defer animation until session resolves) to prevent a flash of the intro screen during refresh
- [x] T023 [US3] Add a `chrome.runtime.onStartup` listener in `extension/src/background.ts` that calls `getValidSession()` to proactively refresh an expiring token in the background on browser start, so the popup never has to wait for a refresh when opened
- [x] T024 [US3] Handle the recovery path in `extension/src/popup.ts`: if `getValidSession()` returns `null` on an open where the user expected to be logged in (token expired and refresh failed), route to `'intro'` screen (replaying the animation) and then `'login'`

**Checkpoint**: User Story 3 independently functional — returning users see instant tamagotchi view; expired sessions recover gracefully.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Build validation, CSP, and developer experience.

- [x] T025 [P] Review `extension/manifest.json` Content Security Policy: confirm `connect-src` allows requests to the Supabase project URL and `https://*.chromiumapp.org` (required for `chrome.identity` flow)
- [ ] T026 [P] Update `specs/006-oauth-extension-login/quickstart.md` with the actual `chrome.identity.getRedirectURL()` value from a test load of the extension (fills in the `<extension-id>` placeholder)
- [x] T027 Run `npm run build:extension` from repo root, load the built `extension/dist/` as an unpacked extension in Chrome, and validate the complete first-run and returning-user flows per `specs/006-oauth-extension-login/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T002 and T003 are parallel
- **Foundational (Phase 2)**: Depends on Phase 1 (manifest + auth.ts skeleton); T005 is parallel with T004 after T003; T006–T009 depend sequentially on earlier functions
- **User Story 1 (Phase 3)**: Depends on Phase 2 complete — T010 and T011 can be done alongside Phase 2 HTML work
- **User Story 2 (Phase 4)**: Depends on Phase 3 complete (needs `showScreen`, `main` screen, and `signOut()`)
- **User Story 3 (Phase 5)**: Depends on Phase 3 complete; T023 can be done alongside Phase 4
- **Polish (Phase 6)**: Depends on Phases 3–5 complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 completes — no dependency on US2 or US3
- **US2 (P2)**: Requires US1's `showScreen()` and main screen HTML to exist
- **US3 (P3)**: Requires US1's `DOMContentLoaded` routing and auth.ts `getValidSession()` to be in place

### Within Each User Story

- HTML structure tasks before JavaScript wiring tasks (popup.html edits before popup.ts edits)
- `auth.ts` functions before any popup.ts code that calls them
- Core happy-path before error/edge-case handling

### Parallel Opportunities

- T002 and T003 (Phase 1): parallel — different sections of same new file
- T004 and T005 (Phase 2): parallel — different functions, no interdependency
- T010 and T016 + T017 (HTML tasks across stories): can be pre-staged in parallel with Phase 2 as HTML doesn't depend on auth.ts logic

---

## Parallel Example: Phase 2 (Auth Module)

```
# Start simultaneously:
Task T004: Implement getSession() in extension/src/auth.ts
Task T005: Implement onSessionChanged() in extension/src/auth.ts

# After T004 completes, continue:
Task T006: Implement PKCE helpers in extension/src/auth.ts
# After T005 completes, it's already done (no dependencies on T006)

# After T006:
Task T007: Implement launchOAuthFlow() in extension/src/auth.ts

# After T007:
Task T008: Implement getValidSession() in extension/src/auth.ts

# After T008:
Task T009: Implement signOut() in extension/src/auth.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (manifest + auth.ts skeleton)
2. Complete Phase 2: Foundational (full auth.ts module)
3. Complete Phase 3: User Story 1 (intro → login → tamagotchi)
4. **STOP and VALIDATE**: Run the first-time login flow in Chrome — confirm OAuth completes and session is stored
5. Demo-ready: users can install and sign in

### Incremental Delivery

1. Setup + Foundational → `auth.ts` working, manifest ready
2. User Story 1 → first-run login flow works → **MVP**
3. User Story 2 → connection badge + sign-out in tamagotchi view
4. User Story 3 → returning-user fast path, background refresh
5. Polish → CSP, build validation, quickstart docs

---

## Notes

- [P] tasks = different files or independent functions, no blocking dependencies
- Each user story is independently completable: US1 delivers a working login flow, US2 delivers visible auth status, US3 delivers session persistence
- The `chrome.identity` redirect URL must be registered in Supabase before the OAuth flow will succeed (one-time setup in `quickstart.md`)
- `@supabase/supabase-js` is already in `package.json` and will be auto-bundled by esbuild when imported in `auth.ts` — no build script changes needed
- Commit after each phase checkpoint at minimum
