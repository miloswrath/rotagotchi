# Contract: Extension Message Protocol

**Feature**: 007-extension-game-logic
**Type**: Internal runtime message contract (popup → background)

---

## Overview

The popup sends fire-and-forget messages to the background service worker for user-initiated actions. The background service worker does NOT send messages to the popup; it communicates via `chrome.storage.local` changes instead.

---

## Message Types

All messages follow this base shape:

```typescript
interface ExtensionMessage {
  type: string;
}
```

### `RESTART_GAME`

**Direction**: popup → background
**Purpose**: Reset game state to initial healthy defaults after death
**Payload**: none

```typescript
interface RestartGameMessage extends ExtensionMessage {
  type: 'RESTART_GAME';
}
```

**Background handler**: Calls `resetGameState()` which writes `DEFAULT_GAME_STATE` to `chrome.storage.local`, cancels and re-creates the `"game-tick"` alarm.

---

### `SET_TICK_SPEED`

**Direction**: popup → background
**Purpose**: Update tick interval from slider input
**Payload**:

```typescript
interface SetTickSpeedMessage extends ExtensionMessage {
  type: 'SET_TICK_SPEED';
  intervalMs: number;  // Clamped to [500, 60000] before sending
}
```

**Background handler**: Updates `gameState.tickIntervalMs`, cancels and re-creates the `"game-tick"` alarm with the new period.

---

## Usage Pattern (popup.ts)

```typescript
chrome.runtime.sendMessage({ type: 'RESTART_GAME' });
chrome.runtime.sendMessage({ type: 'SET_TICK_SPEED', intervalMs: 1000 });
```

No response awaited — background applies changes and popup observes via `chrome.storage.onChanged`.

---

## Unhandled Message Behavior

Background ignores any message with an unrecognized `type` (no error thrown). This prevents extension breakage from stale popup scripts.
