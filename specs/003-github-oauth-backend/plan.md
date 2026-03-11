# Implementation Plan: GitHub OAuth Backend Initialization

**Branch**: `003-github-oauth-backend` | **Date**: 2026-03-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-github-oauth-backend/spec.md`

## Summary

Enable GitHub-authenticated users to install a GitHub App that registers a centralized webhook. The webhook receiver ingests push and pull request events, verifies their authenticity via HMAC-SHA256, and persists them (with diff size) to Supabase for downstream tamagotchi logic to consume. Built on the existing Next.js + Supabase stack hosted on Railway.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20
**Primary Dependencies**: Next.js 16 (App Router), Supabase JS client v2, `@supabase/ssr`, Node `crypto` (built-in)
**Storage**: Supabase (Postgres) — `user_github_tokens`, `webhook_installations`, `webhook_events`, `commit_events`
**Testing**: Vitest (unit), Playwright (integration/e2e) — matches existing project setup
**Target Platform**: Railway (persistent container), Chrome Extension (popup)
**Project Type**: Web service + Chrome Extension
**Performance Goals**: Webhook receiver must respond within 3 seconds (GitHub timeout is 10s); process events asynchronously
**Constraints**: Raw request body must be captured before any parsing (HMAC requirement); service role key used for all webhook writes (never exposed to client)
**Scale/Scope**: Single-user MVP initially; data model supports multi-user from day one

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Commit-Triggered Enforcement | PASSES | This feature is the implementation of the webhook trigger — directly enables Principle I |
| II. Proportional Degenerative Time | PASSES (partial scope) | `diff_size = lines_added + lines_deleted` is defined and stored in `commit_events`. The conversion rate is downstream. |
| III. Mandatory Watch Gate | N/A | Enforcement gate is a downstream feature |
| IV. Avatar Vitality Coupling | N/A | Avatar updates are a downstream feature |
| V. Deterministic Activity Classification | N/A | Tab classification is a downstream extension feature |
| Operational Policy: Commit Size Metric | PASSES | Metric defined as `lines_added + lines_deleted` in `commit_events.diff_size`. Documented in data-model.md. |
| Operational Policy: Time Mapping | N/A | Downstream concern |

**Post-design re-check**: All applicable principles remain satisfied. No violations found.

## Project Structure

### Documentation (this feature)

```text
specs/003-github-oauth-backend/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── webhook-receiver.md
│   └── github-auth.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
app/
├── api/
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts          # GitHub OAuth callback handler
│   └── webhooks/
│       └── github/
│           └── route.ts          # Webhook receiver (POST only)
├── components/
│   └── IdlePet.tsx               # (existing)
├── layout.tsx                    # (existing)
└── page.tsx                      # (existing)

lib/
├── github/
│   ├── auth.ts                   # GitHub token storage, refresh logic
│   └── webhook.ts                # HMAC signature verification helper
└── supabase/
    ├── client.ts                 # Browser Supabase client
    └── server.ts                 # Server-side Supabase client (service role)

supabase/
└── migrations/
    ├── 001_user_github_tokens.sql
    ├── 002_webhook_installations.sql
    ├── 003_webhook_events.sql
    └── 004_commit_events.sql

tests/
├── unit/
│   ├── example.spec.ts           # (existing)
│   └── webhook-signature.spec.ts # HMAC verification unit tests
├── integration/
│   ├── webhook-receiver.spec.ts  # Route handler integration tests
│   └── github-auth.spec.ts       # Auth callback integration tests
└── e2e/
    └── extension.spec.ts         # (existing)
```

**Structure Decision**: Extends the existing flat Next.js monorepo. New code is added to `app/api/` (route handlers) and a new `lib/` directory for shared backend utilities. Database migrations go in `supabase/migrations/`. No new packages or separate services are introduced.

## Complexity Tracking

No constitution violations requiring justification.
