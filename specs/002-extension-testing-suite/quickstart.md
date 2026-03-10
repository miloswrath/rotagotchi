# Quickstart: Chrome Extension Testing Suite

**Feature**: 002-extension-testing-suite
**Date**: 2026-03-10

---

## Prerequisites

- Node.js 20+ and pnpm installed
- Chromium (installed via Playwright — see step 2)

---

## Setup

### 1. Install project dependencies

```bash
pnpm install
```

### 2. Install Playwright browser

```bash
pnpm exec playwright install chromium
```

---

## Running Tests

### Run all e2e tests (extension loaded in real browser)

```bash
pnpm test:e2e
```

### Run smoke tests (fast happy-path check)

```bash
pnpm test:smoke
```

### Run unit tests

```bash
pnpm test:unit
```

### Run ESLint

```bash
pnpm lint
```

---

## Writing New Tests

### Add a unit test

Create a file in `tests/unit/` with the naming convention `*.spec.ts`:

```bash
touch tests/unit/my-feature.spec.ts
```

Copy the example stub:

```ts
import { describe, it, expect } from 'vitest';

describe('my-feature', () => {
  it('does the thing', () => {
    expect(true).toBe(true); // replace with real assertion
  });
});
```

The test runner discovers `tests/unit/**/*.spec.ts` automatically — no config changes needed.

### Add a smoke test

Create a file in `tests/smoke/` with naming convention `*.spec.ts`:

```bash
touch tests/smoke/my-feature.spec.ts
```

Smoke tests use Playwright and have access to the loaded extension context (see
`tests/e2e/extension.spec.ts` for the fixture pattern).

### Add an e2e test

Create a file in `tests/e2e/` with naming convention `*.spec.ts`. Use the shared
extension fixture from `tests/fixtures/extension.ts` to get the loaded extension context
and ID.

---

## CI Behavior

Every PR to `main` automatically runs:

1. **lint** job — runs ESLint across the codebase
2. **e2e** job — runs the full Playwright e2e suite

Both must pass for the PR to be mergeable. Results appear as separate status checks on
the PR.

To reproduce CI locally:

```bash
pnpm lint && pnpm test:e2e
```
