# Feature Spec -> Production Webhook Hosting

## General Idea
---
- Replace local `smee-client` tunnel + Railway with a production hosting solution for the Next.js webhook endpoint
- GitHub App must be able to deliver webhook events to a stable public URL at all times

## Requirements
---
- Webhook endpoint (`/api/webhooks/github`) must be publicly reachable at a stable URL
- HMAC-SHA256 signature verification must remain intact
- Async background processing (`processWebhookEvent`) must complete reliably (not be cut off by serverless cold stop)
- Minimize code changes and platform sprawl

## Research Findings

### Hosting on Vercel
- Next.js deploys natively to Vercel with zero config changes
- Free tier: 100K serverless function invocations/month
- Git-connected: push to GitHub → auto-deploy
- **One required code change**: `void processWebhookEvent()` (fire-and-forget, relies on Railway's persistent process) must become `after(() => processWebhookEvent(...))` using Next.js 15 `after()` API — this defers background work until after the response is sent, compatible with serverless
- Set env vars (`GITHUB_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`) in Vercel dashboard
- Update GitHub App webhook URL to `https://<app>.vercel.app/api/webhooks/github`

## Recommendation
---
**Vercel** — least obstruction, one line of code changed, no rewrite, no new platform to learn.

### Steps
1. Connect repo to Vercel (git integration)
2. Change `route.ts`: replace fire-and-forget call with `after(() => processWebhookEvent(...))`
3. Add env vars in Vercel dashboard
4. Update GitHub App webhook URL
