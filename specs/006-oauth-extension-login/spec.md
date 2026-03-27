# Feature Specification: OAuth Login in Chrome Extension

**Feature Branch**: `006-oauth-extension-login`
**Created**: 2026-03-27
**Status**: Draft
**Input**: User description: "implement the same oAuth login workflow on the main page in the extension; add UI elements to the tomogatchi view to know if you are connected via oAuth; extension should start as the tomogatchi briefly on installation, then after a few seconds of being open, it should prompt for oauth login workflow"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-Time Extension Login Prompt (Priority: P1)

A user installs Rotagotchi and opens the extension for the first time. They are greeted with a brief tamagotchi animation, then after a few seconds the extension smoothly transitions to a GitHub OAuth login prompt. The user completes the authorization flow and is returned to the tamagotchi view, now connected to their GitHub account.

**Why this priority**: Without authentication, the extension cannot track coding activity or update the tamagotchi's state. The first-run login flow is the gateway to all other functionality — every user must pass through it.

**Independent Test**: Can be fully tested by installing the extension, opening the popup, observing the tamagotchi intro animation, waiting for the login prompt to appear, completing OAuth authorization, and confirming the extension returns to the tamagotchi view in a connected state — delivers a fully working authentication entry point.

**Acceptance Scenarios**:

1. **Given** the extension is freshly installed and the user has never logged in, **When** they open the extension popup, **Then** the tamagotchi animation is displayed for a brief period (approximately 3 seconds)
2. **Given** the tamagotchi intro has completed, **When** the timer elapses, **Then** the extension automatically transitions to the OAuth login prompt without requiring user action
3. **Given** the OAuth login prompt is shown, **When** the user clicks "Sign in with GitHub", **Then** the GitHub authorization flow is initiated
4. **Given** the user completes GitHub authorization, **When** the flow redirects back to the extension, **Then** the tamagotchi view is shown and the connected state is indicated in the UI
5. **Given** the user cancels or denies the OAuth flow, **When** the flow returns to the extension, **Then** a friendly error message is shown and the user can retry

---

### User Story 2 - OAuth Connection Status in Tamagotchi View (Priority: P2)

A returning user opens the extension and can immediately see, within the tamagotchi view itself, whether their GitHub account is connected. If connected, the status is clearly indicated; if not, a visual prompt or indicator nudges them toward signing in.

**Why this priority**: Users need to know at a glance whether their coding activity is being tracked. Without a visible connection indicator, users cannot diagnose missing data or understand the extension's state.

**Independent Test**: Can be fully tested by opening the extension in both a logged-in and logged-out state, confirming that the UI displays a distinct connected/disconnected indicator in the tamagotchi view each time — delivers immediately useful ambient feedback independent of the login flow.

**Acceptance Scenarios**:

1. **Given** the user is signed in with GitHub, **When** the tamagotchi view is displayed, **Then** a connected-state indicator (e.g., icon, badge, or label) is visible within the tamagotchi view
2. **Given** the user is not signed in, **When** the tamagotchi view is displayed, **Then** a disconnected-state indicator is visible and prompts the user to connect
3. **Given** the user's session expires or is revoked, **When** they next open the extension, **Then** the UI reflects the disconnected state and invites them to log in again

---

### User Story 3 - Returning User Session Persistence (Priority: P3)

A user who has previously signed in opens the extension and is taken directly to the tamagotchi view without being shown the intro animation or login prompt again. Their session is remembered across extension restarts and browser sessions.

**Why this priority**: Re-authenticating on every open would be disruptive. Persistent sessions ensure the extension is usable daily without friction.

**Independent Test**: Can be fully tested by signing in, closing and reopening the extension (and restarting the browser), and confirming the tamagotchi view loads immediately with the connected state — no intro animation or login prompt required.

**Acceptance Scenarios**:

1. **Given** a user has signed in previously, **When** they reopen the extension, **Then** the tamagotchi view is shown immediately with the connected indicator — no intro animation or login prompt
2. **Given** the browser is restarted, **When** the user opens the extension, **Then** the session is still active and the connected state is reflected
3. **Given** the user explicitly signs out from within the extension, **When** they next open the extension, **Then** the intro animation plays and the login prompt appears

---

### Edge Cases

- What happens if the OAuth flow is interrupted mid-way (e.g., tab is closed before completing)?
- What happens if the user has already signed in on the main Rotagotchi website — does the extension recognize that session?
- What if the network is unavailable when the login prompt appears?
- What happens if the user opens two extension popups simultaneously during the auth flow?
- How does the extension behave if the GitHub OAuth token is valid but the backend is unreachable?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Extension MUST display the tamagotchi animation for approximately 3 seconds when opened for the first time (no prior login session present)
- **FR-002**: Extension MUST automatically transition from the tamagotchi intro to the OAuth login prompt after the intro period elapses, without requiring user interaction
- **FR-003**: Extension MUST provide a "Sign in with GitHub" action that initiates the same GitHub OAuth authorization flow used on the main Rotagotchi web page
- **FR-004**: Extension MUST return the user to the tamagotchi view upon successful OAuth authorization
- **FR-005**: Extension MUST display a visible connection-status indicator within the tamagotchi view that clearly distinguishes between connected (authenticated) and disconnected (unauthenticated) states
- **FR-006**: Extension MUST persist the user's authentication session across popup closes and browser restarts, so returning users are not prompted to log in again
- **FR-007**: Extension MUST skip the intro animation and login prompt for users with a valid, persisted session and display the tamagotchi view directly
- **FR-008**: Extension MUST display an informative message and a retry action when the OAuth flow fails or is cancelled by the user
- **FR-009**: Extension MUST revert to the login prompt (and replay the intro animation) when the user explicitly signs out or when their session is detected as expired or revoked

### Key Entities

- **Session**: Represents the user's authenticated state within the extension; has a valid/expired/absent status and is persisted across restarts
- **Connection Status**: The user-visible representation of whether the extension is linked to a GitHub account; displayed as a UI element within the tamagotchi view
- **OAuth Flow**: The sequence of steps by which the user grants the extension access to their GitHub account; mirrors the flow already implemented on the main web page

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can complete the full install-to-authenticated flow in under 2 minutes
- **SC-002**: The tamagotchi intro displays for no less than 2 seconds and no more than 5 seconds before the login prompt appears
- **SC-003**: 100% of returning users with a valid session are taken directly to the tamagotchi view without being shown the login prompt
- **SC-004**: The connection status indicator is visible in the tamagotchi view within 500ms of the popup opening
- **SC-005**: Users who cancel or fail the OAuth flow are presented with a retry path — no dead-end states exist

## Assumptions

- The GitHub OAuth flow in the extension reuses or closely mirrors the existing flow on the main Rotagotchi web page; backend endpoints are already in place or require only minimal additions
- "A few seconds" in the feature description is interpreted as approximately 3 seconds for the tamagotchi intro before the login prompt appears
- Session persistence uses the extension's available persistent storage; sessions survive browser restarts
- The connection-status indicator is a lightweight addition (badge, icon, or label) and does not obscure or replace the tamagotchi animation itself
- Users will not be required to re-authenticate solely because the extension was updated
- Sign-out functionality is in scope for this feature, as it is required to support session expiry and the returning-user reset scenario
