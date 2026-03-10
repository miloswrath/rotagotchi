# Feature Specification: Chrome Extension Testing Suite

**Feature Branch**: `002-extension-testing-suite`
**Created**: 2026-03-10
**Status**: Draft
**Input**: User description: "Full and modern testing suite for testing the extension using Playwright, e2e tests, GitHub Actions CI on PR to main, and basic structure for unit and smoke tests"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run E2E Tests Against the Extension (Priority: P1)

A developer wants to verify the core extension flow works end-to-end after making
changes. They run a single command that launches the extension in a real browser
context, exercises the key user journey (commit received → watch gate displayed
→ time accrued → gate cleared), and reports pass/fail.

**Why this priority**: Without a working e2e test, there is no automated regression
safety for the extension's primary enforcement flow. This is the foundation of the
testing suite.

**Independent Test**: Can be fully tested by running the e2e suite locally and
confirming it exercises the extension's core enforcement flow in a real browser,
returning a clear pass/fail result with no manual steps required.

**Acceptance Scenarios**:

1. **Given** a developer has the repo cloned and dependencies installed,
   **When** they run the e2e test command,
   **Then** the extension is loaded in a browser, the core flow is exercised, and
   results are printed with pass/fail status.
2. **Given** the core enforcement flow is broken (e.g., watch gate never appears),
   **When** the e2e test runs,
   **Then** the test fails with a clear error message identifying which step failed.
3. **Given** the e2e test suite passes,
   **When** a developer reviews output,
   **Then** each test step is labeled and the overall pass/fail is unambiguous.

---

### User Story 2 - Automated Quality Gate on PRs to Main (Priority: P2)

When a developer opens a pull request targeting the main branch, GitHub Actions
automatically runs the full e2e test suite and ESLint checks. The PR is blocked
from merging until both pass.

**Why this priority**: Without CI enforcement, broken code and lint violations
can reach main. This gives the team automated confidence without manual review
overhead.

**Independent Test**: Can be fully tested by opening a PR to main and verifying
that the Actions workflow runs, reports status checks, and blocks/allows merge
accordingly.

**Acceptance Scenarios**:

1. **Given** a developer opens a PR to main,
   **When** the PR is created or updated,
   **Then** a GitHub Actions workflow starts automatically and runs e2e tests
   and ESLint.
2. **Given** the e2e tests or ESLint fail in CI,
   **When** the workflow completes,
   **Then** the PR status check is marked failing and merge is blocked.
3. **Given** all checks pass,
   **When** the workflow completes,
   **Then** the PR status check is marked passing and merge is unblocked.
4. **Given** the CI workflow runs,
   **When** a developer views the Actions log,
   **Then** e2e results and lint results are reported as separate, labeled steps.

---

### User Story 3 - Scaffold for Unit and Smoke Tests (Priority: P3)

A developer adding a new feature can immediately find a designated location and
example structure for writing unit tests and smoke tests, without needing to
decide on a directory layout or boilerplate themselves.

**Why this priority**: The scaffold has no immediate test coverage value on its
own but removes friction for future test adoption. It is lower priority than the
working e2e and CI gate.

**Independent Test**: Can be fully tested by verifying the directory structure
exists, that example/stub test files are present in each category, and that a
developer can add a new test file and have it recognized by the test runner.

**Acceptance Scenarios**:

1. **Given** a developer wants to write a unit test for a new module,
   **When** they look at the repo structure,
   **Then** there is a clearly named directory for unit tests with at least one
   example stub they can copy.
2. **Given** a developer wants to write a smoke test for a new feature,
   **When** they look at the repo structure,
   **Then** there is a clearly named directory for smoke tests with at least one
   example stub.
3. **Given** a developer creates a new test file in the unit or smoke directory,
   **When** they run the test command,
   **Then** the new test is automatically discovered and executed.

---

### Edge Cases

- What happens if the extension build fails before e2e tests run? (CI should
  fail fast at the build step with a clear message before tests start.)
- What happens when e2e tests are flaky due to timing in a headless CI
  environment? (Tests MUST include explicit wait conditions; flaky tests fail
  the suite until fixed.)
- What if ESLint and e2e run in parallel and one completes much earlier?
  (Both MUST report independently; the PR is only unblocked when both pass.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The test suite MUST include at least one end-to-end test that
  exercises the extension's core enforcement flow in a real browser context.
- **FR-002**: E2E tests MUST load the locally built extension, not a mock or
  stub, to ensure real extension behavior is validated.
- **FR-003**: A single command MUST be available to run all e2e tests locally
  without additional manual setup steps after initial install.
- **FR-004**: A GitHub Actions workflow MUST trigger on every pull request
  targeting the main branch.
- **FR-005**: The CI workflow MUST run the full e2e test suite as a required
  status check before merging.
- **FR-006**: The CI workflow MUST run ESLint as a required status check before
  merging.
- **FR-007**: E2E and ESLint checks MUST be reported as separate, named status
  checks on the PR.
- **FR-008**: The repository MUST include a designated directory structure for
  unit tests, with at least one example stub file.
- **FR-009**: The repository MUST include a designated directory structure for
  smoke tests, with at least one example stub file.
- **FR-010**: Any test file added to the unit or smoke directories MUST be
  automatically discovered and run by the test runner without configuration
  changes.

### Assumptions

- The Chrome extension already has a build process that produces a loadable
  extension artifact.
- ESLint is already configured in the project (or a standard configuration
  will be added as part of this feature).
- The CI environment will support running a headed or headless browser for
  Playwright e2e tests.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can run all e2e tests with a single command and
  receive a clear pass/fail result within 5 minutes on a standard development
  machine.
- **SC-002**: Every PR opened against main automatically receives e2e and
  ESLint status checks — 100% of PRs, without any manual trigger required.
- **SC-003**: A broken core extension flow is caught by the e2e suite before
  the PR can be merged — zero broken core flows reach main after the suite
  is established.
- **SC-004**: A developer adding a new feature can locate the correct test
  directory and copy an example stub to write their first test in under
  2 minutes, without reading external documentation.
- **SC-005**: The CI pipeline completes e2e and lint checks in under 10 minutes
  on a standard GitHub-hosted runner.
