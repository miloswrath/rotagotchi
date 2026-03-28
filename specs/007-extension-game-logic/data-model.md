# Data Model: Extension Game Logic

**Feature**: 007-extension-game-logic
**Phase**: 1 — Design
**Date**: 2026-03-27

---

## Entities

### 1. GameState

Persisted in `chrome.storage.local` under key `'gameState'`. Owned exclusively by the extension background service worker; popup reads it reactively via `chrome.storage.onChanged`.

```typescript
interface GameState {
  // Core vitality
  health: number;             // 0–100, integer, clamped on write
  alive: boolean;             // false = death state (health hit 0)

  // Debt tracking
  debtSeconds: number;        // Seconds of degenerative watch time still owed (≥ 0)
  debtCreatedAt: number | null; // Unix ms when current debt epoch started (null = no debt)
  notifiedAt: number | null;  // Unix ms when hunger notification was sent

  // Commit tracking
  lastCommitSha: string | null;     // SHA of last processed commit (dedup)
  lastCommitAt: number | null;      // Unix ms of last processed commit's occurred_at

  // Tick configuration
  tickIntervalMs: number;     // Active tick interval in ms (default 60000)
  lastTickAt: number;         // Unix ms when last tick completed (0 = never)

  // UI state
  animationState: AnimationState;  // Drives popup animation selection
  speechMessage: string;           // Current character speech bubble text
}
```

**Defaults** (initial / post-restart):
```typescript
const DEFAULT_GAME_STATE: GameState = {
  health: 100,
  alive: true,
  debtSeconds: 0,
  debtCreatedAt: null,
  notifiedAt: null,
  lastCommitSha: null,
  lastCommitAt: null,
  tickIntervalMs: 60_000,
  lastTickAt: 0,
  animationState: 'idle',
  speechMessage: "I'm doing great! Keep slacking.",
};
```

**Validation rules**:
- `health` must be clamped to [0, 100] on every write — use `clampHealth()` from `lib/state/tamagotchi.ts`
- `debtSeconds` must be ≥ 0 — floor at 0 on every decrement
- `tickIntervalMs` must be in [500, 60_000] — clamp slider value before persisting

---

### 2. AnimationState

Union type for the five visual states. Maps to Lottie animation file names.

```typescript
type AnimationState = 'idle' | 'starving' | 'angry' | 'excited' | 'dead';
```

**Derivation from health**:

| health     | animationState |
|------------|----------------|
| > 70       | `'idle'`       |
| 40–70      | `'starving'`   |
| 10–40      | `'angry'`      |
| 0 (dead)   | `'dead'`       |
| Override   | `'excited'`    |

`'excited'` is a temporary override: set for 3 seconds immediately after a large health boost (immediate feeding response), then reverts to the health-derived state.

---

### 3. CommitRecord (read-only, from Supabase)

The extension reads from the existing `commit_events` table (defined in migration 004). No schema changes required. Relevant columns:

```typescript
interface CommitRecord {
  commit_sha: string;
  diff_size: number;       // lines_added + lines_deleted (constitutional metric)
  occurred_at: string;     // ISO 8601 timestamp
  user_id: string;
}
```

**Query pattern**: `SELECT commit_sha, diff_size, occurred_at FROM commit_events WHERE user_id = $userId AND occurred_at > $since ORDER BY occurred_at DESC LIMIT 5`

Returns up to 5 new commits since last tick. All are processed (debt accumulates per R-003).

---

### 4. TickContext (transient, not persisted)

Computed at the start of each alarm tick. Assembled from storage reads.

```typescript
interface TickContext {
  gameState: GameState;
  currentClassification: 'degenerative' | 'neutral';  // From tabState
  newCommits: CommitRecord[];                          // Commits since last tick
  elapsedMs: number;                                   // ms since last tick (for debt clock)
}
```

---

### 5. TickResult (transient, not persisted)

Returned from `processTick()`. Applied back to storage.

```typescript
interface TickResult {
  nextState: GameState;
  notifications: PendingNotification[];  // Empty array if none
}
```

---

### 6. PendingNotification

```typescript
interface PendingNotification {
  id: string;   // Unique ID for chrome.notifications
  type: 'hunger' | 'satiated';
  title: string;
  message: string;
}
```

---

## State Transitions

```
        [new commit]
HEALTHY ─────────────────► HUNGRY
  ▲                           │
  │  [debt cleared]           │ [time passes, neutral site]
  │◄──────────────────────── ─┤
  │                           │ [health drops]
  │                           ▼
  │                      DISTRESSED
  │                           │
  │                           │ [health hits 0]
  │                           ▼
  │                         DEAD
  │                           │
  └───────────── [restart] ───┘
```

**State derivation** (not stored separately — derived from `health` and `debtSeconds`):
- `HEALTHY`: `alive && debtSeconds === 0 && health > 70`
- `HUNGRY`: `alive && debtSeconds > 0 && health > 40`
- `DISTRESSED`: `alive && health <= 40` (debt may or may not be active)
- `DEAD`: `!alive` (`health` hit 0)

---

## No Schema Migrations Required

All new state is stored in `chrome.storage.local`. The existing Supabase `commit_events` table is read-only from the extension. No new database migrations are needed for this feature.

---

## Derived Constants

Defined in `extension/src/game.ts`:

```typescript
// Debt formula (constitutional — amendment required to change)
export const DEBT_SECONDS_PER_LINE = 2;
export const DEBT_MAX_SECONDS = 3600;

// HP changes per tick
export const DRAIN_NEUTRAL_WITH_DEBT    = -3;
export const DRAIN_DEGENERATE_WITH_DEBT = -1;
export const DRAIN_NEUTRAL_NO_DEBT      = -0.5;
export const GAIN_DEGENERATE_NO_DEBT    = +1;
export const GAIN_IMMEDIATE_FEED_BONUS  = +15;  // One-time, within 120s of notification

// Animation override duration
export const EXCITED_DURATION_MS = 3000;

// Tick speed bounds
export const TICK_INTERVAL_DEFAULT_MS = 60_000;
export const TICK_INTERVAL_MIN_MS     =    500;
export const TICK_INTERVAL_MAX_MS     = 60_000;

// Immediate boost window
export const IMMEDIATE_FEED_WINDOW_MS = 120_000;  // 2 minutes

// Health thresholds (for animation mapping)
export const HEALTH_IDLE_THRESHOLD     = 70;
export const HEALTH_STARVING_THRESHOLD = 40;
export const HEALTH_ANGRY_THRESHOLD    = 10;
```
