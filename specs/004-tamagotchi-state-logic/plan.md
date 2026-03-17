# Implementation Plan: Initialize Global State Logic

**Branch**: `004-tamagotchi-state-logic` | **Date**: 2026-03-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-tamagotchi-state-logic/spec.md`

---

## Summary

Introduce a React Context-based global state container for tamagotchi health in the Next.js web app. Health initializes to 100 on every load, is bounded to [0, 100] via a clamped write interface, and exposes a typed hook for all future mechanics to consume. The animation layer is not connected. No third-party state library is added.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20
**Primary Dependencies**: Next.js 16 (App Router), React 19, Vitest 3, Playwright 1.50
**Storage**: N/A — no persistence in this feature
**Testing**: Vitest (unit), Playwright (smoke)
**Target Platform**: Browser — Next.js web app (Chrome)
**Project Type**: Web application
**Performance Goals**: State reads/writes are synchronous; sub-millisecond in all cases
**Constraints**: No animation coupling (FR-007); no new state management library; no Supabase calls
**Scale/Scope**: Single-user, single-session state; health is one numeric field with two future reserved slots

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicability | Status | Notes |
|-----------|--------------|--------|-------|
| I — Commit-Triggered Enforcement | Indirect | PASS | This feature establishes the health state that commit events will modify in future. No enforcement flow implemented here. |
| II — Proportional Degenerative Time | Not in scope | PASS | Time-to-commit mapping is a future feature; `hunger` slot reserved in state shape. |
| III — Mandatory Watch Gate | Not in scope | PASS | Watch gate is a future feature; `websiteDebt` slot reserved. |
| IV — Avatar Vitality Coupling | Foundation | PASS | Health state is initialized here. Coupling to watch-time events is explicitly deferred. Animation layer is NOT connected (satisfies FR-007). |
| V — Deterministic Activity Classification | Not in scope | PASS | No tab classification logic introduced. |

**Post-design re-check**: All principles continue to pass. The state interface contract documents that `hunger` and `websiteDebt` are inactive, and no animation imports exist in `lib/state/`.

---

## Project Structure

### Documentation (this feature)

```text
specs/004-tamagotchi-state-logic/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── state-interface.md   # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code (repository root)

```text
lib/
└── state/
    ├── tamagotchi.ts    # TamagotchiState type, constants, clampHealth util
    └── store.tsx        # TamagotchiProvider, TamagotchiContext, useTamagotchi hook

tests/
└── unit/
    └── state/
        └── tamagotchi.spec.ts   # Unit tests for state logic and hook contract

app/
└── layout.tsx           # Mount TamagotchiProvider (modification to existing file)
```

**Structure Decision**: Single-project layout extending the existing `lib/` pattern. All state logic is in `lib/state/` to keep it decoupled from the UI layer and independently testable. The provider is mounted at the root layout so all child components can access state via `useTamagotchi()`.

---

## Complexity Tracking

No constitution violations require justification.
