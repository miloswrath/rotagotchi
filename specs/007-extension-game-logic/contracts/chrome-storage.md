# Contract: chrome.storage.local Schema

**Feature**: 007-extension-game-logic
**Type**: Internal storage contract (extension ↔ background ↔ popup)

---

## Overview

All extension game state is persisted in `chrome.storage.local`. Background service worker is the **sole writer**; popup is a **read-only consumer** that reacts to changes via `chrome.storage.onChanged`.

---

## Keys

### `gameState`

**Type**: `GameState` (see data-model.md)

**Written by**: `background.ts` on every tick and on restart

**Read by**: `popup.ts` on open and via `chrome.storage.onChanged`

**Example**:
```json
{
  "health": 72,
  "alive": true,
  "debtSeconds": 340,
  "debtCreatedAt": 1743200000000,
  "notifiedAt": 1743200001000,
  "lastCommitSha": "abc123def456",
  "lastCommitAt": 1743199800000,
  "tickIntervalMs": 60000,
  "lastTickAt": 1743200060000,
  "animationState": "starving",
  "speechMessage": "I'm starving... stop coding and watch something!"
}
```

### `blacklist`

**Type**: `string[]` — array of domain strings (e.g., `"youtube.com"`)

**Unchanged from prior features**. The game logic reads this key to call `classifyUrl()`.

**Written by**: `options.ts` (user-managed)

**Read by**: `background.ts` on every tab navigation

---

## Change Events

The popup subscribes to storage changes to update the UI reactively:

```typescript
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.gameState) {
    const newState: GameState = changes.gameState.newValue;
    // Update health bar, animation, speech bubble
  }
});
```

---

## Invariants

1. `gameState.health` is always in [0, 100]
2. `gameState.debtSeconds` is always ≥ 0
3. `gameState.alive === false` if and only if `gameState.health === 0`
4. `gameState.animationState === 'dead'` if and only if `gameState.alive === false`
5. `gameState.tickIntervalMs` is always in [500, 60000]
