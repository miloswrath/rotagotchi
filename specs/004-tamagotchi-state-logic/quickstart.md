# Quickstart: Initialize Global State Logic

**Branch**: `004-tamagotchi-state-logic`
**Date**: 2026-03-17

---

## What This Feature Adds

A global tamagotchi state container for the Next.js web app. After this feature:
- `state.health` is initialized to `100` on every app load
- Any component can read health via `useTamagotchi()`
- Any module can update health via `updateHealth(delta)` or `resetHealth()`
- The state shape reserves slots for future mechanics (hunger, websiteDebt)
- No animations are triggered by state changes

---

## File Layout

```text
lib/
└── state/
    ├── tamagotchi.ts       # TamagotchiState type, initial state, HEALTH_MIN/MAX constants
    └── store.tsx           # TamagotchiProvider, TamagotchiContext, useTamagotchi hook

tests/
└── unit/
    └── state/
        └── tamagotchi.spec.ts   # Unit tests for state logic and hook contract

app/
└── layout.tsx              # Wrap children with <TamagotchiProvider>
```

---

## Implementation Steps

### 1. Define the state type and constants (`lib/state/tamagotchi.ts`)

- Export `TamagotchiState` interface with `health`, `hunger?`, `websiteDebt?`
- Export `HEALTH_MIN = 0`, `HEALTH_MAX = 100`, `HEALTH_DEFAULT = 100`
- Export `initialTamagotchiState: TamagotchiState = { health: HEALTH_DEFAULT }`
- Export a pure `clampHealth(value: number): number` utility

### 2. Build the Context provider and hook (`lib/state/store.tsx`)

- Create `TamagotchiContext` with `React.createContext<TamagotchiContextValue | null>(null)`
- `TamagotchiProvider` uses `useReducer` (or `useState`) internally; initializes with `initialTamagotchiState`
- `updateHealth(delta)` applies delta then clamps using `clampHealth`
- `resetHealth()` sets health to `HEALTH_DEFAULT`
- `useTamagotchi()` reads context and throws if `null` (i.e., called outside provider)
- **Do not import any animation component**

### 3. Mount the provider (`app/layout.tsx`)

- Wrap the existing `{children}` in `<TamagotchiProvider>`
- No other changes to the layout

### 4. Write unit tests (`tests/unit/state/tamagotchi.spec.ts`)

Cover:
- Initial health is `HEALTH_DEFAULT` (100)
- `updateHealth(+50)` on full health clamps to 100
- `updateHealth(-150)` on 50 health clamps to 0
- `updateHealth(-10)` on 50 health results in 40
- `resetHealth()` restores to 100 from any value
- `useTamagotchi()` throws when called outside provider

---

## Running Tests

```bash
npm test                          # all vitest tests
npm run test:unit                 # unit tests only
```

---

## Key Constraints (do not violate)

- `IdlePet.tsx` must not be imported or referenced in `lib/state/`
- `hunger` and `websiteDebt` fields must stay `undefined` — do not add read/write logic for them
- Do not add Supabase calls or persistence logic
- Do not add Redux, Zustand, or any new state management library
