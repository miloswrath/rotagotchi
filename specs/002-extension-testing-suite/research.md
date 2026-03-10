# Research: Chrome Extension Testing Suite

**Feature**: 002-extension-testing-suite
**Date**: 2026-03-10

---

## Decision 1: E2E Test Framework

**Decision**: `@playwright/test` with Chromium for all e2e and smoke tests.

**Rationale**: Playwright is the only mainstream framework that can load an unpacked Chrome
extension (via `--load-extension` flag in a persistent browser context). It handles headless
Chromium internally, requiring no xvfb in CI. The project already uses TypeScript, and
`@playwright/test` has first-class TS support.

**Alternatives considered**:
- Puppeteer: also supports `--load-extension`, but less ergonomic test runner API and
  slower community iteration.
- Jest + jsdom: cannot test real extension behavior (popup, content script, service worker);
  suitable only for pure function unit tests, not integration or e2e.
- WebdriverIO: supports extensions but far more setup overhead.

---

## Decision 2: Unit Test Runner

**Decision**: Vitest for unit test stubs/scaffolding.

**Rationale**: The web app already uses TypeScript 5 and the existing toolchain is
Node/pnpm-based. Vitest integrates naturally (zero extra babel config), supports ESM,
and works with jsdom environment for browser-API stubs. Provides a consistent
`describe`/`it`/`expect` API familiar to the team.

**Alternatives considered**:
- Node `node:test` built-in: no extra dep, but poor DX and limited mocking support.
- Jest: large config surface; does not support ESM well without extra transforms.

---

## Decision 3: Playwright Extension Loading Pattern

**Decision**: Use a persistent Playwright browser context with `--load-extension` pointing
at the `extension/` directory. Resolve the extension ID at test setup from the loaded
background service worker page URL.

**Rationale**: Chrome extensions only run in persistent (non-incognito) contexts. The
extension ID is auto-generated per-load, so tests must resolve it dynamically at startup
rather than hard-coding it.

**Key code pattern**:
```ts
// playwright.config.ts – shared fixture
const pathToExtension = path.join(__dirname, 'extension');
const context = await chromium.launchPersistentContext('', {
  headless: false,          // required for extensions in older Chromium builds
  args: [
    `--disable-extensions-except=${pathToExtension}`,
    `--load-extension=${pathToExtension}`,
  ],
});
```

**Note on headless**: Playwright ≥ v1.44 supports a new `--headless=new` mode that allows
extensions; older builds require `headless: false`. Using `headless: false` in CI is safe
because GitHub Actions runners have a virtual display via xvfb-run (Ubuntu 22.04). Add
`--no-sandbox` for CI environments.

---

## Decision 4: Background Service Worker Testing Strategy

**Decision**: Do NOT test background.js directly. Test its behavior indirectly through
popup UI interactions or chrome.storage state read in the popup.

**Rationale**: Background service workers terminate after inactivity and cannot be reliably
introspected in Playwright. Playwright's `serviceWorkerForURL()` can find the SW page, but
direct code evaluation in it is fragile. The reliable pattern is to trigger background logic
via popup/content script and assert results through UI or storage.

**Alternatives considered**:
- Direct `serviceWorkerForURL()` + `evaluate()`: technically possible but brittle; SW may
  have terminated by the time evaluate runs.

---

## Decision 5: Test Directory Layout

**Decision**: All tests live at repo root under `tests/`, co-located with the web app tests.
Playwright config (`playwright.config.ts`) at repo root.

```
tests/
├── e2e/        – Playwright e2e specs (real browser, extension loaded)
├── smoke/      – Playwright smoke specs (fast happy-path checks)
└── unit/       – Vitest unit specs (isolated function tests, no browser)
```

**Rationale**: Keeps test infra next to package.json and playwright.config.ts; consistent
with Next.js project convention; easy CI path configuration. Separating smoke from e2e keeps
full e2e suite time down while allowing quick smoke validation.

---

## Decision 6: GitHub Actions CI

**Decision**: Single workflow file `.github/workflows/pr-checks.yml` with two jobs:
`lint` (ESLint) and `e2e` (Playwright), both required for PR merge.

**Rationale**: Separate jobs allow parallel execution and independent status checks on the
PR. The existing `eslint` script in package.json is used as-is. Playwright requires
`pnpm exec playwright install --with-deps chromium` to install browser + OS deps on CI.

**CI gotchas resolved**:
- Playwright install: `pnpm exec playwright install --with-deps chromium` (installs
  libatk, libnss3, and other OS deps automatically).
- Extension headless: use `headless: false` + no `--headless` flag in args; GitHub's
  ubuntu-latest runner supports virtual display for non-headless Chrome.
- pnpm cache: use `actions/setup-node` with `cache: 'pnpm'` for fast installs.

---

## Summary of Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| Which test framework for e2e? | @playwright/test with Chromium |
| Which framework for unit stubs? | Vitest |
| How to load extension in Playwright? | persistent context + --load-extension flag |
| Can we run headless in CI? | Yes, headless: false is safe on GitHub runners |
| Where do tests live? | `tests/` at repo root |
| How to test background.js? | Indirectly via popup UI / storage assertions |
| What CI workflow structure? | Two separate jobs: lint + e2e |
