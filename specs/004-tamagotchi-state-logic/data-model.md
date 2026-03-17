# Data Model: Initialize Global State Logic

**Branch**: `004-tamagotchi-state-logic`
**Date**: 2026-03-17

---

## Entities

### TamagotchiState

The top-level global state object. Single source of truth for the tamagotchi's live runtime status.

| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `health` | `number` | Yes | `100` | 0 ≤ value ≤ 100 | Current vitality of the tamagotchi |
| `hunger` | `number` | No | `undefined` | — | Reserved for future commit-hunger mechanic; inactive |
| `websiteDebt` | `number` | No | `undefined` | — | Reserved for future website-time mechanic; inactive |

**Validation rules**:
- `health` is clamped to `[0, 100]` at every write. Values below 0 become 0; values above 100 become 100.
- `hunger` and `websiteDebt` MUST remain `undefined` in this feature. They are typed for extensibility only.

---

### HealthUpdate

Represents a request to change the tamagotchi's health value. Used by the write interface.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `delta` | `number` | Yes | Signed change to apply to current health (positive = restore, negative = decay). Clamped after application. |

**Alternative form**: The write interface also accepts an absolute value form (`{ value: number }`) for initialization resets. The implementation must support both.

---

## State Transitions

```
[Uninitialized]
      │
      ▼ app loads
[Initialized: health = 100]
      │
      ├─► updateHealth(delta) ──► [health clamped to 0–100]
      │
      └─► resetHealth() ──────► [health = 100]
```

- Transition from Uninitialized → Initialized occurs exactly once per application session, at mount of the provider.
- There is no persistence in this feature; a page reload returns state to Initialized with `health = 100`.

---

## Relationships

- `TamagotchiState` is owned by the global state provider (`TamagotchiProvider`).
- Consumers receive a read-only view of `TamagotchiState` and a controlled mutation function via the context hook.
- No database tables are created or modified by this feature.
- No Supabase entities are involved.

---

## Future Extension Points

When future mechanics are implemented, the expected additions are:

| Future Field | Owning Feature | Activation Condition |
|---|---|---|
| `hunger` | Commit-hunger mechanic | Non-zero after a commit webhook is received |
| `websiteDebt` | Website-time mechanic | Accumulated from extension time-tracking events |

These fields already exist in the type definition but will not be read or written until their respective features are built.
