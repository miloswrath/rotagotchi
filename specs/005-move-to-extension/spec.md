# Feature Specification: Move Tamagotchi Logic to Browser Extension

**Feature Branch**: `005-move-to-extension`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "Move the current lottie animation logic and tamagotchi state to the browser extension, use the extension to return the currently active tab URL, determine if the URL is part of a whitelist, and change animations/state based on whitelist status"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pet Reacts to Current Tab (Priority: P1)

A user is browsing the web with the rotagotchi extension installed. As they switch between browser tabs, the tamagotchi pet automatically changes its animation and mood to reflect whether the currently active site is on their approved whitelist. When on a whitelisted site, the pet is happy and animated positively; when off-whitelist, the pet shows a negative or distressed state.

**Why this priority**: This is the core interactive experience of the feature — without tab-aware pet behavior, the extension provides no meaningful value over the existing web app.

**Independent Test**: Install the extension, navigate to a whitelisted URL, observe a positive pet animation, then navigate to a non-whitelisted URL and observe a negative/neutral pet animation. The entire flow is testable with no other stories implemented.

**Acceptance Scenarios**:

1. **Given** the extension is installed and a whitelist is configured, **When** the user navigates to a URL on the whitelist, **Then** the pet displays a happy/positive animation state.
2. **Given** the extension is installed and a whitelist is configured, **When** the user navigates to a URL not on the whitelist, **Then** the pet displays a distressed/unhappy animation state.
3. **Given** the extension is installed, **When** the user switches between tabs, **Then** the pet animation updates to reflect the whitelist status of the newly active tab within 1 second.

---

### User Story 2 - Pet Visible via Extension Popup (Priority: P2)

A user clicks the extension icon in their browser toolbar to view their tamagotchi pet. The pet is rendered with full lottie animations inside the extension popup, replacing the need to visit a separate web page for the pet view.

**Why this priority**: Moving the animation to the extension popup is the foundational migration work. It enables the tab-awareness behavior in Story 1.

**Independent Test**: Click the extension icon and observe the lottie-animated pet rendered correctly in the popup. Testable without whitelist logic by verifying animation renders in the popup shell.

**Acceptance Scenarios**:

1. **Given** the extension is installed, **When** the user clicks the extension toolbar icon, **Then** a popup opens displaying the animated tamagotchi pet.
2. **Given** the popup is open, **When** the pet animation plays, **Then** the animation is smooth and visually consistent with the previous web app rendering.
3. **Given** the popup is open, **When** the user closes it and reopens it, **Then** the pet state is preserved (not reset to default).

---

### User Story 3 - Whitelist Configuration (Priority: P3)

A user can view and manage their whitelist of approved URLs or domains directly within the extension. They can add or remove entries so the pet accurately reflects which sites they consider productive or allowed.

**Why this priority**: Without configurable whitelist management, users are locked into whatever defaults exist. However, basic behavior still works with a pre-configured or hardcoded whitelist, making this lower priority than core behavior.

**Independent Test**: Open the extension settings or options page, add a new domain to the whitelist, navigate to that domain, and confirm the pet switches to a happy state.

**Acceptance Scenarios**:

1. **Given** the extension options are open, **When** the user adds a new URL or domain to the whitelist, **Then** the entry appears in the list and is immediately active.
2. **Given** the user has a whitelist entry, **When** they remove it, **Then** navigating to that URL now triggers the off-whitelist pet state.
3. **Given** an empty whitelist, **When** the user browses any site, **Then** the pet displays a neutral or default state (not erroring).

---

### Edge Cases

- What happens when the active tab is a browser built-in page (e.g., new tab page, settings, extensions page)?
- How does the pet behave when the browser has no active tab or focus moves to a non-web window?
- What happens if the whitelist contains a domain and the user visits a subdomain — does it match?
- How does the system handle rapid tab switching (multiple tabs switched within milliseconds)?
- What state does the pet show when the extension is first installed with no whitelist configured?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The tamagotchi pet animation MUST be rendered inside the browser extension popup.
- **FR-002**: The extension MUST read the URL of the currently active browser tab in real time.
- **FR-003**: The extension MUST compare the active tab's URL against the user's configured whitelist to determine whitelist status.
- **FR-004**: The pet's animation and mood state MUST change to a positive/happy state when the active tab URL matches the whitelist.
- **FR-005**: The pet's animation and mood state MUST change to a negative/unhappy state when the active tab URL does not match the whitelist.
- **FR-006**: The pet state MUST update automatically when the user switches active tabs, without requiring a manual refresh.
- **FR-007**: Users MUST be able to add URLs or domains to their whitelist through the extension.
- **FR-008**: Users MUST be able to remove entries from the whitelist through the extension.
- **FR-009**: The whitelist configuration MUST persist across browser sessions.
- **FR-010**: Browser-internal pages (new tab, settings, etc.) MUST trigger a neutral or gracefully handled pet state rather than an error.

### Key Entities

- **Whitelist Entry**: A URL or domain pattern the user designates as approved; determines pet happiness when matched against the active tab.
- **Tab URL**: The currently active browser tab's URL; evaluated against the whitelist on every tab switch or navigation event.
- **Pet State**: The current mood/animation mode of the tamagotchi (e.g., happy, unhappy, neutral); driven by whitelist match result.
- **Lottie Animation**: The visual representation of the pet mapped to a given pet state and played in the extension popup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The pet animation and state update to reflect whitelist status within 1 second of the user switching to a new tab.
- **SC-002**: All user-configured whitelist entries are evaluated correctly against active tab URLs with no false positives or false negatives.
- **SC-003**: The pet animation renders in the extension popup without visual artifacts or missing frames compared to the previous web app rendering.
- **SC-004**: Whitelist configuration changes take effect immediately (within 1 second) without requiring a browser restart or extension reload.
- **SC-005**: The extension handles all edge-case tab types (internal pages, empty tabs) without crashing or displaying an error state to the user.

## Assumptions

- The existing lottie animations and associated pet state logic are already implemented and can be migrated to the extension context without redesign.
- The extension targets browsers supporting the standard WebExtensions API (Chrome and/or Firefox).
- Whitelist matching is domain-level by default (e.g., "github.com" matches all pages on that domain).
- The extension popup is the primary UI surface — no persistent sidebar or overlay is required.
- Browser-internal pages trigger a neutral state, not an unhappy state, since they do not represent off-task browsing.
- The whitelist is stored locally within the extension (not synced to a remote server) unless otherwise specified.
