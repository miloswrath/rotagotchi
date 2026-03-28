# Research: Extension Game Logic

**Feature**: 007-extension-game-logic
**Phase**: 0 — Research
**Date**: 2026-03-27

---

## R-001: Commit Detection Strategy

**Decision**: Poll Supabase on each game tick for commits newer than `lastTickAt`.

**Rationale**: The extension background service worker cannot receive webhooks directly. Supabase Realtime (WebSocket) is an option but introduces a persistent connection that MV3 service workers will close when idle. Polling on the game tick is simpler, already aligns with the tick cadence, and avoids a dedicated channel. One Supabase query per tick is negligible.

**Implementation**: On each tick, query `commit_events` WHERE `user_id = currentUser AND occurred_at > lastProcessedAt ORDER BY occurred_at DESC LIMIT 1`. If a new row exists, process it.

**Alternatives Considered**:
- *Supabase Realtime*: Rejected — persistent WebSocket conflicts with MV3 service worker lifecycle.
- *Push notifications from Next.js server*: Rejected — requires additional server infrastructure; out of scope.

---

## R-002: MV3 Tick System

**Decision**: Use `chrome.alarms` as the authoritative tick trigger; `chrome.alarms` wakes the service worker on schedule.

**Rationale**: MV3 service workers terminate after ~30 seconds of inactivity. `setInterval` does not survive termination. `chrome.alarms` is the MV3-approved pattern for periodic background work — it wakes the service worker and fires the `onAlarm` listener reliably. Minimum alarm period is 1 minute in production (≥0.016 min = ~1 second in unpacked/dev extensions).

**Demo speed**: At max slider position, alarm period is set to the minimum (≈1 second in dev/unpacked). This satisfies SC-003 (full death in 30s at max speed).

**Default tick interval**: 60 seconds (baseline) with a slider range of 1s–60s represented as alarm period in minutes (`0.016` to `1`).

**Alarm names**: `"game-tick"` for the main loop.

**Alternatives Considered**:
- *setInterval*: Rejected — terminated with service worker.
- *Content script keep-alive ping*: Rejected — requires an active tab; unreliable.
- *Popup setInterval*: Rejected — only works while popup is open; doesn't support background health drain.

---

## R-003: Health Debt Formula

**Decision**: `debtSeconds = diff_size × 2`, capped at 3600s (1 hour) cumulative. New debt adds to existing outstanding debt.

**Rationale**: The constitution mandates proportional, documented, deterministic conversion. `diff_size` is already defined as `lines_added + lines_deleted` per constitution §Operational Policy. A 2 second/line rate gives:
- Small commit (50 lines) → 100s (~1.5 min) debt
- Medium commit (200 lines) → 400s (~6.5 min) debt
- Large commit (500 lines) → 1000s (~16 min) debt, capped to 3600s if already owing

The cap prevents runaway debt from large automated commits.

**Amendment required**: Changing `2 seconds/line` or the metric itself requires a constitution amendment per §Governance.

**Alternatives Considered**:
- *1 second/line*: Too fast to recover; considered too lenient.
- *Logarithmic scaling*: Rejected — non-deterministic, harder to audit.

---

## R-004: Classification Mapping for Health System

**Decision**: The existing `classifyUrl()` classification is repurposed for health semantics:
- `'degenerative'` (entertainment blacklist sites) = user is watching allowed content → health debt clock runs down
- `'neutral'` (all other sites, including work) = user is potentially working → health drain active

**Rationale**: The current `DEFAULT_BLACKLIST` contains entertainment sites (youtube, instagram, etc.) classified as `'degenerative'`. The game design treats entertainment sites as the "payment" for commits. Neutral sites = default work assumption. This aligns the code classification with game semantics without changing the existing classify.ts logic.

**Terminology note**: The spec uses "blacklist" to mean the entertainment site list (same as current code). "Work sites" in the spec = neutral classification = anything not on the entertainment blacklist.

**Alternatives Considered**:
- *Add a separate work-domain list*: Deferred — the spec's assumption §Assumptions states the existing blacklist is reused. A work-domain list can be added in a future feature.

---

## R-005: Health Drain and Recovery Rates

**Decision**: Per-tick HP changes based on state × classification:

| State              | Classification  | HP/tick |
|--------------------|-----------------|---------|
| Debt active        | neutral         | −3      |
| Debt active        | degenerative    | −1      |
| No debt            | neutral         | −0.5    |
| No debt            | degenerative    | +1      |
| Immediately fed    | degenerative    | +15 (one-time bonus, within 120s of notification) |

**Rationale**:
- Debt + neutral = strongest drain: user is working instead of watching.
- Debt + degenerative = slight drain: user is watching but debt reduces per-second; visual penalty for not acting instantly.
- No debt + neutral = slow passive drain: even paid-off debt doesn't prevent natural decline; pet needs ongoing attention.
- No debt + degenerative = recovery: reward for watching entertainment.
- Immediate boost: spec FR-004 requires "large health boost" for prompt response; 15 HP in one tick is significant.

**Debt reduction**: While on a degenerative site, `debtSeconds` reduces by `tickIntervalSeconds` per tick (real-time clock). When `debtSeconds ≤ 0`, debt is cleared and satiated notification fires.

---

## R-006: Animation State Mapping

**Decision**: Map `health` value to animation name:

| Health Range | Animation   | File          | Status    |
|--------------|-------------|---------------|-----------|
| > 70         | `idle`      | idle.json     | ✅ bundled |
| 40–70        | `starving`  | starving.json | ❌ needs bundling |
| 10–40        | `angry`     | angry.json    | ✅ bundled |
| 0 (dead)     | `dead`      | death.json    | ❌ needs bundling |
| Just fed     | `excited`   | excited.json  | ❌ needs bundling |

**Three additional animations** (`starving.json`, `death.json`, `excited.json`) must be added to `scripts/build-extension.js` copy step.

**Feeding animation**: Triggered for 3 seconds after large health boost, then reverts to `idle`.

---

## R-007: Chrome Notifications

**Decision**: Use `chrome.notifications.create()` with `"basic"` type. Requires adding `"notifications"` permission to `extension/manifest.json`.

**Notification triggers** (per spec FR-003, FR-016, FR-017):
1. **Hunger notification**: Fires when new health debt is created. Title: "Rotagotchi is hungry!", message: "You committed {N} lines. Watch something fun to pay it off."
2. **Satiated notification**: Fires when debt reaches 0. Title: "Rotagotchi is happy!", message: "You've earned some rest. {pet} is satiated."

**Chrome alarms permission** also needed for R-002.

**Manifest additions**: `"alarms"`, `"notifications"` in `permissions` array.

---

## R-008: Game State Persistence

**Decision**: Persist all game state in `chrome.storage.local` under key `'gameState'`.

**Rationale**: Survives extension restart and Chrome restart. Service worker reads on `onAlarm`, popup reads on open. `chrome.storage.onChanged` provides reactive updates to popup without polling.

**Schema**: Defined in data-model.md.

---

## R-009: Popup UI Additions

**Decision**: Extend existing popup.html/popup.ts with:
1. **Health bar**: `<div id="health-bar">` with inline width style driven by `health` value.
2. **Status label**: "HUNGRY" / "SATIATED" / "DEAD" text beneath animation.
3. **Speech bubble**: `<div id="speech-bubble">` overlaid on character with state-driven messages.
4. **Restart button**: `<button id="restart-btn">` visible only when `alive === false`.
5. **Settings panel**: Inline panel with tick-speed slider, accessible via gear icon.

**Speech messages by state**:
- Healthy: "I'm doing great! Keep slacking."
- Hungry: "I'm starving... stop coding and watch something!"
- Distressed (health < 30): "I can't take it anymore! WATCH SOMETHING NOW!"
- Dead: "I died because you kept working. Press restart."

---

## R-010: New Source File Layout

**Decision**: Add `extension/src/game.ts` and `extension/src/notifications.ts` as new modules. Wire into `background.ts`.

**`game.ts`**: Pure-ish functions for tick logic, debt calculation, state transitions. No direct chrome API calls (except reading storage for current tab state). Enables unit testing without extension environment.

**`notifications.ts`**: Wraps `chrome.notifications` calls with typed interfaces.

**Alternatives Considered**:
- *Inline in background.ts*: Rejected — background.ts is already complex; separation aids testing.

---

## Resolved Clarifications

All spec §Assumptions items resolved:

| Assumption | Resolution |
|-----------|------------|
| Health debt scales linearly | 2s/line (R-003) |
| "Degenerative content" definition | Any site NOT on entertainment blacklist = neutral; entertainment blacklist = degenerative (R-004) |
| Same blacklist as prior features | Confirmed — classifyUrl() unchanged |
| New commit adds to existing debt | Confirmed — accumulates, capped at 3600s |
| Tick interval default | 60 seconds via chrome.alarms |
| Desktop notifications | chrome.notifications API, permission added |
| Settings menu location | Inline panel in popup, accessible via gear icon |
