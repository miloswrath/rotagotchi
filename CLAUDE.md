# rotagotchi Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-10

## Active Technologies
- TypeScript 5.x / Node.js 20 + Next.js 16 (App Router), Supabase JS client v2, `@supabase/ssr`, Node `crypto` (built-in) (003-github-oauth-backend)
- Supabase (Postgres) — `user_github_tokens`, `webhook_installations`, `webhook_events`, `commit_events` (003-github-oauth-backend)

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
- 003-github-oauth-backend: Added TypeScript 5.x / Node.js 20 + Next.js 16 (App Router), Supabase JS client v2, `@supabase/ssr`, Node `crypto` (built-in)

- 002-extension-testing-suite: Added TypeScript 5.x / Node.js 20 (matches existing project) + `@playwright/test` (e2e + smoke), `vitest` (unit stubs), ESLint 9 (existing)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
