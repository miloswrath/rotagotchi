# Implementation Plan: Extension Game Logic

**Branch**: `007-extension-game-logic` | **Date**: 2026-03-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-extension-game-logic/spec.md`

---

## Summary

Implement a complete game loop for the Rotagotchi Chrome extension: a `chrome.alarms`-driven tick system that polls Supabase for new commits, calculates proportional health debt, drains health based on site classification, and triggers notifications and animations reflecting the tamagotchi's state. The popup gains a health bar, hunger/satiated indicator, speech bubbles, a death+restart screen, and a tick-speed slider for demos.

---

## Technical Context

**Language/Version**: TypeScript 5.x targeting Chrome 88+ (Manifest V3)
**Primary Dependencies**: `lottie-web` (existing), `@supabase/supabase-js` (existing), `esbuild` (existing build tool)
**Storage**: `chrome.storage.local` (game state + blacklist), `chrome.storage.session` (tab state, existing)
**Testing**: Vitest 3 (unit), Playwright 1.50 (e2e + smoke), ESLint 9 (existing)
**Target Platform**: Chrome 88+, Manifest V3, headless-capable via virtual display for CI
**Project Type**: Browser extension (Chrome MV3)
**Performance Goals**: SC-001: notification within 5s of commit detected; SC-003: full death in ≤30s at max tick speed
**Constraints**: No Node.js runtime in extension; IIFE bundling only; `chrome.alarms` minimum period ≈1s (dev/unpacked); `process.env` injected at build time by esbuild
**Scale/Scope**: Single-user, single Chrome profile; ~10 storage keys; ~5 new/modified source files

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Notes |
|-----------|-------|-------|
| **I. Commit-Triggered Enforcement** | ✅ PASS | FR-001/FR-002: Extension reads `commit_events` from Supabase on each tick; debt calculated from commit metadata |
| **II. Proportional Degenerative Time** | ✅ PASS | `debtSeconds = diff_size × 2` (2s/line); diff_size = lines_added + lines_deleted per constitution; documented in data-model.md; changing rate requires amendment |
| **III. Mandatory Watch Gate** | ✅ PASS | Debt persists until `debtSeconds ≤ 0`; health drains continuously while debt is active; passive drain even off work sites |
| **IV. Avatar Vitality Coupling** | ✅ PASS | Health HP driven directly by tick-based drain/recovery tied to classification; debt cleared only by time on degenerative sites |
| **V. Deterministic Activity Classification** | ✅ PASS | `classifyUrl()` (existing, unchanged); blacklist = entertainment sites; unknowns → 'neutral'; all rules in classify.ts and options.html |

**Post-Design Re-check**: All five principles remain satisfied after Phase 1 design. No violations. Complexity Tracking table not required.

---

## Project Structure

### Documentation (this feature)

```text
specs/007-extension-game-logic/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── chrome-storage.md        # Storage schema contract
│   ├── message-protocol.md      # Popup → background message contract
│   └── supabase-queries.md      # Supabase read contract
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (affected files)

```text
extension/
├── src/
│   ├── game.ts           # NEW: core tick logic, debt, drain/gain, state transitions
│   ├── notifications.ts  # NEW: chrome.notifications wrappers
│   ├── background.ts     # MODIFIED: wire game loop, alarm handler, message handler
│   ├── popup.ts          # MODIFIED: health bar, speech bubble, restart, settings slider
│   ├── auth.ts           # UNCHANGED
│   ├── classify.ts       # UNCHANGED
│   └── options.ts        # UNCHANGED
├── popup.html            # MODIFIED: new UI elements
└── manifest.json         # MODIFIED: add alarms, notifications permissions

lib/state/
└── tamagotchi.ts         # MODIFIED: expand TamagotchiState + add AnimationState type

scripts/
└── build-extension.js    # MODIFIED: copy excited.json, death.json, starving.json

rot/
├── excited.json          # EXISTS (not yet bundled) — needs bundling
├── death.json            # EXISTS (not yet bundled) — needs bundling
└── starving.json         # EXISTS (not yet bundled) — needs bundling

tests/
├── unit/
│   └── game.spec.ts      # NEW: processTick, debt calc, health transitions
└── e2e/
    └── game-loop.spec.ts  # NEW: commit → notification → drain → death → restart
```

**Structure Decision**: Single extension project (no new directories). Two new source files; modifications concentrated in `background.ts` and `popup.ts`. Shared `lib/state/tamagotchi.ts` expanded to serve as the type authority for both extension and Next.js app.

---

## Implementation Design

### New File: `extension/src/game.ts`

Pure functions only — no direct Chrome API calls (except reading storage passed in as params). Enables unit testing without a Chrome environment.

**Exports**:
```typescript
export function calculateDebt(diffSize: number): number
export function deriveAnimationState(health: number): AnimationState
export function deriveSpeechMessage(animationState: AnimationState, debtSeconds: number): string
export function processTick(ctx: TickContext): TickResult
export function resetGameState(): GameState
```

**`processTick` responsibilities**:
1. Process new commits → accumulate debt, record lastCommitSha/At
2. Determine HP delta from classification × debt state matrix (see data-model.md)
3. If on degenerative site: decrement `debtSeconds` by `elapsedMs / 1000`
4. Apply immediate feed bonus if `debtCreatedAt` is within `IMMEDIATE_FEED_WINDOW_MS`
5. Clamp health to [0, 100]; set `alive = false` if health hits 0
6. Derive new `animationState` and `speechMessage`
7. Emit notifications: hunger (new debt created), satiated (debt just cleared)
8. Return `TickResult` with nextState + notifications array

### New File: `extension/src/notifications.ts`

```typescript
export async function sendHungerNotification(diffSize: number, debtSeconds: number): Promise<void>
export async function sendSatiatedNotification(): Promise<void>
export async function clearNotification(id: string): Promise<void>
```

Uses `chrome.notifications.create()`. Notification IDs are stable (`'rotagotchi-hunger'`, `'rotagotchi-satiated'`) so repeat fires replace the previous notification.

### Modified: `extension/src/background.ts`

New responsibilities added:
- `chrome.runtime.onInstalled`: call `ensureGameStateInitialized()`
- `chrome.alarms.create('game-tick', { periodInMinutes: 1 })` on startup if not exists
- `chrome.alarms.onAlarm` handler: if alarm.name === `'game-tick'`, run tick
- `chrome.runtime.onMessage` handler: handle `RESTART_GAME` and `SET_TICK_SPEED`

Tick execution in alarm handler:
```typescript
async function runGameTick() {
  const [gameState, tabState, blacklist] = await readStorage();
  const session = await getValidSession();
  const newCommits = session ? await fetchNewCommits(session, gameState.lastCommitAt) : [];
  const classification = classifyUrl(tabState?.url ?? '', blacklist ?? []);
  const ctx: TickContext = { gameState, currentClassification: classification, newCommits, elapsedMs };
  const { nextState, notifications } = processTick(ctx);
  await chrome.storage.local.set({ gameState: nextState });
  for (const n of notifications) await fireNotification(n);
}
```

### Modified: `extension/popup.html`

New elements within the existing `.main-screen` section:
```html
<!-- Health bar -->
<div id="health-bar-container">
  <div id="health-bar" style="width: 100%"></div>
</div>
<div id="health-label">HP: 100</div>

<!-- Status indicator -->
<div id="status-indicator" class="status-healthy">SATIATED</div>

<!-- Speech bubble -->
<div id="speech-bubble">I'm doing great! Keep slacking.</div>

<!-- Restart overlay (hidden by default) -->
<div id="death-overlay" style="display:none">
  <div id="death-message">I died because you kept working.</div>
  <button id="restart-btn">Restart</button>
</div>

<!-- Settings panel (toggled by gear icon) -->
<div id="settings-panel" style="display:none">
  <label>Tick Speed</label>
  <input type="range" id="tick-slider" min="500" max="60000" step="500" value="60000">
  <span id="tick-label">60s</span>
</div>
<button id="settings-btn">⚙</button>
```

### Modified: `extension/src/popup.ts`

New reactive update function called from `chrome.storage.onChanged`:
```typescript
function updateFromGameState(state: GameState) {
  // Health bar width %
  // Status indicator text + class
  // Speech bubble text
  // Animation selection (state.animationState)
  // Death overlay visibility
  // Restart button listener
}
```

Slider handler:
```typescript
tickSlider.addEventListener('input', () => {
  const ms = parseInt(tickSlider.value);
  chrome.runtime.sendMessage({ type: 'SET_TICK_SPEED', intervalMs: ms });
});
```

---

## Test Plan

### Unit Tests (`tests/unit/game.spec.ts`)

| Test | Description |
|------|-------------|
| `calculateDebt` | 100 lines → 200s; 600 lines → 1200s; 0 lines → 0 |
| `calculateDebt` cap | Existing 3000s debt + 1000 new → cap at 3600s |
| `processTick` — drain neutral+debt | Health decreases by 3 HP |
| `processTick` — drain neutral no debt | Health decreases by 0.5 HP |
| `processTick` — recovery degenerative no debt | Health increases by 1 HP |
| `processTick` — immediate feed bonus | Notification within window → +15 HP bonus |
| `processTick` — debt clock decrements | debtSeconds reduces by elapsedMs/1000 |
| `processTick` — debt clears → satiated notification | debtSeconds → 0 emits satiated notification |
| `processTick` — health hits 0 → dead | alive = false, animationState = 'dead' |
| `processTick` — new commit → hunger notification | debt created, notification emitted |
| `processTick` — second commit accumulates | debt adds to existing |
| `deriveAnimationState` | health 80→idle, 55→starving, 25→angry, 0→dead |
| `resetGameState` | Returns DEFAULT_GAME_STATE values |

### E2E Tests (`tests/e2e/game-loop.spec.ts`)

| Test | Description |
|------|-------------|
| Popup shows health bar | Open popup → health bar div is visible |
| Fast drain demo | Set max tick speed, inject mock commit → health visibly decreases |
| Death and restart | Health reaches 0 → death overlay visible → restart → health bar full |
| Speech bubble | Each state has non-empty speech message in popup |
| Settings slider | Move slider → tick interval changes (verify via storage read) |

---

## Complexity Tracking

No constitution violations. Table omitted.
