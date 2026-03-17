# Tasks: Initialize Global State Logic

**Input**: Design documents from `/specs/004-tamagotchi-state-logic/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in all descriptions

## Path Conventions

Single-project layout (per plan.md):
- State logic: `lib/state/`
- Tests: `tests/unit/state/`
- App root: `app/layout.tsx`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure and confirm existing file layout before writing any source files.

- [x] T001 Create `lib/state/` directory in the repository root (no source files yet — structure only)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the state type, constants, and pure utility function that every user story depends on. Nothing else can be built until this type contract exists.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Define `TamagotchiState` interface, `HEALTH_MIN` (0), `HEALTH_MAX` (100), `HEALTH_DEFAULT` (100) constants, and pure `clampHealth(value: number): number` utility in `lib/state/tamagotchi.ts`

**Checkpoint**: `lib/state/tamagotchi.ts` exports `TamagotchiState`, `HEALTH_MIN`, `HEALTH_MAX`, `HEALTH_DEFAULT`, and `clampHealth` — all user story phases can now begin.

---

## Phase 3: User Story 1 — Application Boots with Initialized Tamagotchi Health (Priority: P1) 🎯 MVP

**Goal**: The application initializes with `state.health = 100` in global state on every load. Any component can read this value. No write interface yet.

**Independent Test**: Mount the app, call `useTamagotchi()` in any child component, and confirm `state.health === 100` without any user action.

### Implementation for User Story 1

- [x] T003 [US1] Create `TamagotchiContext` (typed `TamagotchiContextValue | null`) and `TamagotchiProvider` component that initializes state with `{ health: HEALTH_DEFAULT }` using `useState` in `lib/state/store.tsx` — do NOT import any animation component
- [x] T004 [US1] Implement `useTamagotchi()` hook in `lib/state/store.tsx` that reads `TamagotchiContext` and throws `Error: useTamagotchi must be used within TamagotchiProvider` if context is null (depends on T003)
- [x] T005 [P] [US1] Wrap `{children}` with `<TamagotchiProvider>` in `app/layout.tsx` — import only from `lib/state/store` (depends on T003; parallel with T004)
- [x] T006 [P] [US1] Write unit test in `tests/unit/state/tamagotchi.spec.ts` asserting `useTamagotchi().state.health === 100` after provider mount (depends on T004; parallel with T005)

**Checkpoint**: US1 complete — `state.health` is `100` on boot, readable via `useTamagotchi()`, provider mounted at app root. Test passes.

---

## Phase 4: User Story 2 — Health State Can Be Read and Updated Programmatically (Priority: P2)

**Goal**: Any module can call `updateHealth(delta)` to change health (clamped to 0–100) and `resetHealth()` to restore it to 100. All changes go through the context interface — no direct mutation.

**Independent Test**: Call `updateHealth(-150)` on full health and confirm health clamps to 0. Call `resetHealth()` and confirm health returns to 100.

### Implementation for User Story 2

- [x] T007 [US2] Add `updateHealth(delta: number): void` to `TamagotchiContextValue` in `lib/state/store.tsx` — implementation uses `clampHealth(prev.health + delta)` from `lib/state/tamagotchi.ts` (depends on T004)
- [x] T008 [US2] Add `resetHealth(): void` to `TamagotchiContextValue` in `lib/state/store.tsx` — sets health to `HEALTH_DEFAULT` unconditionally (depends on T007)
- [x] T009 [P] [US2] Extend unit tests in `tests/unit/state/tamagotchi.spec.ts` with five cases: `updateHealth(+50)` on full health clamps to 100; `updateHealth(-150)` on 50 clamps to 0; `updateHealth(-10)` on 50 yields 40; `resetHealth()` from 0 restores to 100; `useTamagotchi()` outside provider throws (depends on T008; parallel with any non-store work)

**Checkpoint**: US2 complete — `updateHealth` and `resetHealth` exposed on context, bounds enforced, all unit tests pass.

---

## Phase 5: User Story 3 — Global State Structure Supports Future Mechanic Fields (Priority: P3)

**Goal**: The `TamagotchiState` type reserves optional typed slots for `hunger` and `websiteDebt`. Adding those fields in a future feature requires only one change (the interface) — no changes to existing health consumers.

**Independent Test**: Add `hunger?: number` and `websiteDebt?: number` to the interface, run TypeScript type-check, confirm zero errors and zero changes required in `lib/state/store.tsx` or any consumer.

### Implementation for User Story 3

- [x] T010 [US3] Add `hunger?: number` and `websiteDebt?: number` optional fields to `TamagotchiState` interface in `lib/state/tamagotchi.ts` — fields remain `undefined` in `initialTamagotchiState`; export updated `initialTamagotchiState` constant (depends on T002)
- [x] T011 [US3] Run `npx tsc --noEmit` from repo root and confirm zero TypeScript errors — verifying existing health consumers in `lib/state/store.tsx` and `app/layout.tsx` require no changes after the optional field addition (depends on T010)

**Checkpoint**: US3 complete — state shape is extensible; TypeScript confirms zero breakage.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, animation isolation audit, and full test suite run.

- [x] T012 [P] Audit `lib/state/store.tsx` and `lib/state/tamagotchi.ts` for any imports from the animation layer (`IdlePet`, `lottie-react`, `app/components/`) — confirm none exist (FR-007 / SC-005 compliance)
- [x] T013 Run `npm test && npm run lint` from repo root to confirm all unit tests pass and linting is clean

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 3 completion (needs `useTamagotchi` hook from T004)
- **US3 (Phase 5)**: Depends on Phase 2 completion — can start after T002, independent of US1/US2
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Blocked by Foundational (T002 only)
- **US2 (P2)**: Blocked by US1 completion (needs `useTamagotchi` hook, T004)
- **US3 (P3)**: Blocked by T002 only — can proceed in parallel with US1 after Phase 2

### Within Each User Story

- Models/types before services/providers
- Provider before hook (T003 → T004)
- Hook before tests (T004 → T006, T008 → T009)
- Implementation complete before type-check validation (T010 → T011)

### Parallel Opportunities

- **T005 and T004**: Different files (`app/layout.tsx` vs `lib/state/store.tsx`), both depend only on T003 ✅
- **T006 and T005**: Different files (`tests/unit/…` vs `app/layout.tsx`), T006 depends on T004 ✅
- **T012 and others in Phase 6**: Audit is read-only, can run alongside T013 ✅
- **US3 (T010–T011) and US1 (T003–T006)**: Both depend only on T002; can run in parallel if staffed ✅

---

## Parallel Example: User Story 1

```bash
# After T003 completes, launch T004 and T005 in parallel:
Task A: "Implement useTamagotchi() hook in lib/state/store.tsx"  (T004)
Task B: "Mount TamagotchiProvider in app/layout.tsx"             (T005)

# After T004 completes, T006 can run in parallel with T005 (if T005 not yet done):
Task: "Write unit test: initial health = 100"                    (T006)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002)
3. Complete Phase 3: User Story 1 (T003–T006)
4. **STOP and VALIDATE**: `npm run test:unit` — confirm initial health test passes
5. Ship/demo: provider mounted, health readable, animation untouched

### Incremental Delivery

1. Setup + Foundational → type contract ready
2. US1 → app boots with health, hook available → MVP demo ready
3. US2 → health writable, bounds enforced → mechanics can now be wired in
4. US3 → state shape extensible → future commit/website mechanics can add fields cleanly
5. Polish → full suite green

### Parallel Team Strategy

After T002:
- **Developer A**: US1 (T003 → T004 → T005 + T006)
- **Developer B**: US3 (T010 → T011) — no conflict with Developer A's files

US2 starts after Developer A completes US1.

---

## Notes

- [P] tasks touch different files and have no dependency on incomplete sibling tasks
- [Story] labels map each task to spec.md user stories for traceability
- Do NOT add Redux, Zustand, or any state library — React Context only
- Do NOT import animation components (`IdlePet`, `lottie-react`) in `lib/state/`
- `hunger` and `websiteDebt` fields must remain `undefined` — add type slots only, no read/write logic
- Commit after each checkpoint (end of each phase)
