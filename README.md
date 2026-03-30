# Rotagotchi

> A productivity accountability system that punishes you for working too hard.

Rotagotchi is a gamified browser companion that enforces balance between coding output and downtime. When you push commits to GitHub, your tamagotchi accumulates **time debt** proportional to the size of your diffs. You pay off that debt by watching degenerative content (social media, videos, etc.) — tracked by a browser extension. Neglect your debt and your pet suffers.

The punishment scales with the work performed.

---

## How It Works

1. **You commit code** — GitHub sends a webhook to Rotagotchi with your diff size
2. **Time debt accrues** — the larger the commit, the more watch time you owe
3. **You pay it off** — the browser extension monitors your active tabs against a blacklist of degenerative sites (YouTube, TikTok, Instagram, etc.)
4. **Your pet lives or dies** — the tamagotchi's health reflects how well you're keeping up with your debt

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Language | TypeScript 5.x / Node.js 20 |
| Database | Supabase (PostgreSQL) |
| Auth | GitHub OAuth 2.0 |
| Animation | Lottie React |
| Browser Extension | Chrome Extension (Manifest V3) |
| Testing | Vitest 3 (unit), Playwright 1.50 (e2e) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- A Supabase project
- A GitHub OAuth App and GitHub App (for webhooks)

### Install Dependencies

```bash
pnpm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# GitHub OAuth App
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# GitHub App (webhooks)
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY=your_pem_key_with_newlines_as_\n
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_APP_SLUG=your_app_slug

# Local webhook proxy (development only)
WEBHOOK_PROXY_URL=https://smee.io/your_channel
```

### Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Load the Browser Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` directory

---

## Testing

```bash
pnpm test              # Unit tests (Vitest)
pnpm run test:e2e      # End-to-end tests (Playwright)
pnpm run test:smoke    # Smoke tests
pnpm run lint          # ESLint
```

---

## Project Structure

```
rotagotchi/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── auth/           # GitHub OAuth callback
│   │   └── webhooks/github/# Webhook ingestion
│   ├── components/         # React components
│   └── page.tsx            # Home page
├── lib/
│   ├── state/              # Global tamagotchi state (Context + hooks)
│   ├── github/             # OAuth token management, webhook verification
│   ├── supabase/           # Supabase client (browser + server)
│   └── whitelist.json      # Blacklisted domains tracked by extension
├── extension/              # Chrome extension source
├── rot/                    # Lottie animation files (idle, hungry, death, etc.)
├── tests/
│   ├── unit/               # Vitest unit tests
│   ├── integration/        # Integration tests
│   ├── e2e/                # Playwright browser tests
│   └── smoke/              # Smoke tests
├── specs/                  # Feature specifications
└── features/               # High-level design docs and constitution
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `user_github_tokens` | GitHub OAuth access and refresh tokens |
| `webhook_installations` | Webhook registration metadata per user |
| `webhook_events` | Raw incoming events from GitHub |
| `commit_events` | Processed commits (diff size, repo, timestamp) |

---

## Credits

Built at the University of Iowa.

| Contributor | Role |
|---|---|
| [Zak Gilliam](https://github.com/miloswrath) | Project lead, backend, state logic |
| Ben Ruiz | Animation states |
| Andrew Putt | Architecture |
