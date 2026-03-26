# State Interface Contract: Global Tamagotchi State

**Branch**: `004-tamagotchi-state-logic`
**Date**: 2026-03-17
**Type**: Internal module interface (TypeScript)

---

## Overview

This contract defines the public interface that all application modules must use to read and write tamagotchi state. Direct mutation of the state object is forbidden.

---

## State Type

```typescript
interface TamagotchiState {
  health: number;           // 0–100, default 100
  hunger?: number;          // reserved, inactive
  websiteDebt?: number;     // reserved, inactive
}
```

---

## Context Value Type

```typescript
interface TamagotchiContextValue {
  state: Readonly<TamagotchiState>;
  updateHealth: (delta: number) => void;
  resetHealth: () => void;
}
```

---

## Hook Interface

```typescript
// Throws if called outside TamagotchiProvider
function useTamagotchi(): TamagotchiContextValue
```

---

## Invariants

| # | Invariant |
|---|-----------|
| 1 | `state.health` is always in `[0, 100]` after any `updateHealth` call |
| 2 | `updateHealth(delta)` clamps: `health = Math.min(100, Math.max(0, health + delta))` |
| 3 | `resetHealth()` sets `health` to `100` unconditionally |
| 4 | `state.hunger` and `state.websiteDebt` are always `undefined` in this feature |
| 5 | No call to `updateHealth` or `resetHealth` triggers an animation side effect |

---

## Provider Interface

```typescript
// Wrap the app root to make tamagotchi state available to all children
function TamagotchiProvider({ children }: { children: React.ReactNode }): JSX.Element
```

**Initialization behavior**: On first mount, `state.health` is set to `100`. No external data source is read.

---

## Error Conditions

| Condition | Behavior |
|-----------|----------|
| `useTamagotchi()` called outside provider | Throws `Error: useTamagotchi must be used within TamagotchiProvider` |
| `updateHealth` called with `NaN` or `Infinity` | Clamp logic produces 0 or 100 respectively; no exception |

---

## Out-of-Scope (this feature)

- Persistence to Supabase or local storage
- Subscription to commit webhook events
- Subscription to extension website-time events
- Any animation state changes
