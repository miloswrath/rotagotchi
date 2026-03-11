# Contract: Webhook Receiver

**Endpoint**: `POST /api/webhooks/github`
**Route file**: `app/api/webhooks/github/route.ts`

---

## Purpose

Receives inbound GitHub App webhook events, verifies their authenticity, and persists them to the `webhook_events` table for downstream processing.

---

## Request

### Headers (required by GitHub)

| Header | Description |
|--------|-------------|
| `X-Hub-Signature-256` | HMAC-SHA256 signature: `sha256=<hex>` |
| `X-GitHub-Event` | Event type (e.g., `push`, `pull_request`, `installation`) |
| `X-GitHub-Delivery` | Unique delivery UUID — used as idempotency key |
| `Content-Type` | `application/json` |

### Body

Raw JSON payload as sent by GitHub. The exact schema varies by event type.

For `push` events, the following fields are consumed:
- `installation.id` — installation identifier
- `ref` — branch ref (e.g., `refs/heads/main`)
- `commits[].added`, `commits[].removed`, `commits[].modified` (arrays of file paths)
- `commits[].stats.additions`, `commits[].stats.deletions` (if available in payload)
- `head_commit.id` — HEAD commit SHA
- `repository.full_name` — repo identifier
- `head_commit.timestamp` — event timestamp

For `pull_request` events, the following fields are consumed:
- `installation.id`
- `action` — e.g., `opened`, `closed`, `synchronize`
- `pull_request.additions`, `pull_request.deletions`
- `pull_request.head.sha`
- `pull_request.base.ref`
- `repository.full_name`
- `pull_request.updated_at` — event timestamp

---

## Processing Logic

1. Read raw body as text (`request.text()`) — must occur before any JSON parsing
2. Verify `X-Hub-Signature-256` using `crypto.timingSafeEqual` against `HMAC-SHA256(raw_body, GITHUB_WEBHOOK_SECRET)` — return 403 if mismatch
3. Parse `X-GitHub-Delivery` header as idempotency key
4. Attempt `INSERT INTO webhook_events ... ON CONFLICT (delivery_id) DO NOTHING`
5. If 0 rows inserted (duplicate): return 200 immediately, skip all further processing
6. If 1 row inserted: enqueue async processing job for `push` and `pull_request` event types; other types stored but not enqueued
7. Return 200

---

## Responses

| Status | Condition |
|--------|-----------|
| `200 OK` | Event accepted and stored, or duplicate event received |
| `403 Forbidden` | Signature verification failed |
| `400 Bad Request` | Missing required headers |
| `500 Internal Server Error` | Database write failure (returned after logging; GitHub will retry) |

**Note**: Never return 4xx for duplicates. GitHub treats 4xx as permanent failure and may disable the webhook.

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `GITHUB_WEBHOOK_SECRET` | Shared secret configured in GitHub App settings |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-side inserts (bypasses RLS) |
