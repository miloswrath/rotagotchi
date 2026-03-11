# Data Model: GitHub OAuth Backend Initialization

**Feature**: 003-github-oauth-backend
**Date**: 2026-03-11

---

## Overview

Four tables support this feature. `users` is owned by Supabase Auth and extended with application data. The other three are application-owned, all protected by Row Level Security (RLS) so users can only access their own rows.

---

## Table: `user_github_tokens`

Stores the GitHub App user-to-server token and refresh token captured at sign-in. Not managed by Supabase Auth natively — must be written by the application immediately after the OAuth callback.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `user_id` | `uuid` | PK, FK → `auth.users(id)` ON DELETE CASCADE | Supabase Auth user |
| `access_token` | `text` | NOT NULL | GitHub App user-to-server token (expires 8h) |
| `refresh_token` | `text` | NOT NULL | Used to refresh access_token (expires 6 months) |
| `access_token_expires_at` | `timestamptz` | NOT NULL | Derived from GitHub response; drives refresh scheduling |
| `refresh_token_expires_at` | `timestamptz` | NOT NULL | After this date, user must re-authorize |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | Updated on every token refresh |

**Validation rules**:
- `access_token_expires_at` must be in the future at time of write
- Row must be upserted (not duplicated) on re-authorization

**State transition**: Created on first sign-in → updated on each token refresh → deleted on sign-out or access revocation

---

## Table: `webhook_installations`

Tracks the GitHub App installation ID per user. Required to generate installation access tokens for server-side GitHub API calls.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | |
| `installation_id` | `bigint` | NOT NULL, UNIQUE | GitHub's installation ID |
| `account_login` | `text` | NOT NULL | GitHub username or org name |
| `account_type` | `text` | NOT NULL | `"User"` or `"Organization"` |
| `access_all_repos` | `boolean` | NOT NULL, DEFAULT false | True if user granted "all repositories" |
| `installed_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `suspended_at` | `timestamptz` | NULLABLE | Set when GitHub sends `installation.suspend` event |

**Validation rules**:
- `installation_id` is globally unique (GitHub guarantees this)
- An uninstall event deletes the row (or soft-deletes via a `removed_at` column — implementation decision)

---

## Table: `webhook_events`

Raw event log. Thin, append-only. Provides idempotency via the delivery UUID. Downstream processing reads from here.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `delivery_id` | `uuid` | PK | Sourced from `X-GitHub-Delivery` header — guarantees idempotency |
| `installation_id` | `bigint` | NOT NULL, FK → `webhook_installations(installation_id)` | Identifies which installation triggered the event |
| `event_type` | `text` | NOT NULL | Value of `X-GitHub-Event` header (e.g., `push`, `pull_request`) |
| `action` | `text` | NULLABLE | Payload `action` field where applicable (e.g., `opened`, `merged`) |
| `received_at` | `timestamptz` | NOT NULL, DEFAULT now() | Server receipt time |
| `payload` | `jsonb` | NOT NULL | Full raw payload (retained for auditability and reprocessing) |
| `processed` | `boolean` | NOT NULL, DEFAULT false | Set to true by downstream processor after `commit_events` row is created |

**Validation rules**:
- `INSERT ... ON CONFLICT (delivery_id) DO NOTHING` — enforced at application layer on every inbound event
- Only `push` and `pull_request` events produce downstream `commit_events` rows; other event types (e.g., `installation`) are stored but not processed for commit metrics

---

## Table: `commit_events`

Normalized, queryable records extracted from `webhook_events`. This is the table downstream tamagotchi logic consumes. Each row represents one push or pull request event with its commit size metric.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | |
| `delivery_id` | `uuid` | NOT NULL, UNIQUE, FK → `webhook_events(delivery_id)` | 1:1 with source event; prevents duplicate processing |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | Derived from installation owner |
| `repo_full_name` | `text` | NOT NULL | e.g., `"username/repo-name"` |
| `commit_sha` | `text` | NULLABLE | HEAD commit SHA for push events; merge SHA for PRs |
| `branch` | `text` | NULLABLE | Target branch for push; base branch for PR |
| `diff_size` | `integer` | NOT NULL, CHECK (diff_size >= 0) | **lines_added + lines_deleted** — the constitutional commit size metric |
| `lines_added` | `integer` | NOT NULL, CHECK (lines_added >= 0) | Source component of diff_size |
| `lines_deleted` | `integer` | NOT NULL, CHECK (lines_deleted >= 0) | Source component of diff_size |
| `event_type` | `text` | NOT NULL | `"push"` or `"pull_request"` |
| `occurred_at` | `timestamptz` | NOT NULL | Timestamp from GitHub payload (not server receipt time) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

**Commit size metric (Constitutional)**:
`diff_size = lines_added + lines_deleted`

This is the metric referenced in Constitution Principle II and Operational Policy. It is sourced from the webhook payload's diff statistics. For push events, the aggregate across all commits in the push is used. For pull requests, the PR-level additions/deletions from the payload are used. This definition is fixed by the constitution and cannot change without a constitutional amendment.

**State transition**: Created by the event processor when `processed = false` in `webhook_events` → `webhook_events.processed` set to `true` after successful insert

---

## Entity Relationships

```text
auth.users
    ├── user_github_tokens (1:1)
    ├── webhook_installations (1:many — user may install on personal + multiple orgs)
    │       └── webhook_events (1:many — events flow via installation_id)
    │               └── commit_events (1:1 — one normalized record per raw event)
    └── commit_events (direct FK for efficient user-scoped queries)
```

---

## RLS Policy Summary

All tables: `ENABLE ROW LEVEL SECURITY`

- `user_github_tokens`: SELECT/INSERT/UPDATE/DELETE where `user_id = auth.uid()`
- `webhook_installations`: SELECT/INSERT/UPDATE/DELETE where `user_id = auth.uid()`
- `webhook_events`: SELECT where installation's `user_id = auth.uid()`; INSERT by service role only (webhook receiver runs with service role key, never user JWT)
- `commit_events`: SELECT where `user_id = auth.uid()`; INSERT by service role only
