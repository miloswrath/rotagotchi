# Quickstart: GitHub OAuth Backend Initialization

**Feature**: 003-github-oauth-backend

---

## Prerequisites

- Node.js 20 + pnpm
- A Supabase project (free tier is sufficient)
- A GitHub App registered at github.com/settings/apps

---

## Step 1: Create a GitHub App

1. Go to GitHub → Settings → Developer settings → GitHub Apps → New GitHub App
2. Set the following:
   - **Callback URL**: `http://localhost:3000/api/auth/callback` (update for production)
   - **Webhook URL**: `http://localhost:3000/api/webhooks/github` (use a tunnel like ngrok for local dev)
   - **Webhook secret**: generate a random secret and save it
   - **Permissions**: Repository → Contents (Read-only), Metadata (Read-only)
   - **Events to subscribe**: Push, Pull request, Installation
   - **Where can this GitHub App be installed?**: Any account
3. After creation, note: App ID, Client ID, Client Secret
4. Generate and download a private key (PEM file)

---

## Step 2: Configure Supabase

1. In Supabase dashboard → Authentication → Providers → GitHub
   - Enable GitHub provider
   - Enter Client ID and Client Secret from your GitHub App
2. Set **Site URL** to `http://localhost:3000`
3. Add `http://localhost:3000/api/auth/callback` to **Redirect URLs**
4. Run the database migrations (see `supabase/migrations/`) to create the four application tables

---

## Step 3: Environment Variables

Create `.env.local` in the repo root:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

GITHUB_APP_ID=<app-id>
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_CLIENT_ID=<client-id>
GITHUB_CLIENT_SECRET=<client-secret>
GITHUB_WEBHOOK_SECRET=<webhook-secret>
```

For `GITHUB_APP_PRIVATE_KEY`, replace literal newlines in the PEM file with `\n` to store as a single line.

---

## Step 4: Start the Dev Server

```bash
pnpm install
pnpm dev
```

Server runs at `http://localhost:3000`.

---

## Step 5: Test Webhook Locally

Use [smee.io](https://smee.io) or ngrok to expose your local server to GitHub:

```bash
# Using smee-client
npx smee --url https://smee.io/<your-channel> --target http://localhost:3000/api/webhooks/github
```

Update the GitHub App's Webhook URL to the smee/ngrok URL. Push a commit to any repo where the app is installed and verify a row appears in `webhook_events`.

---

## Step 6: Test the Auth Flow

1. Open `http://localhost:3000` in a browser
2. Click "Sign in with GitHub"
3. Complete authorization on GitHub
4. Confirm redirect back to the app with `?auth=success`
5. Check Supabase → Table Editor → `user_github_tokens` — a row should exist for your user

---

## Key File Locations

| File | Purpose |
|------|---------|
| `app/api/auth/callback/route.ts` | OAuth callback handler |
| `app/api/webhooks/github/route.ts` | Webhook receiver |
| `lib/github/auth.ts` | GitHub token management helpers |
| `lib/github/webhook.ts` | HMAC signature verification |
| `lib/supabase/server.ts` | Server-side Supabase client (service role) |
| `supabase/migrations/` | Database schema migrations |
