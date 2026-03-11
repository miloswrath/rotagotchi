# Tasks: GitHub OAuth Backend Initialization

**Input**: Design documents from `/specs/003-github-oauth-backend/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, create skeleton directories, and document environment variables before any implementation begins.

- [x] T001 Install `@supabase/ssr` and `@supabase/supabase-js` dependencies in `package.json`
- [x] T002 [P] Create `.env.local.example` documenting all required environment variables per `contracts/github-auth.md` and `contracts/webhook-receiver.md` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`)
- [x] T003 [P] Create `supabase/migrations/` directory and `lib/github/` directory in repo root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Supabase clients and all four database migrations must be ready before any user story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Create `lib/supabase/server.ts` — server-side Supabase client initialized with `SUPABASE_SERVICE_ROLE_KEY` for use in route handlers (bypasses RLS)
- [x] T005 [P] Create `lib/supabase/client.ts` — browser-side Supabase client initialized with `NEXT_PUBLIC_SUPABASE_ANON_KEY` for use in client components
- [x] T006 Write `supabase/migrations/001_user_github_tokens.sql` — create `user_github_tokens` table (columns: `user_id`, `access_token`, `refresh_token`, `access_token_expires_at`, `refresh_token_expires_at`, `updated_at`), FK to `auth.users` ON DELETE CASCADE, enable RLS, add policy for SELECT/INSERT/UPDATE/DELETE where `user_id = auth.uid()`
- [x] T007 [P] Write `supabase/migrations/002_webhook_installations.sql` — create `webhook_installations` table (columns: `id`, `user_id`, `installation_id` BIGINT UNIQUE, `account_login`, `account_type`, `access_all_repos`, `installed_at`, `suspended_at`), FK to `auth.users` ON DELETE CASCADE, enable RLS, add user-scoped policy
- [x] T008 [P] Write `supabase/migrations/003_webhook_events.sql` — create `webhook_events` table (columns: `delivery_id` UUID PRIMARY KEY, `installation_id` BIGINT, `event_type` TEXT, `action` TEXT, `received_at` TIMESTAMPTZ DEFAULT now(), `payload` JSONB, `processed` BOOLEAN DEFAULT false), FK `installation_id` to `webhook_installations`, enable RLS, INSERT for service role only, SELECT for owner via installation join
- [x] T009 [P] Write `supabase/migrations/004_commit_events.sql` — create `commit_events` table (columns: `id`, `delivery_id` UUID UNIQUE FK to `webhook_events`, `user_id` FK to `auth.users`, `repo_full_name`, `commit_sha`, `branch`, `diff_size` INT CHECK >= 0, `lines_added` INT, `lines_deleted` INT, `event_type`, `occurred_at`, `created_at`), with comment documenting `diff_size = lines_added + lines_deleted` per constitution, enable RLS, INSERT for service role only, SELECT for owner
- [ ] T010 Apply all migrations via Supabase CLI (`supabase db push`) or Supabase dashboard SQL editor; verify all four tables exist with correct columns, constraints, and RLS policies enabled; configure GitHub OAuth provider in Supabase Auth dashboard (Client ID, Client Secret, Callback URL)

**Checkpoint**: Supabase clients ready, all four tables exist with RLS — user story implementation can now begin.

---

## Phase 3: User Story 1 — GitHub Sign-In & Authorization (Priority: P1) 🎯 MVP

**Goal**: Users can sign in with GitHub, the backend stores their GitHub tokens and session, and the extension does not prompt for sign-in again on subsequent opens.

**Independent Test**: Trigger the sign-in flow in the browser, complete GitHub authorization, confirm redirect to `?auth=success`, verify a row exists in `user_github_tokens` for the authenticated user, open the app again and confirm no sign-in prompt appears.

- [x] T011 [US1] Implement GitHub token management helpers in `lib/github/auth.ts`: `storeGitHubTokens(userId, accessToken, refreshToken, expiresAt)` upserts to `user_github_tokens`; `refreshGitHubTokenIfNeeded(userId)` checks expiry and calls GitHub refresh endpoint when within 60 minutes; `getValidGitHubToken(userId)` returns a current access token, triggering refresh if needed
- [x] T012 [US1] Implement OAuth callback route handler in `app/api/auth/callback/route.ts`: call `supabase.auth.exchangeCodeForSession(code)`, extract `provider_token` and `provider_refresh_token` from session, call `storeGitHubTokens`, check `webhook_installations` for a row with this user — if none found redirect to GitHub App install URL, otherwise redirect to extension popup with `?auth=success`
- [x] T013 [P] [US1] Add "Sign in with GitHub" button to `app/page.tsx` that initiates the Supabase Auth GitHub OAuth flow; add auth state check so authenticated users see a confirmation state instead of the sign-in prompt
- [x] T014 [P] [US1] Write integration test for auth callback in `tests/integration/github-auth.spec.ts`: mock Supabase `exchangeCodeForSession` returning a session with provider tokens; assert `user_github_tokens` upsert is called with correct fields; assert redirect to `?auth=success` on success; assert redirect to install URL when no installation exists; assert error redirect when code exchange fails

**Checkpoint**: User Story 1 complete — sign-in works, tokens are stored, session persists.

---

## Phase 4: User Story 2 — Webhook Registration & Coding Event Ingestion (Priority: P2)

**Goal**: A registered GitHub App installation automatically delivers push and pull request events to the backend; the backend verifies, stores, and normalizes them into `commit_events` records available for downstream systems.

**Independent Test**: Install the GitHub App on a test account with "all repositories" access; push a commit to any repo; verify a row appears in `webhook_events` with `processed = true` and a corresponding row in `commit_events` with correct `diff_size = lines_added + lines_deleted`; verify that pushing the same delivery UUID a second time does not create a duplicate row.

- [x] T015 [US2] Implement HMAC-SHA256 signature verification helper in `lib/github/webhook.ts`: `verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean` — compute `sha256=` + `HMAC-SHA256(rawBody, secret)` and compare with `crypto.timingSafeEqual`; function must accept raw string body (not parsed JSON)
- [x] T016 [P] [US2] Write unit tests for signature verification in `tests/unit/webhook-signature.spec.ts`: test valid signature returns true; test tampered body returns false; test wrong secret returns false; test missing/malformed `sha256=` prefix returns false; test empty body with valid signature returns true
- [x] T017 [US2] Implement webhook receiver route handler in `app/api/webhooks/github/route.ts`: read raw body via `await request.text()`; verify `X-Hub-Signature-256` using `verifyWebhookSignature` — return 403 on failure; extract `X-GitHub-Delivery` UUID; attempt `INSERT INTO webhook_events ... ON CONFLICT (delivery_id) DO NOTHING`; if 0 rows inserted return 200 immediately; if 1 row inserted enqueue async event processing for `push` and `pull_request` event types; always return 200 for valid requests
- [x] T018 [US2] Implement event processor function in `lib/github/webhook.ts`: `processWebhookEvent(deliveryId, eventType, payload)` — for `push` events: extract `repository.full_name`, `head_commit.id`, `ref`, aggregate `additions + deletions` across all commits as `diff_size`; for `pull_request` events: extract `pull_request.additions`, `pull_request.deletions`, `pull_request.head.sha`, `pull_request.base.ref`; insert row into `commit_events`; set `webhook_events.processed = true`
- [x] T019 [P] [US2] Write integration test for webhook receiver in `tests/integration/webhook-receiver.spec.ts`: test valid push event stores row in `webhook_events` and returns 200; test invalid signature returns 403; test duplicate delivery UUID returns 200 without creating duplicate row; test missing `X-GitHub-Delivery` header returns 400; test `installation` event type is stored but not processed into `commit_events`
- [x] T020 [P] [US2] Implement GitHub App installation event handling in `app/api/webhooks/github/route.ts`: for `installation` event type with `action = "created"` upsert a row in `webhook_installations`; for `action = "deleted"` delete the matching row; for `action = "suspend"` / `"unsuspend"` update `suspended_at`
- [x] T021 [US2] Implement sign-out route in `app/api/auth/signout/route.ts`: call `supabase.auth.signOut()`, delete the user's row from `user_github_tokens`; return redirect to sign-in page with `?auth=signed_out`

**Checkpoint**: User Story 2 complete — webhook events are verified, stored idempotently, and normalized into `commit_events`.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the feature is complete, observable, and validated end-to-end.

- [x] T022 [P] Add error logging to `app/api/webhooks/github/route.ts` and `app/api/auth/callback/route.ts` — log event type, delivery ID, and error message on any 4xx/5xx response path (no payload contents logged per constitution monitoring scope policy)
- [x] T023 [P] Verify `.env.local.example` is complete and matches all variables referenced across `lib/github/auth.ts`, `lib/github/webhook.ts`, `lib/supabase/server.ts`, and both route handlers
- [x] T024 Run `npm test && npm run lint` and fix all failing tests and lint errors
- [ ] T025 Follow `quickstart.md` end-to-end in local dev environment using a smee.io tunnel: verify sign-in flow, webhook receipt, and a row appearing in `commit_events` after a real git push

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T001 (dependencies installed) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 checkpoint — specifically T004, T006, T010
- **User Story 2 (Phase 4)**: Depends on Phase 2 checkpoint — all four tables must exist; T021 depends on T011 from US1
- **Polish (Phase 5)**: Depends on all user story phases being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Phase 2 — no dependency on US2
- **User Story 2 (P2)**: Starts after Phase 2 — T021 (sign-out) re-uses `lib/github/auth.ts` from US1 (T011), so T011 should complete before T021

### Within Each User Story

- Models/helpers before route handlers
- Route handlers before integration tests
- Unit tests (T016) can be written before or alongside T015 implementation
- Core implementation (T015, T017, T018) must complete before T019 integration test is meaningful

---

## Parallel Example: User Story 2

```
# Launch simultaneously (different files, no dependencies):
Task T015: lib/github/webhook.ts (HMAC helper)
Task T016: tests/unit/webhook-signature.spec.ts (unit tests for T015)
Task T020: webhook receiver installation event handling (separate code path in route.ts)

# After T015 completes:
Task T017: app/api/webhooks/github/route.ts (depends on T015)

# After T017 completes:
Task T018: lib/github/webhook.ts processWebhookEvent (depends on T017 for context)
Task T019: tests/integration/webhook-receiver.spec.ts (depends on T017)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T010) — CRITICAL
3. Complete Phase 3: User Story 1 (T011–T014)
4. **STOP and VALIDATE**: Run the quickstart.md auth steps; confirm token storage works
5. Deploy to Railway if validated

### Incremental Delivery

1. Setup + Foundational → Database and Supabase clients ready
2. User Story 1 → Sign-in works → Demo/validate
3. User Story 2 → Webhook pipeline works → Confirm `commit_events` rows appear after a real push
4. Polish → Logging, lint, end-to-end validation

---

## Notes

- `delivery_id` PRIMARY KEY on `webhook_events` is the single most important idempotency mechanism — never weaken this constraint
- Always use `request.text()` before any JSON parsing in the webhook receiver — parsing first invalidates the HMAC signature
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser client; only used in server-side route handlers
- The `diff_size = lines_added + lines_deleted` definition in `commit_events` is constitutionally mandated — do not change without a constitutional amendment
- Commit after each task or logical group; each phase checkpoint is a valid stopping point for review
