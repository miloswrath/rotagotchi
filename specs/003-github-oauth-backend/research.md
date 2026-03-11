# Research: GitHub OAuth Backend Initialization

**Date**: 2026-03-11
**Feature**: 003-github-oauth-backend

---

## Decision 1: GitHub App vs. GitHub OAuth App

**Decision**: Use a **GitHub App** (not an OAuth App).

**Rationale**:
- GitHub Apps get a **single, centralized webhook endpoint** configured once at the app level. Events from every installation automatically flow to one URL — no per-repo webhook registration needed.
- GitHub Apps request **read-only permissions** (`Contents`, `Metadata`), eliminating the broad write access that the OAuth App `repo` scope forces.
- GitHub App user-to-server tokens **expire in 8 hours** and come with a refresh token (6-month lifetime). This is the secure default and aligns with modern auth practice.
- GitHub Apps can generate **installation access tokens** for server-side operations (listing repos, verifying installs), which are decoupled from any user session.

**Alternatives considered**:
- OAuth App: Rejected because it requires manually registering webhooks on each individual repo and grants unnecessarily broad write access via the `repo` scope.

---

## Decision 2: Webhook Registration Scope

**Decision**: Register a single GitHub App installation per user covering **all repositories** they authorize. Accept that repos in orgs the user does not administrate require a separate org-level installation.

**Rationale**:
- A GitHub App installation with "all repositories" scope on a user account is the only mechanism that covers every personal repo in a single webhook stream. There is no workaround for repos the user does not control.
- Org webhook API endpoints require org admin rights and are not feasible to register programmatically for arbitrary users.
- The onboarding flow should clearly surface this limitation — users who want org repos covered must install the app on each org separately.

**Alternatives considered**:
- Per-repo OAuth App webhook registration: Rejected due to maintenance burden (webhook inventory as repos are created/deleted) and overly broad token scope.

---

## Decision 3: HMAC Signature Verification

**Decision**: Verify every inbound webhook against `X-Hub-Signature-256` using **`crypto.timingSafeEqual`** on the raw request body before any parsing.

**Rationale**:
- The raw, unparsed body must be captured (via `request.text()`) before any JSON parsing occurs — body parsers that normalize whitespace will invalidate the signature.
- Standard string comparison (`===`) is vulnerable to timing attacks. `timingSafeEqual` is mandatory.
- Verification flow: compute `HMAC-SHA256(raw_body, webhook_secret)`, prepend `sha256=`, compare with `X-Hub-Signature-256` header using constant-time comparison. Return 403 on mismatch.

**Alternatives considered**:
- Parsing body before verification: Rejected (invalidates signature for any non-trivially formatted payload).

---

## Decision 4: Supabase Auth + GitHub Token Storage

**Decision**: Use **Supabase Auth** for session management and user identity. Store GitHub App `provider_token` and `provider_refresh_token` **manually in a dedicated `user_github_tokens` table** after sign-in.

**Rationale**:
- Supabase Auth handles GitHub OAuth redirect flow, session issuance (Supabase JWT), and user record creation in `auth.users` out of the box.
- **Critical limitation**: Supabase does not persistently store `provider_token` or `provider_refresh_token`. They are returned once in the sign-in callback only. They must be captured immediately and stored in application tables with Row Level Security.
- The Supabase session refresh lifecycle is entirely independent of the GitHub token lifecycle — these must not be conflated.
- When GitHub App tokens expire (8h), the backend is responsible for refreshing them using the stored `provider_refresh_token`.

**Alternatives considered**:
- Relying solely on Supabase to manage provider tokens: Rejected — this is a documented long-standing limitation with no native fix planned.
- Custom auth from scratch: Rejected — Supabase Auth handles the complex parts (PKCE, session cookies, RLS) correctly.

---

## Decision 5: Webhook Event Idempotency

**Decision**: Use the **`X-GitHub-Delivery` UUID header** as a unique constraint (`delivery_id`) on a `webhook_events` table. Use `INSERT ... ON CONFLICT (delivery_id) DO NOTHING` to deduplicate atomically.

**Rationale**:
- GitHub retries failed deliveries using the same UUID in `X-GitHub-Delivery`. This is the canonical idempotency key.
- Postgres `ON CONFLICT DO NOTHING` is atomic, so concurrent duplicate arrivals (common during retry storms) are handled without race conditions.
- Check inserted row count: if 0, the event was already processed — return 200 immediately without re-executing downstream logic.
- Always return 2xx on duplicates, never 4xx. GitHub interprets 4xx as a permanent failure and may disable the webhook.

**Alternatives considered**:
- Application-level deduplication (check-then-insert): Rejected due to TOCTOU race condition under concurrent retries.
- Using event timestamp as deduplication key: Rejected — timestamps are not guaranteed unique across distinct events.

---

## Decision 6: Webhook Receiver Architecture

**Decision**: Use **Next.js App Router Route Handlers** for the webhook receiver. No separate Express/FastAPI service is needed at this stage.

**Rationale**:
- Railway runs Next.js as a **persistent container** (not serverless). Cold starts are not a concern. The process stays alive and handles connections continuously.
- Next.js App Router Route Handlers provide direct access to the raw request body via `request.text()`, which is required for HMAC verification.
- Co-locating the webhook receiver avoids operating a second service, deploy pipeline, and inter-service networking at a stage where it is not warranted.
- The receiver is intentionally thin: verify signature → write raw event to `webhook_events` with delivery UUID → return 200. No heavy processing inline.

**Alternatives considered**:
- Separate Express service: Rejected as premature. Worth revisiting if webhook volume requires independent horizontal scaling.
- Vercel serverless deployment: Rejected — Railway persistent container model is better suited for webhook ingestion.

---

## Resolved Unknowns Summary

| Topic | Decision |
|-------|----------|
| Auth mechanism | GitHub App (not OAuth App) |
| Webhook scope | Single per-user installation, all repos |
| Signature verification | HMAC-SHA256, timingSafeEqual, raw body |
| Session management | Supabase Auth + manual token table |
| Idempotency | `X-GitHub-Delivery` UUID unique constraint |
| Receiver architecture | Next.js Route Handler on Railway |
