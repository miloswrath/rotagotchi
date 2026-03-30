# Feature Specification: Extension Game Logic

**Feature Branch**: `007-extension-game-logic`
**Created**: 2026-03-27
**Status**: Draft
**Input**: User description: "Extension game logic for Chrome extension tamagotchi — read from Supabase for current user's most recent commit with diff size, calculate debt and submit notification for user to watch degenerative content, health boost/drain system, blacklist-based health reduction, animations based on state, death with restart, tick speed slider, popup status messages, hunger/satiated notifications"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Commit Triggers Health Debt Notification (Priority: P1)

After a user pushes a commit, the extension automatically detects it and calculates a "health debt" based on the commit's diff size. A notification appears prompting the user to watch degenerative content to pay off the debt.

**Why this priority**: This is the core game loop — without it, none of the other mechanics have meaning. Everything else builds on this trigger.

**Independent Test**: Can be fully tested by simulating a new commit event and verifying a notification appears with an appropriate message. Delivers the foundational game interaction.

**Acceptance Scenarios**:

1. **Given** a user is authenticated and a new commit event arrives, **When** the commit diff size is calculated, **Then** a desktop notification appears prompting the user to watch degenerative content
2. **Given** a notification appears, **When** the user ignores it, **Then** the tamagotchi's health begins decreasing gradually
3. **Given** a notification appears, **When** the user immediately watches degenerative content, **Then** the tamagotchi receives a large health boost

---

### User Story 2 - Health Drain and Blacklist Enforcement (Priority: P2)

While health debt is outstanding, visiting work-related sites (on the blacklist) accelerates health drain. The tamagotchi visually reflects its deteriorating state, motivating the user to watch degenerative content.

**Why this priority**: This creates the negative consequence loop that gives the notification mechanic weight and drives behavior change.

**Independent Test**: Can be tested by setting an active health debt, visiting a blacklisted work site, and verifying the health decreases faster than baseline drain.

**Acceptance Scenarios**:

1. **Given** health debt is active and the user visits a blacklisted site, **When** each tick occurs, **Then** health decreases at an accelerated rate compared to standard drain
2. **Given** health is draining, **When** the health reaches critical levels, **Then** the tamagotchi's animation reflects a distressed or unhealthy state
3. **Given** health reaches zero, **When** the death state triggers, **Then** a death animation plays and a restart button appears

---

### User Story 3 - Degenerative Content Watching Restores Health (Priority: P2)

When a user visits a site not on the blacklist (i.e., degenerative/non-work content), the health debt is resolved and the tamagotchi recovers, with animations reflecting a happy/healthy state.

**Why this priority**: Completes the reward loop. Without a clear "win" condition, the game has no satisfying resolution.

**Independent Test**: Can be tested by having an active health debt, navigating to a non-blacklisted site, and verifying health increases and the character animation changes to a positive state.

**Acceptance Scenarios**:

1. **Given** health debt is active, **When** the user navigates to a non-blacklisted site, **Then** health debt is cleared and health begins recovering
2. **Given** health is restored, **When** the user opens the extension popup, **Then** the tamagotchi displays a happy/satiated animation
3. **Given** the tamagotchi becomes satiated, **When** the state changes, **Then** a satiated notification is shown

---

### User Story 4 - Status Visibility in Extension Popup (Priority: P3)

The extension popup clearly displays the tamagotchi's current health, hunger state, and any active debt, so the user always knows their virtual pet's condition at a glance.

**Why this priority**: Without visible status, users cannot act on the game state. This is UI-critical but depends on the logic being in place.

**Independent Test**: Can be tested by opening the popup in each possible game state and verifying health bar, hunger indicator, and status message are all visible and accurate.

**Acceptance Scenarios**:

1. **Given** the extension popup is open, **When** any game state, **Then** current health value/bar is clearly visible
2. **Given** the tamagotchi is hungry (health debt active), **When** the popup is open, **Then** a hunger indicator is prominently displayed
3. **Given** the tamagotchi is healthy and fed, **When** the popup is open, **Then** a satiated/happy indicator is shown

---

### User Story 5 - Popup Character Speech (Priority: P3)

The tamagotchi character displays speech bubble messages in the popup that describe its current mood, hunger, or reaction to the user's browsing behavior.

**Why this priority**: Adds personality and feedback clarity; enhances engagement but is non-critical to core loop.

**Independent Test**: Can be tested by cycling through game states and verifying the character displays contextually appropriate speech bubble messages.

**Acceptance Scenarios**:

1. **Given** the character is hungry, **When** the popup is opened, **Then** the character displays a message expressing hunger or displeasure
2. **Given** the character is healthy, **When** the popup is opened, **Then** the character displays a happy or content message
3. **Given** the character has just died, **When** the popup is opened, **Then** the character's death state is reflected in the displayed message

---

### User Story 6 - Tick Speed Slider for Demo (Priority: P3)

A settings menu within the extension contains a tick speed slider that allows users (and demo presenters) to accelerate game time, enabling all mechanics to be demonstrated in seconds rather than hours.

**Why this priority**: Required for demos and testing; does not affect production gameplay integrity.

**Independent Test**: Can be tested by adjusting the slider to maximum speed and verifying health drain/gain rates visibly accelerate.

**Acceptance Scenarios**:

1. **Given** the settings menu is open, **When** the tick speed slider is adjusted, **Then** the rate of all game ticks (drain, recovery) changes proportionally
2. **Given** tick speed is at maximum, **When** a health debt exists, **Then** the tamagotchi's health visibly reaches zero in a short, demonstrable time
3. **Given** tick speed is returned to default, **When** normal gameplay resumes, **Then** rates revert to standard pacing

---

### Edge Cases

- What happens when a commit event arrives while health debt is already outstanding?
- How does the system handle the tamagotchi being in a dead state when a new commit event arrives?
- What if the user has no commits yet — is there an initial "healthy" state shown?
- What happens when the user dismisses a notification without acting on it?
- How does the system behave if the data store is unreachable (no commit data available)?
- What if the user clears extension storage — does the tamagotchi reset to full health or to last known state?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST automatically read the current user's most recent commit (including diff size) from the data store whenever a new commit event is received
- **FR-002**: The extension MUST calculate a health debt value based on the commit diff size
- **FR-003**: The extension MUST display a desktop notification when a new health debt is created, prompting the user to watch degenerative content
- **FR-004**: If the user watches degenerative content immediately after a notification, the tamagotchi MUST receive a large health boost
- **FR-005**: If the user does not respond to the notification, the tamagotchi's health MUST decrease gradually over time via a tick-based system
- **FR-006**: If the user continues to engage in work (visiting blacklisted sites) while health debt is active, health MUST decrease at an accelerated rate
- **FR-007**: The extension MUST check the user's current website against the blacklist on each navigation event
- **FR-008**: When the tamagotchi's health reaches zero, a death state MUST be triggered showing a death animation and a restart button
- **FR-009**: Clicking the restart button MUST reset the tamagotchi to its initial healthy state and resume the normal game loop
- **FR-010**: The extension popup MUST display the tamagotchi's current health value or bar prominently
- **FR-011**: The extension popup MUST display a clear hunger indicator when health debt is active
- **FR-012**: The extension popup MUST display a satiated indicator when the tamagotchi is healthy and fed
- **FR-013**: The tamagotchi animation MUST update to reflect the current game state (healthy, hungry, distressed, dead)
- **FR-014**: The tamagotchi character MUST display popup speech bubble messages that reflect its current state (hungry, happy, dying, etc.)
- **FR-015**: A settings menu MUST include a tick speed slider that adjusts the rate of all game ticks for demo purposes
- **FR-016**: The extension MUST send a hunger notification when the tamagotchi becomes hungry (health debt created)
- **FR-017**: The extension MUST send a satiated notification when health debt is resolved

### Key Entities

- **Commit Event**: A record of a user's code commit including diff size (lines added/removed); triggers health debt calculation
- **Health Debt**: A calculated value derived from commit diff size representing how much degenerative content the user must watch
- **Tamagotchi State**: The current snapshot of the virtual pet including health value, hunger status, and alive/dead status
- **Game Tick**: A recurring time interval that drives health drain, recovery, and state evaluation
- **Blacklist**: A user-configurable list of website domains associated with work activity
- **Tick Speed**: A multiplier that controls how fast game ticks occur, adjustable via settings slider

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A desktop notification appears within 5 seconds of a new commit event being received
- **SC-002**: The tamagotchi's health visibly changes (drain or boost) within one tick of the triggering condition (blacklist visit, content watch)
- **SC-003**: At maximum tick speed, the tamagotchi can go from full health to death in under 30 seconds, enabling full demo of all mechanics
- **SC-004**: All game states (healthy, hungry, distressed, dead) are visually distinct and identifiable by a new user without instruction
- **SC-005**: The popup status (health, hunger, speech bubble) accurately reflects the live game state every time the popup is opened
- **SC-006**: 100% of commit events received while the extension is active result in either a notification or an auditable log entry explaining why no notification was sent
- **SC-007**: The restart button successfully returns the tamagotchi to its initial healthy state and resumes the normal game loop within one tick

## Assumptions

- Health debt amount scales linearly with diff size; the exact formula (e.g., 1 point per N lines changed) will be determined during planning
- "Degenerative content" is defined as any site not on the blacklist; a curated allow-list approach is not assumed
- The blacklist used in this feature is the same blacklist already implemented in prior extension features
- A new commit while debt is outstanding adds to the existing debt rather than replacing it
- The tick interval at default speed is on the order of minutes; exact value to be confirmed during planning
- Desktop notifications use the browser's native notification API and do not require a separate notification service
- The settings menu is a small overlay or panel accessible from within the extension popup, not a separate options page
