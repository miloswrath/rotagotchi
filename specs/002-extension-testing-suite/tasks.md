---

description: "Task list for Chrome Extension Testing Suite"
---

# Tasks: Chrome Extension Testing Suite

**Input**: Design documents from `/specs/002-extension-testing-suite/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not using TDD — this feature IS the testing infrastructure. No separate test tasks generated.

**Organization**: Tasks grouped by user story for independent implementation and validation.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in every task description

## Path Conventions

- Extension source: `extension/` at repository root (unchanged)
- Test suite: `tests/` at repository root (new)
- Config files: repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create the directory structure. No user story work can begin until this phase is complete.

- [x] T001 Add `@playwright/test` and `vitest` to devDependencies in `package.json` and run `pnpm install`
- [x] T002 Add scripts to `package.json`: `"test:e2e": "playwright test --project=e2e"`, `"test:smoke": "playwright test --project=smoke"`, `"test:unit": "vitest run tests/unit"`
- [x] T003 [P] Create directory scaffold: `tests/fixtures/`, `tests/e2e/`, `tests/smoke/`, `tests/unit/` (add `.gitkeep` to each empty dir)

**Checkpoint**: `pnpm install` succeeds, scripts exist in package.json, directory tree is present

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the shared Playwright configuration and extension fixture that all e2e and smoke tests depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Create `playwright.config.ts` at repo root — define two projects (`e2e` matching `tests/e2e/**/*.spec.ts`, `smoke` matching `tests/smoke/**/*.spec.ts`), set `use.headless: false`, add chromium launch args `--disable-extensions-except=./extension` and `--load-extension=./extension` using `path.resolve` from `__dirname`
- [x] T005 [P] Create `vitest.config.ts` at repo root — set `include: ['tests/unit/**/*.spec.ts']`, environment `node`
- [x] T006 Create `tests/fixtures/extension.ts` — export a Playwright fixture `ExtensionFixtures` with `context: BrowserContext` (persistent chromium context with extension loaded) and `extensionId: string` (resolved dynamically from the background service worker page URL after context opens); export as a `test` object extending base Playwright `test`

**Checkpoint**: `pnpm exec playwright install chromium` installs successfully; `playwright.config.ts` passes `npx playwright --version` config check

---

## Phase 3: User Story 1 - Run E2E Tests Against the Extension (Priority: P1) 🎯 MVP

**Goal**: A developer can run a single command and verify the extension's core popup flow in a real browser.

**Independent Test**: Run `pnpm test:e2e` — should discover and pass `tests/e2e/extension.spec.ts`, which loads the extension, opens the popup, and asserts the status element renders with expected text.

### Implementation for User Story 1

- [x] T007 [US1] Create `tests/e2e/extension.spec.ts` using the `test` fixture from `tests/fixtures/extension.ts` — write one test: navigate to `chrome-extension://${extensionId}/popup.html`, assert page title is "Rotagotchi", assert `#status` element is visible and contains text (either "Ready for development." or "Extension loaded.")

**Checkpoint**: `pnpm test:e2e` runs, discovers the spec, opens a browser with the extension loaded, and reports PASS with clear step output

---

## Phase 4: User Story 2 - Automated Quality Gate on PRs to Main (Priority: P2)

**Goal**: Every PR to main automatically triggers ESLint and e2e checks as required status checks.

**Independent Test**: Open a PR to main (or push to a test branch targeting main) — verify the Actions tab shows both `lint` and `e2e` jobs run automatically and report status.

### Implementation for User Story 2

- [x] T008 [US2] Create `.github/workflows/pr-checks.yml` — trigger: `pull_request` targeting `main`; define two jobs: `lint` (checkout → setup-node with pnpm cache → pnpm install → `pnpm lint`) and `e2e` (checkout → setup-node with pnpm cache → pnpm install → `pnpm exec playwright install --with-deps chromium` → `pnpm test:e2e`); use `ubuntu-latest`; both jobs are independent (no `needs` relationship)

**Checkpoint**: Push a branch with a PR to main → both `lint` and `e2e` appear as separate status checks in the PR; a lint violation blocks the `lint` check; a failing test blocks the `e2e` check

---

## Phase 5: User Story 3 - Unit and Smoke Test Scaffold (Priority: P3)

**Goal**: A developer adding a feature immediately finds labeled directories with copyable stub files for both unit and smoke tests.

**Independent Test**: Create a new file copying the stub in `tests/unit/` — run `pnpm test:unit` and verify it is auto-discovered and run. Repeat for `tests/smoke/`.

### Implementation for User Story 3

- [x] T009 [P] [US3] Create `tests/smoke/extension-loads.spec.ts` using the `test` fixture from `tests/fixtures/extension.ts` — one smoke test: navigate to `chrome-extension://${extensionId}/popup.html`, assert page loads without error (no crash, title present); add a comment header explaining this is the smoke test template
- [x] T010 [P] [US3] Create `tests/unit/example.spec.ts` using Vitest — `describe` / `it` / `expect` structure; write one passing assertion as a placeholder; add a comment header explaining how to copy this file to write new unit tests; import from `vitest` explicitly

**Checkpoint**: `pnpm test:unit` discovers and runs `tests/unit/example.spec.ts` automatically; `pnpm test:smoke` discovers and runs `tests/smoke/extension-loads.spec.ts` automatically; copying either file and adding a new test causes it to be discovered without any config changes

---

## Phase 6: Polish & Validation

**Purpose**: End-to-end validation that the full suite works as specified.

- [x] T011 [P] Remove `.gitkeep` placeholder files from `tests/fixtures/`, `tests/e2e/`, `tests/smoke/`, `tests/unit/` if all stubs are now present in those directories
- [x] T012 Run full local validation: `pnpm lint && pnpm test:e2e && pnpm test:smoke && pnpm test:unit` — confirm all pass with clear output

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (needs fixture + playwright.config.ts)
- **US2 (Phase 4)**: Depends on Phase 2 (needs working test command); can run in parallel with US1
- **US3 (Phase 5)**: Depends on Phase 2 (needs fixture for smoke); can run in parallel with US1 and US2
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: No dependency on US2 or US3 — independently deliverable after Phase 2
- **US2 (P2)**: No dependency on US1 or US3 — CI workflow stands alone; references test script
- **US3 (P3)**: No dependency on US1 or US2 — scaffold is independent; smoke fixture reuses extension fixture

### Within Each Phase

- T004, T005, T006 in Phase 2: T005 is parallel with T004; T006 depends on T004 (uses playwright import patterns)
- T009, T010 in Phase 5: Fully parallel (different files)

---

## Parallel Example: Phase 2 Foundational

```bash
# Launch in parallel (T004 and T005 touch different files):
Task: "Create playwright.config.ts"          # T004
Task: "Create vitest.config.ts"              # T005 [P]

# Then sequentially (T006 imports from playwright.config patterns):
Task: "Create tests/fixtures/extension.ts"  # T006
```

## Parallel Example: Phase 5 User Story 3

```bash
# Launch in parallel (different files, no dependencies):
Task: "Create tests/smoke/extension-loads.spec.ts"  # T009 [P] [US3]
Task: "Create tests/unit/example.spec.ts"           # T010 [P] [US3]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (T007)
4. **STOP and VALIDATE**: Run `pnpm test:e2e` — extension loads, popup renders, test passes
5. Demo: developer can run one command and get a green e2e result

### Incremental Delivery

1. Setup + Foundational → test infra ready
2. US1 → e2e works locally (MVP)
3. US2 → CI gates active on every PR
4. US3 → scaffold complete for future test adoption
5. Polish → full suite verified end-to-end

### Parallel Team Strategy

With two developers after Phase 2:
- Developer A: US1 (T007) + Polish
- Developer B: US2 (T008) + US3 (T009, T010) — all independent of US1

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Extension source in `extension/` is unchanged by this feature
- After T001, run `pnpm exec playwright install chromium` before running any e2e test
- ESLint config (`eslint.config.mjs`) is already present — no ESLint setup task needed
- `headless: false` in playwright.config.ts is intentional and required for extension loading
- Background service worker is not directly tested; popup behavior validates indirectly
