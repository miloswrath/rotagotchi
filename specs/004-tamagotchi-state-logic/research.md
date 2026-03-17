# Research: Initialize Global State Logic

**Branch**: `004-tamagotchi-state-logic`
**Date**: 2026-03-17

---

## Decision 1: State Management Approach

**Decision**: React Context with a plain TypeScript state module (no third-party library)

**Rationale**: The project has zero existing state management libraries. React 19 + Next.js 16 App Router are already present. React Context covers all requirements for this feature: global read/write, extensibility, and no animation coupling. Introducing Zustand or Redux at this stage would be premature — the state shape is small (one health field + future slots) and has no complex derived state, time-travel, or middleware needs.

**Alternatives considered**:
- **Zustand**: Lightweight and ergonomic, but adds a new dependency for a feature that can be implemented with zero additions. Can be adopted later if the state grows complex.
- **Redux / Redux Toolkit**: Over-engineered for current scope. Ruled out.
- **Module-level singleton (plain object)**: Works for unit tests but does not integrate cleanly with React rendering and would require manual re-render signaling. Ruled out as primary approach.

---

## Decision 2: State Location in the Monorepo

**Decision**: `lib/state/tamagotchi.ts` for the state definition and `lib/state/store.tsx` for the React Context provider/hooks. The Next.js app wraps with the provider at the root layout.

**Rationale**: The `lib/` directory is already the home for shared, non-UI logic (`lib/github/`, `lib/supabase/`). Placing the state definition there keeps it decoupled from the UI layer and available to server-side code and tests without importing React. The Context provider lives in `lib/state/store.tsx` (JSX extension, React dependency) so the pure type definition in `tamagotchi.ts` remains importable from non-React contexts.

**Alternatives considered**:
- Placing state inside `app/` (e.g., `app/context/`): Tightly couples state to the Next.js app layer, making it harder to share with the extension or test in isolation. Ruled out.
- Sharing state between extension and web app via a shared module: The extension communicates via Chrome messaging APIs, not shared memory. The extension will read/write its own local copy in a future feature. Not needed now.

---

## Decision 3: Health Bounds Enforcement

**Decision**: Clamp at the write interface (setter function), not at read time.

**Rationale**: Enforcing bounds at write time means all consumers always read a valid value — no defensive clamping in callers. This satisfies FR-003 and SC-003 directly. Clamping at read time would allow invalid values to persist in state between reads, which is harder to reason about.

**Alternatives considered**:
- Validation + error throw on out-of-range values: More strict but breaks gracefully-degrading callers (e.g., a commit event that over-adds health). Clamping is more appropriate for a game mechanic. Ruled out.

---

## Decision 4: Extensibility Pattern for Future Mechanic Fields

**Decision**: Use a typed interface (`TamagotchiState`) with optional fields for future mechanics (`hunger?: number`, `websiteDebt?: number`). Initial state omits those fields (they resolve to `undefined`), so adding them in a later feature only requires updating the interface and initial value — no structural changes to existing consumers.

**Rationale**: TypeScript optional fields are the minimal, zero-cost extensibility mechanism. Consumers that don't use `hunger` or `websiteDebt` compile and run unchanged after those fields are added.

**Alternatives considered**:
- Storing all fields as `unknown` or in a generic map: Loses type safety. Ruled out.
- Using a class with methods: More boilerplate, harder to serialize, no benefit over plain object for this use case. Ruled out.

---

## Decision 5: Animation Decoupling

**Decision**: The Context provider must not import or reference any animation component (`IdlePet`, Lottie). Health state changes propagate only to consumers that explicitly subscribe via the context hook. `IdlePet.tsx` is not a context consumer in this feature.

**Rationale**: FR-007 and SC-005 explicitly forbid animation side effects. By keeping the provider in `lib/state/` (no UI imports) and not connecting `IdlePet` to the context, the constraint is structurally enforced rather than relying on convention.

---

## Summary Table

| Question | Decision | Key Reason |
|----------|----------|------------|
| State library | React Context (no new dep) | Sufficient for scope; zero added dependencies |
| State location | `lib/state/` | Consistent with existing shared-lib pattern |
| Bounds enforcement | Clamp at write | Valid value always readable; game-appropriate |
| Extensibility | Optional typed fields | Zero-cost, type-safe, minimal structural change |
| Animation isolation | No animation import in provider | Structurally enforces FR-007 / SC-005 |
