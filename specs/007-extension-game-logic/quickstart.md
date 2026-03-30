# Quickstart: Extension Game Logic

**Feature**: 007-extension-game-logic

---

## What's Being Built

A full game loop for the Rotagotchi Chrome extension:

1. Background service worker polls Supabase each tick for new commits
2. New commits create health debt + fire a hunger notification
3. Health drains each tick based on current site classification + debt state
4. Visiting entertainment sites (existing blacklist) pays off debt + restores health
5. Health reaching zero triggers death state with restart
6. Popup shows health bar, hunger/satiated indicator, speech bubble, and tick speed slider

---

## New Files

| File | Purpose |
|------|---------|
| `extension/src/game.ts` | Pure tick logic, debt calculation, state transitions |
| `extension/src/notifications.ts` | Chrome notification creation helpers |

---

## Modified Files

| File | Changes |
|------|---------|
| `extension/src/background.ts` | Wire up game loop: alarm handler, message handler, startup init |
| `extension/src/popup.ts` | Health bar, hunger/satiated indicator, speech bubble, restart button, settings slider |
| `extension/popup.html` | New UI elements: health bar div, speech bubble div, restart button, settings panel |
| `extension/manifest.json` | Add `"alarms"` and `"notifications"` permissions |
| `scripts/build-extension.js` | Copy `excited.json`, `death.json`, `starving.json` to dist/animations/ |
| `lib/state/tamagotchi.ts` | Expand `TamagotchiState` interface with debt, alive, animationState fields |

---

## New Tests

| File | Type | What it tests |
|------|------|---------------|
| `tests/unit/game.spec.ts` | Unit (vitest) | `processTick()`, debt calculation, health drain/gain, state transitions |
| `tests/e2e/game-loop.spec.ts` | E2E (playwright) | Full game loop: commit → notification → health drain → death → restart |

---

## Build Steps

After implementation:

```bash
# Build extension
npm run build:extension

# Run unit tests
npx vitest run tests/unit/game.spec.ts

# Run E2E tests (requires Chrome, headless=false)
npx playwright test tests/e2e/game-loop.spec.ts
```

---

## Key Constants (game.ts)

```
DEBT_SECONDS_PER_LINE   = 2          (constitutional — amendment needed to change)
TICK_INTERVAL_DEFAULT   = 60,000 ms  (60s)
TICK_INTERVAL_MIN       = 500 ms     (demo/fast mode)
IMMEDIATE_FEED_WINDOW   = 120,000 ms (2 min window for bonus boost)
GAIN_IMMEDIATE_FEED_BONUS = +15 HP   (one-time bonus)
```

---

## Demo Flow (SC-003)

To demonstrate full mechanics in under 30 seconds:

1. Open popup → move tick speed slider to max (500ms ticks)
2. Simulate a commit arriving (or wait for Supabase polling)
3. Hunger notification appears → tamagotchi enters hungry state
4. Navigate to a work site (not in blacklist) → health drains at −3 HP/tick
5. At 500ms ticks: 100 HP ÷ 3 HP/tick = ~34 ticks × 0.5s = ~17 seconds to death
6. Death animation plays, restart button appears
7. Click restart → back to full health in one tick
