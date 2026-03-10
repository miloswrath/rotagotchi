# Contract: Test Runner Interface

**Feature**: 002-extension-testing-suite
**Date**: 2026-03-10

This document defines the contract that the test infrastructure exposes to developers
and CI — specifically the commands, directory conventions, and CI status checks that all
consumers can rely on.

---

## npm Scripts Contract

These scripts MUST exist in `package.json` and MUST have stable, predictable behavior:

| Script | Command | Exit code 0 means |
|--------|---------|-------------------|
| `pnpm test:e2e` | Run all `tests/e2e/**/*.spec.ts` via Playwright | All e2e specs pass |
| `pnpm test:smoke` | Run all `tests/smoke/**/*.spec.ts` via Playwright | All smoke specs pass |
| `pnpm test:unit` | Run all `tests/unit/**/*.spec.ts` via Vitest | All unit specs pass |
| `pnpm lint` | Run ESLint across the codebase | No lint violations |

**Invariant**: Adding a new `*.spec.ts` file to any of the three test directories causes
it to be discovered and run by the corresponding script — no config changes required.

---

## Directory Convention Contract

```
tests/
├── e2e/          ← Playwright e2e specs; have access to loaded extension context
├── smoke/        ← Playwright smoke specs; same context as e2e, faster happy-path only
├── unit/         ← Vitest unit specs; no browser, pure function tests
└── fixtures/     ← Shared Playwright fixtures (extension context, extension ID)
playwright.config.ts   ← Playwright configuration (projects: e2e, smoke)
vitest.config.ts       ← Vitest configuration (testMatch: tests/unit/**/*.spec.ts)
```

---

## CI Status Checks Contract

Every PR targeting `main` MUST produce these two status checks:

| Status Check Name | What it runs | Required to merge |
|-------------------|-------------|------------------|
| `lint` | `pnpm lint` | Yes |
| `e2e` | `pnpm test:e2e` | Yes |

**Invariant**: These checks trigger automatically on PR creation and on every subsequent
push to the PR branch. They do NOT require manual triggering.

---

## Extension Fixture Contract

The shared Playwright fixture at `tests/fixtures/extension.ts` MUST export:

```ts
export type ExtensionFixtures = {
  context: BrowserContext;  // persistent context with extension loaded
  extensionId: string;      // resolved extension ID (e.g. "abcdefghijklmnopqrstuvwxyzab")
};
```

Any e2e or smoke test can use `extensionId` to navigate to extension pages:
```ts
await page.goto(`chrome-extension://${extensionId}/popup.html`);
```

---

## Playwright Config Contract

`playwright.config.ts` MUST define:

- `testDir`: `./tests`
- Two projects: `e2e` (testMatch: `e2e/**/*.spec.ts`) and `smoke` (testMatch: `smoke/**/*.spec.ts`)
- Shared extension fixture available to both projects
- `use.headless: false` (required for extension loading; safe in CI)
