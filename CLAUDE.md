# rotagotchi Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-10

## Active Technologies
- TypeScript 5.x / Node.js 20 + Next.js 16 (App Router), Supabase JS client v2, `@supabase/ssr`, Node `crypto` (built-in) (003-github-oauth-backend)
- Supabase (Postgres) — `user_github_tokens`, `webhook_installations`, `webhook_events`, `commit_events` (003-github-oauth-backend)
- TypeScript 5.x / Node.js 20 + Next.js 16 (App Router), React 19, Vitest 3, Playwright 1.50 (004-tamagotchi-state-logic)
- N/A — no persistence in this feature (004-tamagotchi-state-logic)
- TypeScript 5.x / Node.js 20; extension files transpiled from TypeScript to JavaScript via esbuild + `lottie-web` (animation renderer, bundled into extension), `esbuild` (extension build tool, dev dependency), existing `lottie-react` v2.4.1 (unchanged, Next.js app only) (005-move-to-extension)
- `chrome.storage.session` (volatile tab state), `chrome.storage.local` (persistent blacklist), no Supabase involvement (005-move-to-extension)

- TypeScript 5.x / Node.js 20 (matches existing project) + `@playwright/test` (e2e + smoke), `vitest` (unit stubs), ESLint 9 (existing) (002-extension-testing-suite)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x / Node.js 20 (matches existing project): Follow standard conventions

## Recent Changes
- 005-move-to-extension: Added TypeScript 5.x / Node.js 20; extension files transpiled from TypeScript to JavaScript via esbuild + `lottie-web` (animation renderer, bundled into extension), `esbuild` (extension build tool, dev dependency), existing `lottie-react` v2.4.1 (unchanged, Next.js app only)
- 004-tamagotchi-state-logic: Added TypeScript 5.x / Node.js 20 + Next.js 16 (App Router), React 19, Vitest 3, Playwright 1.50
- 003-github-oauth-backend: Added TypeScript 5.x / Node.js 20 + Next.js 16 (App Router), Supabase JS client v2, `@supabase/ssr`, Node `crypto` (built-in)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
