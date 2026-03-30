# Tasks: Extension Game Logic

**Input**: Design documents from `/specs/007-extension-game-logic/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Manifest permissions, build script, and shared type definitions that every user story depends on.

- [x] T001 Add `"alarms"` and `"notifications"` to the `permissions` array in `extension/manifest.json`
- [x] T002 [P] Add copy steps for `rot/excited.json`, `rot/death.json`, and `rot/starving.json` → `extension/dist/animations/` in `scripts/build-extension.js`
- [x] T003 [P] Expand `TamagotchiState` and add `AnimationState = 'idle' | 'starving' | 'angry' | 'excited' | 'dead'` export in `lib/state/tamagotchi.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data types and storage helpers that ALL user story phases depend on. No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: Complete before starting any Phase 3+ work.

- [x] T004 Create `extension/src/game.ts`: define `GameState` interface, `DEFAULT_GAME_STATE` constant, and all exported numeric constants (`DEBT_SECONDS_PER_LINE`, `DEBT_MAX_SECONDS`, drain/gain rates, `TICK_INTERVAL_*`, `IMMEDIATE_FEED_WINDOW_MS`, health thresholds) per `specs/007-extension-game-logic/data-model.md`
- [x] T005 [P] Add `TickContext`, `TickResult`, and `CommitRecord` interfaces to `extension/src/game.ts` per `specs/007-extension-game-logic/data-model.md`
- [x] T006 [P] Create `extension/src/notifications.ts`: define `PendingNotification` interface and notification ID constants (`NOTIF_HUNGER = 'rotagotchi-hunger'`, `NOTIF_SATIATED = 'rotagotchi-satiated'`) per `specs/007-extension-game-logic/contracts/message-protocol.md`
- [x] T007 Implement `readGameState(): Promise<GameState>` and `writeGameState(state: GameState): Promise<void>` in `extension/src/game.ts` using `chrome.storage.local`; `readGameState` returns `DEFAULT_GAME_STATE` if key is absent

**Checkpoint**: Foundation ready — all interfaces and storage helpers defined. User story phases can now begin.

---

## Phase 3: User Story 1 — Commit Triggers Health Debt Notification (Priority: P1) 🎯 MVP

**Goal**: Detect new commits from Supabase each tick, calculate health debt proportional to diff size, and fire a desktop hunger notification. This is the core game trigger.

**Independent Test**: With a valid Supabase session, insert a row into `commit_events` for the current user and wait one tick. Verify `gameState.debtSeconds > 0` in `chrome.storage.local` and a Chrome notification appears with the hunger message.

- [x] T008 [P] [US1] Implement `calculateDebt(diffSize: number): number` in `extension/src/game.ts`: returns `Math.min(diffSize * DEBT_SECONDS_PER_LINE, DEBT_MAX_SECONDS)`; when added to existing debt, total is capped at `DEBT_MAX_SECONDS`
- [x] T009 [P] [US1] Implement `sendHungerNotification(diffSize: number, debtSeconds: number): Promise<void>` and `sendSatiatedNotification(): Promise<void>` in `extension/src/notifications.ts` using `chrome.notifications.create()` with stable IDs per `specs/007-extension-game-logic/contracts/message-protocol.md`
- [x] T010 [US1] Implement `fetchNewCommits(session: StoredAuthSession, sinceMs: number | null): Promise<CommitRecord[]>` in `extension/src/game.ts`: Supabase query per `specs/007-extension-game-logic/contracts/supabase-queries.md`; returns `[]` on error (log to console, do not throw)
- [x] T011 [US1] Implement the commit-processing section of `processTick(ctx: TickContext): TickResult` in `extension/src/game.ts`: for each new commit accumulate debt via `calculateDebt()`, update `lastCommitSha`/`lastCommitAt`/`debtCreatedAt`, emit a `PendingNotification` of type `'hunger'`; return `TickResult` with updated `nextState` and `notifications`
- [x] T012 [US1] Add `ensureGameStateInitialized()` to `extension/src/background.ts` (writes `DEFAULT_GAME_STATE` if `gameState` absent), call it from `chrome.runtime.onInstalled` and on startup; create `chrome.alarms` alarm `'game-tick'` with `periodInMinutes: 1` if not already scheduled
- [x] T013 [US1] Implement `runGameTick()` and `chrome.alarms.onAlarm` handler in `extension/src/background.ts`: reads `gameState` + `tabState` + `blacklist` from storage, calls `getValidSession()`, calls `fetchNewCommits()`, builds `TickContext`, calls `processTick()`, writes `nextState` to storage, fires all `PendingNotification` entries via `sendHungerNotification`/`sendSatiatedNotification` per `specs/007-extension-game-logic/contracts/message-protocol.md`
- [x] T014 [US1] Unit tests for `calculateDebt()`: 100 lines → 200s; 0 lines → 0s; accumulation caps at `DEBT_MAX_SECONDS` in `tests/unit/game.spec.ts`

**Checkpoint**: US1 complete — new commits detected, debt calculated, hunger notification fires within one tick.

---

## Phase 4: User Story 2 — Health Drain and Blacklist Enforcement (Priority: P2)

**Goal**: Health drains every tick based on debt state × site classification. Death triggers at health = 0 with a restart path.

**Independent Test**: Set `gameState.debtSeconds = 300` and `tabState.classification = 'neutral'` in `chrome.storage.local`. Wait several ticks. Verify `gameState.health` decreases by `DRAIN_NEUTRAL_WITH_DEBT` per tick. Then drain health to 0 and verify `gameState.alive === false` and `gameState.animationState === 'dead'`.

- [x] T015 [US2] Extend `processTick()` in `extension/src/game.ts` with full HP delta logic: apply drain/gain rates from data-model.md for all four classification × debt combinations; clamp `health` to `[0, 100]` using `clampHealth()`; set `alive = false` and `animationState = 'dead'` when `health` hits 0
- [x] T016 [P] [US2] Implement `deriveAnimationState(health: number): AnimationState` in `extension/src/game.ts` using `HEALTH_IDLE_THRESHOLD`, `HEALTH_STARVING_THRESHOLD`, `HEALTH_ANGRY_THRESHOLD`; call it inside `processTick()` to update `gameState.animationState` each tick (unless `'excited'` override is active)
- [x] T017 [US2] Handle `RESTART_GAME` message in `chrome.runtime.onMessage` in `extension/src/background.ts`: write `DEFAULT_GAME_STATE` to storage, cancel existing `'game-tick'` alarm and recreate it with default period per `specs/007-extension-game-logic/contracts/message-protocol.md`
- [x] T018 [US2] Unit tests for `processTick()` drain cases in `tests/unit/game.spec.ts`: neutral + debt → −3 HP; degenerative + debt → −1 HP; neutral no debt → −0.5 HP; health clamps at 0; `alive` set false at 0; `animationState` maps correctly at 80/55/25/0

**Checkpoint**: US2 complete — health drains correctly per tick, death state triggers, restart resets state.

---

## Phase 5: User Story 3 — Degenerative Content Watching Restores Health (Priority: P2)

**Goal**: Visiting degenerative sites decrements debt clock and restores health. Immediate response after notification grants a bonus boost. Satiated notification fires when debt clears.

**Independent Test**: Set `gameState.debtSeconds = 120` and `tabState.classification = 'degenerative'`. Run ticks and verify `debtSeconds` decreases by `elapsedMs / 1000` per tick. Set `debtCreatedAt` within `IMMEDIATE_FEED_WINDOW_MS` and verify one-time +15 HP bonus applied. Let `debtSeconds` reach 0 and verify a `'satiated'` notification is emitted.

- [x] T019 [US3] Implement debt clock decrement in `processTick()` in `extension/src/game.ts`: when `classification === 'degenerative'`, subtract `ctx.elapsedMs / 1000` from `debtSeconds`; floor at 0
- [x] T020 [US3] Implement immediate feed bonus in `processTick()` in `extension/src/game.ts`: if `classification === 'degenerative'` and `debtCreatedAt` is within `IMMEDIATE_FEED_WINDOW_MS`, apply `GAIN_IMMEDIATE_FEED_BONUS` HP one time (guard with a `bonusApplied` flag in state or by clearing `debtCreatedAt` after first application); set `animationState = 'excited'` for `EXCITED_DURATION_MS`
- [x] T021 [US3] Implement satiated notification emission in `processTick()` in `extension/src/game.ts`: when `debtSeconds` transitions from `> 0` to `<= 0` in a single tick, push a `PendingNotification` of type `'satiated'`; clear `debtCreatedAt` and `notifiedAt`
- [x] T022 [US3] Unit tests in `tests/unit/game.spec.ts`: debt clock decrements by elapsedMs/1000; immediate bonus applies once within window; satiated notification emitted on debt clear; no double satiated notification on subsequent ticks

**Checkpoint**: US3 complete — health recovery, debt clearing, and satiated notification all work end-to-end.

---

## Phase 6: User Story 4 — Status Visibility in Extension Popup (Priority: P3)

**Goal**: Extension popup clearly shows health bar, hunger/satiated indicator, and death overlay for every game state.

**Independent Test**: Manually set `gameState` in `chrome.storage.local` to each of: healthy (health=100, debt=0), hungry (health=60, debt=300), distressed (health=20, debt=300), dead (alive=false). Open popup and verify health bar width, status indicator label, and death overlay visibility are correct for each state.

- [x] T023 [US4] Add health bar container, status indicator, death overlay (with restart button), and settings panel toggle structure to `extension/popup.html` per `specs/007-extension-game-logic/plan.md` — all new elements hidden or default-styled initially
- [x] T024 [US4] Implement `updateFromGameState(state: GameState): void` in `extension/src/popup.ts`: sets health bar `width` style as `${state.health}%`; sets health label text; sets status indicator text (`'HUNGRY'` / `'SATIATED'` / `'DEAD'`) and CSS class; toggles death overlay visibility based on `state.alive`
- [x] T025 [US4] Subscribe to `chrome.storage.onChanged` for area `'local'` in `extension/src/popup.ts` on the main screen: if `changes.gameState` exists, call `updateFromGameState(changes.gameState.newValue)`
- [x] T026 [US4] Read initial `gameState` from `chrome.storage.local` when popup's main screen activates and call `updateFromGameState()` in `extension/src/popup.ts`

**Checkpoint**: US4 complete — popup accurately reflects live game state on open and on every tick.

---

## Phase 7: User Story 5 — Popup Character Speech (Priority: P3)

**Goal**: Character displays contextually appropriate speech bubble messages for every game state.

**Independent Test**: Set `gameState.animationState` to each of `'idle'`, `'starving'`, `'angry'`, `'dead'`. Open popup and verify speech bubble shows a non-empty string matching the expected tone for that state.

- [x] T027 [P] [US5] Implement `deriveSpeechMessage(animationState: AnimationState, debtSeconds: number): string` in `extension/src/game.ts` with messages for all five states per `specs/007-extension-game-logic/plan.md` Speech Messages section
- [x] T028 [US5] Update `processTick()` in `extension/src/game.ts` to call `deriveSpeechMessage()` and write result to `nextState.speechMessage` each tick
- [x] T029 [US5] Add speech bubble element to `extension/popup.html` and update `updateFromGameState()` in `extension/src/popup.ts` to set the bubble's `textContent` from `state.speechMessage`
- [x] T030 [US5] Wire restart button click handler in `extension/src/popup.ts`: `chrome.runtime.sendMessage({ type: 'RESTART_GAME' })` when restart button is clicked; hide death overlay optimistically

**Checkpoint**: US5 complete — speech bubble and restart button are functional across all states.

---

## Phase 8: User Story 6 — Tick Speed Slider for Demo (Priority: P3)

**Goal**: Settings slider adjusts tick rate from 1s to 60s; at max speed the tamagotchi can die in under 30 seconds for demos.

**Independent Test**: Open popup settings panel, move slider to minimum (500ms). Verify tick alarm period updates and health visibly changes faster. Return slider to maximum (60000ms) and verify tick rate reverts.

- [x] T031 [US6] Handle `SET_TICK_SPEED` message in `chrome.runtime.onMessage` in `extension/src/background.ts`: clamp `intervalMs` to `[TICK_INTERVAL_MIN_MS, TICK_INTERVAL_MAX_MS]`, write to `gameState.tickIntervalMs`, cancel `'game-tick'` alarm, recreate with `delayInMinutes: intervalMs / 60000` per `specs/007-extension-game-logic/contracts/message-protocol.md`
- [x] T032 [US6] Add gear toggle button and settings panel with tick speed `<input type="range">` (min=500, max=60000, step=500) and a tick label to `extension/popup.html`
- [x] T033 [US6] Implement slider `input` event handler in `extension/src/popup.ts`: reads slider value, updates tick label text (e.g., `"0.5s"` / `"60s"`), sends `{ type: 'SET_TICK_SPEED', intervalMs }` via `chrome.runtime.sendMessage()`
- [x] T034 [US6] In `updateFromGameState()` in `extension/src/popup.ts`: sync slider position and label to `state.tickIntervalMs` so it persists across popup opens

**Checkpoint**: US6 complete — tick speed slider adjusts game tempo; full death demo achievable in ≤30s at min interval.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Error resilience, excited animation override, and final validation.

- [x] T035 [P] Add `'excited'` animation override with `setTimeout` reset to health-derived state after `EXCITED_DURATION_MS` in `extension/src/popup.ts`; triggered when `updateFromGameState` receives `animationState === 'excited'`
- [x] T036 [P] Add try/catch around Supabase call in `runGameTick()` in `extension/src/background.ts`: log error, skip commit processing, continue tick drain (SC-006: auditable log of skipped events)
- [x] T037 [P] Add unauthenticated-state guard in `runGameTick()` in `extension/src/background.ts`: if `getValidSession()` returns null, skip `fetchNewCommits()`, continue tick drain/gain based on tab classification only
- [x] T038 [P] E2E test: open popup in default state → health bar is visible and non-empty in `tests/e2e/game-loop.spec.ts`
- [x] T039 [P] E2E test: manually set `gameState.health = 0`, `gameState.alive = false` in storage → open popup → death overlay visible → click restart → health bar returns to 100 in `tests/e2e/game-loop.spec.ts`
- [x] T040 Run `npm run build:extension && npm test && npm run lint` from repo root and verify all pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001, T002, T003 can all start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — T004 through T007 must complete before any US phase
- **US Phases (3–8)**: All depend on Phase 2 completion; US2+US3 may share `processTick()` edits — implement sequentially; US4+US5+US6 are independent of each other and can run in parallel
- **Polish (Phase 9)**: Depends on all US phases complete

### User Story Dependencies

- **US1 (P1)**: No story dependencies — start after Phase 2
- **US2 (P2)**: Extends US1's `processTick()` — implement after US1
- **US3 (P2)**: Extends US1+US2's `processTick()` — implement after US2
- **US4 (P3)**: Depends on US1 (gameState exists in storage) — can start after US1
- **US5 (P3)**: Depends on US1 (animationState on gameState) — can start after US1; T027 can parallelize with US4
- **US6 (P3)**: Depends on Phase 2 (storage helpers) — independent of US4/US5; can start after Phase 2

### Within Each User Story

- Interfaces/constants before implementations
- `game.ts` pure functions before `background.ts` orchestration
- `background.ts` message handlers after pure functions
- `popup.html` structure before `popup.ts` DOM wiring
- Tests can be written before or alongside implementation tasks

### Parallel Opportunities

- T001, T002, T003 (Phase 1) — all parallel
- T004, T005, T006 (Phase 2) — T005+T006 parallel after T004
- T008, T009 (Phase 3) — parallel
- T015, T016 (Phase 4) — T016 parallel with T015
- T027 (Phase 7) — parallel with any US4 task
- T031, T032 (Phase 8) — parallel
- T035, T036, T037, T038, T039 (Phase 9) — all parallel

---

## Parallel Example: User Story 1

```bash
# Start these together after Phase 2 completes:
Task T008: Implement calculateDebt() and deriveAnimationState() in extension/src/game.ts
Task T009: Implement sendHungerNotification() and sendSatiatedNotification() in extension/src/notifications.ts

# Then sequentially:
Task T010: Implement fetchNewCommits() in extension/src/game.ts
Task T011: Implement commit section of processTick() in extension/src/game.ts
Task T012: Wire alarm init in extension/src/background.ts
Task T013: Implement runGameTick() in extension/src/background.ts
Task T014: Unit tests in tests/unit/game.spec.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T007) — CRITICAL
3. Complete Phase 3: US1 (T008–T014)
4. **STOP and VALIDATE**: Insert a commit row into Supabase, wait one tick, verify notification fires
5. Extension is functional at MVP — game loop exists, debt is created, user is notified

### Incremental Delivery

1. Setup + Foundational → storage and types ready
2. **US1** → commit detection + notifications (MVP)
3. **US2** → health drain + death/restart
4. **US3** → health recovery + satiated notification (completes core loop)
5. **US4** → popup status visibility
6. **US5** → character speech
7. **US6** → tick speed slider (demo-ready)
8. Polish → error handling + e2e tests + build validation

### Parallel Team Strategy

After Phase 2:
- Developer A: US1 → US2 → US3 (game.ts + background.ts, sequentially)
- Developer B: US4 → US5 → US6 (popup.html + popup.ts, largely independent)

---

## Notes

- `processTick()` in `extension/src/game.ts` is the most critical function — US1, US2, and US3 all add to it sequentially. Implement it section-by-section rather than in one pass.
- `chrome.alarms` minimum period in unpacked (dev) extensions is ≈0.016 minutes (≈1s). The 500ms minimum in `TICK_INTERVAL_MIN_MS` effectively fires every alarm tick in dev mode — sufficient for SC-003.
- `extension/src/game.ts` is a pure module (no direct Chrome API calls in pure functions). `fetchNewCommits` is the only async dependency and can be mocked in unit tests.
- The `'excited'` animation state override is intentionally ephemeral — it lives in DOM timeout only, not persisted to `gameState`, to avoid stale excitement persisting across popup open/close cycles.
- All `processTick()` HP values are floats at runtime; `clampHealth()` floors to [0, 100] but does NOT round — health values like 99.5 are valid.
