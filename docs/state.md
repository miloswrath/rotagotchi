# Global State

The tamagotchi's runtime state lives in a React Context rooted at `app/layout.tsx`. All reads and writes go through a single hook — direct mutation of the state object is forbidden.

## Files

| File | Purpose |
|------|---------|
| `lib/state/tamagotchi.ts` | State type, constants, pure `clampHealth` utility |
| `lib/state/store.tsx` | `TamagotchiProvider`, `useTamagotchi` hook |

## State shape

```ts
interface TamagotchiState {
  health: number;       // 0–100, initialized to 100
  hunger?: number;      // reserved — not yet active
  websiteDebt?: number; // reserved — not yet active
}
```

`hunger` and `websiteDebt` are typed but always `undefined` until their respective features are built. Do not add read/write logic for them outside those features.

## Reading and writing state

```tsx
import { useTamagotchi } from "@/lib/state/store";

function MyComponent() {
  const { state, updateHealth, resetHealth } = useTamagotchi();

  return (
    <div>
      <p>Health: {state.health}</p>
      <button onClick={() => updateHealth(-10)}>Take damage</button>
      <button onClick={() => resetHealth()}>Heal</button>
    </div>
  );
}
```

### `updateHealth(delta: number)`

Adds `delta` to the current health and clamps the result to `[0, 100]`.

```ts
updateHealth(+20)  // restore 20 HP (caps at 100)
updateHealth(-50)  // deal 50 damage (floors at 0)
```

### `resetHealth()`

Sets health to `100` unconditionally. Intended for session resets or future respawn logic.

### `state`

A `Readonly<TamagotchiState>` snapshot. React will re-render consumers when state changes.

## Constraints

- **No animation coupling.** Never import `IdlePet` or `lottie-react` into `lib/state/`. Animation components must subscribe to state via `useTamagotchi()`, not the other way around.
- **No direct mutation.** Always use `updateHealth` or `resetHealth`. The `state` object is `Readonly<…>` — TypeScript will catch accidental writes.
- **No persistence.** State resets to `health: 100` on every page load. Persistence will be added in a later feature.
- **Provider required.** `useTamagotchi()` throws if called outside `<TamagotchiProvider>`. The provider is mounted at `app/layout.tsx` so all app routes are covered.

## Adding a new mechanic field

1. Add an optional field to `TamagotchiState` in `lib/state/tamagotchi.ts`.
2. No changes to `store.tsx` or any existing consumer are required — optional fields don't break anything.
3. Add read/write logic in `store.tsx` only when the mechanic is being implemented.

Example (from the future commit-hunger feature):

```ts
// lib/state/tamagotchi.ts
interface TamagotchiState {
  health: number;
  hunger?: number;      // activate: add setHunger() to store.tsx
  websiteDebt?: number;
}
```

## Testing

Unit tests live in `tests/unit/state/tamagotchi.spec.ts`. They run in a jsdom environment (annotated with `// @vitest-environment jsdom`) and use `@testing-library/react`'s `renderHook`.

```bash
npm run test:unit
```
