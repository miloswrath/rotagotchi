# Feature Specification: GitHub OAuth Backend Initialization

**Feature Branch**: `003-github-oauth-backend`
**Created**: 2026-03-11
**Status**: Draft
**Input**: User description: "Backend initialization for GitHub OAuth webhook: users sign in to GitHub with read access to all repos, extension creates webhook receiving diff size and date/time on push/PR events, tamagotchi logic assigned downstream."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GitHub Sign-In & Authorization (Priority: P1)

A new user opens the Rotagotchi extension and is prompted to sign in with their GitHub account. They authorize the extension to access all of their repositories. After successful sign-in, the system records their identity and prepares to monitor their coding activity.

**Why this priority**: All downstream functionality depends on the user being authenticated and their repositories being accessible. Without this, no coding activity can be tracked.

**Independent Test**: Can be fully tested by triggering the sign-in flow, completing authorization, and verifying the user's identity is stored and their repos are accessible — delivers a working auth layer that on its own has demonstrable value.

**Acceptance Scenarios**:

1. **Given** a user is not signed in, **When** they open the extension, **Then** they are presented with a "Sign in with GitHub" prompt
2. **Given** a user clicks "Sign in with GitHub", **When** they complete the GitHub authorization flow, **Then** the extension stores their identity and confirms read access to all repositories
3. **Given** a user has already signed in, **When** they open the extension again, **Then** they are not prompted to sign in again (session persists)
4. **Given** a user denies authorization, **When** the OAuth flow completes, **Then** the extension displays an informative error and prompts them to try again

---

### User Story 2 - Webhook Registration & Coding Event Ingestion (Priority: P2)

After the user has authorized the extension, the system automatically registers a webhook with GitHub that will notify Rotagotchi whenever the user pushes commits or opens a pull request on any of their repositories. The system receives, validates, and stores these events for downstream consumption.

**Why this priority**: This is the mechanism that captures all coding activity. Without webhook registration and event storage, no downstream tamagotchi logic can ever run.

**Independent Test**: Can be fully tested by triggering the webhook registration flow, simulating a push event, and confirming the system receives, validates, and persists the event record — delivers a verifiable data pipeline with demonstrable value independent of any downstream consumer.

**Acceptance Scenarios**:

1. **Given** a user has signed in, **When** authorization completes, **Then** a webhook is registered for all of the user's repositories (including future ones)
2. **Given** a registered webhook, **When** the user pushes commits to any repository, **Then** the system receives an event containing the diff size and the timestamp
3. **Given** a registered webhook, **When** the user opens or merges a pull request, **Then** the system receives an event with relevant size and timestamp information
4. **Given** a webhook event arrives, **When** the system processes it, **Then** it verifies the event is legitimately from GitHub before storing it
5. **Given** a verified webhook event, **When** the system stores it, **Then** the diff size and timestamp are persisted and available for downstream systems to query
6. **Given** a user signs out or revokes access, **When** the system detects this, **Then** the webhook is deregistered and no further events are accepted

---

### Edge Cases

- What happens when the user's GitHub token expires mid-session?
- How does the system handle webhook delivery failures or retries from GitHub (duplicate events)?
- What happens if the user has hundreds of repositories — does webhook registration succeed for all?
- How does the system behave if two pushes arrive within seconds of each other?
- What happens if the user revokes the GitHub OAuth grant from their GitHub settings directly?
- How does the system handle an event with a malformed or missing signature?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to authenticate using their GitHub account and grant read access to all repositories
- **FR-002**: System MUST persist the user's authenticated session so they do not need to sign in on every extension open
- **FR-003**: System MUST register a webhook with GitHub upon successful user authorization to receive push and pull request events across all user repositories
- **FR-004**: System MUST verify the authenticity of every incoming webhook event using a shared secret before processing it
- **FR-005**: System MUST extract the diff size and timestamp from each verified webhook event and persist them as a commit event record
- **FR-006**: System MUST deregister webhooks and invalidate user sessions when a user signs out or access is revoked
- **FR-007**: System MUST store user identity and commit event records in persistent storage accessible to downstream systems
- **FR-008**: System MUST handle duplicate webhook deliveries idempotently (same event processed twice must not create duplicate records)

### Key Entities

- **User**: A GitHub-authenticated individual; has an identity, OAuth token, and associated activity history
- **Commit Event**: A single push or pull request event received from GitHub; contains diff size, timestamp, and originating repository; consumed by downstream tamagotchi logic
- **Webhook Registration**: A record of the active GitHub webhook for a user; tracks registration status and the shared secret used for signature verification

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can complete the GitHub sign-in and authorization flow in under 2 minutes on first use
- **SC-002**: The system correctly stores at least 99% of delivered webhook events without data loss
- **SC-003**: Duplicate webhook deliveries never produce duplicate event records — idempotency holds in all tested scenarios
- **SC-004**: Users who sign out or revoke access have their webhooks cleaned up within 60 seconds
- **SC-005**: The system correctly rejects 100% of webhook events with invalid or missing signatures

## Assumptions

- GitHub's webhook infrastructure reliably retries failed deliveries; the system does not need to poll GitHub for missed events
- Repository access is granted broadly (all repos); per-repo granularity is not required
- The extension is a Chrome extension communicating with the backend over a standard web protocol
- Tamagotchi state updating and reward computation are handled by a separate downstream feature; this feature's responsibility ends at persisting validated commit event records
- The format for exposing stored commit events to downstream consumers (e.g., query API, pub/sub) is a planning-phase decision
