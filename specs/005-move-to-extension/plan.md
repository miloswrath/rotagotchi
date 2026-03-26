# Implementation Plan: Move Tamagotchi Logic to Browser Extension

**Branch**: `005-move-to-extension` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-move-to-extension/spec.md`

## Summary

Migrate the tamagotchi's lottie animation rendering into the Chrome extension popup and add real-time tab URL monitoring that classifies the active tab against the degenerative-content list (`lib/whitelist.json`). The pet displays the `angry` animation when the user is on a blacklisted (degenerative) site, and the `idle` animation otherwise. The background service worker handles URL events; the popup renders lottie animations driven by `chrome.storage.session` state.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20; extension files transpiled from TypeScript to JavaScript via esbuild
**Primary Dependencies**: `lottie-web` (animation renderer, bundled into extension), `esbuild` (extension build tool, dev dependency), existing `lottie-react` v2.4.1 (unchanged, Next.js app only)
**Storage**: `chrome.storage.session` (volatile tab state), `chrome.storage.local` (persistent blacklist), no Supabase involvement
**Testing**: Vitest 3 (unit — classification logic), Playwright 1.50 (E2E — extension popup and tab switching)
**Target Platform**: Chrome / Chromium, Manifest v3
**Project Type**: Browser extension (popup + service worker)
**Performance Goals**: Pet animation state updates within 1 second of tab switch
**Constraints**: MV3 CSP prohibits remote script loading — all assets must be bundled; extension must work offline
**Scale/Scope**: Single-user local extension; no concurrent users or network calls in this feature

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Commit-Triggered Enforcement | ✅ PASS | This feature does not modify commit triggering; it is rendering infrastructure |
| II — Proportional Degenerative Time | ✅ PASS | Time calculation unchanged; not in scope |
| III — Mandatory Watch Gate | ✅ PASS | Gate enforcement unchanged; not in scope |
| IV — Avatar Vitality Coupling | ✅ PASS | Animation rendering is the surface layer; vitality remains coupled to watch time as defined in the state model |
| V — Deterministic Activity Classification | ✅ PASS | This feature directly implements Principle V: explicit blacklist, blacklist-takes-precedence rule, unknowns default to neutral, all rules documented in `data-model.md` and `contracts/extension-messaging.md` |
| Operational Policy — Content Lists | ✅ PASS | `lib/whitelist.json` is version-controlled; classification rules are auditable |
| Monitoring Scope | ✅ PASS | Only `url` and `hostname` are captured; page contents are never logged |

**No violations. No complexity justification required.**

**Post-design re-check**: Constitution Principle V is the direct driver for the classification engine designed in Phase 1. The blacklist-precedence rule and neutral default are encoded in both the data model and the messaging contract.

## Project Structure

### Documentation (this feature)

```text
specs/005-move-to-extension/
├── plan.md                          # This file
├── spec.md                          # Feature specification
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   └── extension-messaging.md       # Phase 1 output
├── checklists/
│   └── requirements.md              # Spec quality checklist
└── tasks.md                         # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
extension/
├── manifest.json          # Update: add 'tabs' permission, web_accessible_resources
├── popup.html             # Update: add animation container div
├── src/
│   ├── background.ts      # Replace background.js: tab monitoring + classification
│   ├── popup.ts           # Replace popup.js: lottie-web rendering
│   └── classify.ts        # New: URL classification engine (isUnproductive())
├── dist/                  # Build output (gitignored)
│   ├── background.js
│   ├── popup.js
│   └── animations/        # Lottie JSON files copied from /rot/ at build time
│       ├── idle.json
│       └── angry.json

lib/
└── whitelist.json          # Existing: default blacklist seed (unchanged)

rot/
├── idle.json               # Existing: source lottie asset
├── angry.json              # Existing: source lottie asset
└── [others]                # Available for future feature expansion

tests/
├── unit/
│   └── classify.spec.ts    # New: unit tests for classification logic
└── e2e/
    └── extension.spec.ts   # Existing: extend with animation state checks
```

**Structure Decision**: Single project layout. The extension is a subdirectory within the monorepo. A new `src/` subdirectory inside `extension/` holds the TypeScript source; esbuild compiles to `extension/dist/`. This keeps TypeScript sources separate from build artifacts and avoids polluting the extension root with both `.ts` and compiled `.js` files.

## Complexity Tracking

> No constitution violations — this section is not required.
