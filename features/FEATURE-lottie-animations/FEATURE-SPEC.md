# Feature -> Animation States for the Rotagotchi Cat Character
---

## Clarified Decisions
---
- `APP_STATE` is sourced from React state/context and exposed globally for state-driven rendering.
- Animations are delivered as separate Lottie JSON files per state.
- If a state animation is missing or fails to load, the UI falls back to the `idle` animation.
- This feature applies to both the Next.js app and the Chrome extension surfaces.

## Functional Requirements (FR)
---
- **FR-1: Supported states**
	- The system SHALL support exactly the following animation states: `idle`, `feeding`, `angry`, `starving`, and `excited`.
- **FR-2: State-to-animation mapping**
	- The system SHALL map each supported `APP_STATE` value to a corresponding Lottie JSON asset.
	- The mapping SHALL be deterministic and centralized (single source of truth used by both app and extension contexts).
- **FR-3: Animation asset structure**
	- The system SHALL use separate Lottie JSON files for each state.
	- Existing `idle.json` SHALL remain the visual and stylistic reference baseline for the character.
- **FR-4: Character consistency**
	- All non-idle animations SHALL preserve the same character identity as `idle.json` (silhouette, palette family, and recognizable facial/body design language).
- **FR-5: Playback behavior**
	- Each state animation SHALL loop continuously.
	- Each loop target duration SHALL be approximately 5 seconds (acceptable range: 4.5s–5.5s).
- **FR-6: Runtime switching**
	- When `APP_STATE` changes to a supported state, the renderer SHALL switch to that state animation on the next render cycle.
- **FR-7: Fallback behavior**
	- If the mapped state asset is missing, malformed, or fails to render, the system SHALL fall back to `idle` without crashing.
- **FR-8: Cross-surface usage**
	- The same state set, mapping behavior, loop behavior, and fallback semantics SHALL be implemented for:
		- Next.js app UI pet surface(s)
		- Chrome extension UI pet surface(s)

## Non-Functional Requirements (NFR)
---
- **NFR-1: Visual continuity**
	- Animation quality SHALL be coherent with existing `idle.json` style and not introduce a new character style.
- **NFR-2: Responsiveness**
	- State transitions SHOULD appear without noticeable delay during normal runtime usage.
- **NFR-3: Reliability**
	- Asset failures SHALL degrade gracefully via `idle` fallback; no uncaught runtime errors in UI flow.
- **NFR-4: Maintainability**
	- State-to-file mapping SHOULD be easy to extend for future states without refactoring core rendering logic.
- **NFR-5: Consistency**
	- Behavior between app and extension SHALL be equivalent for identical `APP_STATE` inputs.

## Scope
---
### In Scope
- Defining the canonical supported state list.
- Creating/providing Lottie JSON assets for `idle`, `feeding`, `angry`, `starving`, and `excited`.
- Implementing state-based animation selection from `APP_STATE`.
- Implementing 5-second looping playback behavior.
- Implementing `idle` fallback behavior.
- Ensuring behavior parity across Next.js app and Chrome extension surfaces.

### Out of Scope
- Adding additional emotional/behavioral states beyond the five listed states.
- Redesigning the pet character into a new visual identity.
- Introducing new animation frameworks beyond Lottie for this feature.
- Building advanced transition effects between states (crossfades, blend trees, etc.) unless required by a future feature.

## Assumptions & Constraints
---
- `APP_STATE` is available at runtime via React state/context and can be read by animation-rendering surfaces.
- Lottie playback capability is available in both target surfaces (app and extension).
- State values outside the supported set are treated as invalid and use `idle` fallback.

## Acceptance Criteria
---
- Given each valid `APP_STATE` value (`idle`, `feeding`, `angry`, `starving`, `excited`), the corresponding animation renders and loops.
- Given an invalid or unknown `APP_STATE`, the pet renders `idle`.
- Given a missing/broken state file, the pet renders `idle` and remains interactive/stable.
- Loop duration for each animation is within the 4.5s–5.5s target range.
- Equivalent behavior is observed in both the Next.js app and Chrome extension UI surfaces.

## Implementation Plan
---

***Checkpoint 1: Define state contract + shared mapping***
- [ ] Create a shared animation state type/enum for `idle`, `feeding`, `angry`, `starving`, and `excited`.
- [ ] Create a single mapping module that resolves `APP_STATE` -> animation asset path and normalizes invalid values to `idle`.
- [ ] Wire this module so both app (`app/` components) and extension (`extension/`) can consume the same state contract.
- [ ] **Test:** Add unit tests for state normalization and mapping correctness (valid states map correctly, invalid/unknown values return `idle`).

***Checkpoint 2: Add/organize Lottie state assets***
- [ ] Ensure separate JSON files exist for all five states under the animation asset location (current pattern in `rot/`).
- [ ] Validate that each non-idle file preserves character continuity with `idle.json`.
- [ ] Add lightweight asset validation checks (JSON parse + required top-level Lottie fields).
- [ ] **Test:** Add an asset integrity test that verifies each required file exists and is parseable JSON.

***Checkpoint 3: Implement Next.js state-driven renderer***
- [ ] Update the pet renderer in `app/components/IdlePet.tsx` (or split into a state-aware component) to consume `APP_STATE` and select the mapped animation.
- [ ] Configure looping playback and tune playback speed/frame config so each loop is ~5 seconds.
- [ ] Implement runtime fallback so load/render errors resolve to `idle` without unmounting the UI.
- [ ] **Test:** Add component tests for app UI verifying: state switch behavior, unknown state fallback, and missing-file fallback path.

***Checkpoint 4: Implement Chrome extension parity***
- [ ] Add the same state-to-animation behavior to extension UI code (`extension/popup.js` and related extension surface files as needed).
- [ ] Reuse the shared mapping behavior so app and extension semantics stay equivalent.
- [ ] Ensure extension-specific loading constraints (path resolution/CSP-friendly loading) are handled.
- [ ] **Test:** Add extension-facing tests or integration checks verifying supported states and fallback behavior match app behavior.

***Checkpoint 5: Validate loop timing + end-to-end behavior***
- [ ] Verify each state animation loop duration is within 4.5s–5.5s and adjust timing configuration where required.
- [ ] Run a cross-surface smoke pass (app + extension) to confirm state parity and graceful fallback behavior.
- [ ] Document any known timing deviations and planned follow-up fixes if exact timing cannot be achieved from source assets alone.
- [ ] **Test:** Add or run an end-to-end checklist/script that exercises all states plus invalid state and records pass/fail for app and extension.

***Checkpoint 6: Final cleanup + feature handoff***
- [ ] Remove any temporary debug hooks/logging used during animation integration.
- [ ] Update docs/notes (feature or README-level) describing supported states, fallback semantics, and where assets/mapping live.
- [ ] Ensure each checkpoint above can stand as an independent commit with passing tests before moving forward.
- [ ] **Test:** Run project lint/test commands relevant to changed surfaces and verify no regressions in modified files.

