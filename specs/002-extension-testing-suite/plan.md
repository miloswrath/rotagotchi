# Implementation Plan: Chrome Extension Testing Suite

**Branch**: `002-extension-testing-suite` | **Date**: 2026-03-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-extension-testing-suite/spec.md`

## Summary

Establish a full testing suite for the Rotagotchi Chrome MV3 extension using Playwright
for e2e and smoke tests, Vitest for unit test scaffolding, and a GitHub Actions workflow
that enforces ESLint + e2e as required status checks on every PR to main.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20 (matches existing project)
**Primary Dependencies**: `@playwright/test` (e2e + smoke), `vitest` (unit stubs), ESLint 9 (existing)
**Storage**: N/A — testing infrastructure only
**Testing**: `@playwright/test` for e2e/smoke; `vitest` for unit
**Target Platform**: Chrome MV3 extension (Chromium-based), GitHub Actions ubuntu-latest
**Project Type**: Test infrastructure / chrome-extension
**Performance Goals**: E2E suite completes in < 5 min locally; CI pipeline completes in < 10 min
**Constraints**: Must use pnpm; extension loaded as unpacked via `--load-extension`; `headless: false` required for extension support
**Scale/Scope**: 1 e2e core flow spec, 1 smoke spec, 1 unit stub; scaffold for future additions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature adds testing infrastructure — it does not modify the extension's enforcement
logic. All constitution principles are either not applicable or actively supported by
this feature.

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Commit-Triggered Enforcement | ✅ PASS | Not modified; e2e tests will validate this flow once implemented |
| II. Proportional Degenerative Time | ✅ PASS | Not modified by testing infrastructure |
| III. Mandatory Watch Gate | ✅ PASS | Not modified; e2e spec validates the gate once implemented |
| IV. Avatar Vitality Coupling | ✅ PASS | Not modified |
| V. Deterministic Activity Classification | ✅ PASS | Not modified |
| Governance: constitution check in plan | ✅ PASS | This section |
| Governance: compliance review | ✅ PASS | No violations; no justification/mitigation required |

**Post-design re-check**: All contracts and test structure align with Principle V
(allow/deny list classification is auditable — tests will document expected classification
behavior). No violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/002-extension-testing-suite/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── test-runner-contract.md   # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
extension/                        # Existing — unchanged
├── manifest.json
├── background.js
├── content.js
├── popup.html
└── popup.js

tests/                            # NEW — test suite root
├── fixtures/
│   └── extension.ts              # Shared Playwright extension context fixture
├── e2e/
│   └── extension.spec.ts         # Core extension flow e2e test
├── smoke/
│   └── extension-loads.spec.ts   # Extension loads and popup renders smoke test
└── unit/
    └── example.spec.ts           # Unit test stub (copy template for new tests)

playwright.config.ts              # NEW — Playwright configuration (two projects: e2e, smoke)
vitest.config.ts                  # NEW — Vitest configuration (unit tests)

.github/
└── workflows/
    └── pr-checks.yml             # NEW — CI: lint + e2e jobs on PR to main
```

**Structure Decision**: Single-project layout at repo root. Test directories are separate
from extension source. Playwright config at root for easy CLI access. Vitest config at root
alongside Playwright config.

## Complexity Tracking

> No constitution violations — section left empty per governance rules.
