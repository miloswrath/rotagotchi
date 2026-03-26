# Research: Move Tamagotchi Logic to Browser Extension

**Feature**: 005-move-to-extension
**Date**: 2026-03-26
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision 1: Animation Library for Extension Popup

**Decision**: Use `lottie-web` directly (vanilla JS) instead of `lottie-react`.

**Rationale**: The extension popup (`popup.html` / `popup.js`) is plain HTML/JavaScript with no React runtime. `lottie-react` is a React wrapper around `lottie-web`; using `lottie-react` would require bundling all of React into the extension, adding ~50KB+ of overhead with no benefit. `lottie-web` is the underlying library — it provides all the same animation capabilities (load, play, loop, switch animations) via a direct DOM API.

**Alternatives considered**:
- `lottie-react` — rejected: requires React runtime, not appropriate for a plain JS extension popup
- CSS animations — rejected: the existing art assets are Lottie JSON format; replacing them would require redesigning all animations
- Canvas-based render — rejected: lottie-web already handles canvas/SVG rendering; no need for a separate solution

---

## Decision 2: Extension Build Tooling

**Decision**: Add a lightweight build step (esbuild) to bundle `lottie-web` and enable TypeScript in extension files.

**Rationale**: The extension currently has no bundler. `lottie-web` must be bundled (not loaded via CDN) because Manifest v3's Content Security Policy prohibits remote script loading. Adding esbuild (already common in the ecosystem) allows: (1) bundling lottie-web, (2) writing extension code in TypeScript (consistent with the rest of the codebase), (3) inlining or copying the lottie JSON assets into the extension output directory.

**Alternatives considered**:
- Copy lottie-web UMD bundle manually — rejected: manual file management, no TypeScript, harder to maintain
- Use a `<script>` tag pointing to a CDN — rejected: blocked by MV3 CSP, would cause a runtime error
- No bundler, use ES module imports — rejected: MV3 service workers support ES modules but popup HTML does not easily support dynamic imports of `node_modules`

---

## Decision 3: Whitelist Naming Clarification

**Decision**: The existing `whitelist.json` is the **degenerative content list** (called "blacklist" in the constitution). The feature spec uses "whitelist" loosely. All implementation artifacts will use the constitution's terminology.

**Rationale**: `lib/whitelist.json` contains `["youtube.com", "instagram.com", "facebook.com", "tiktok.com", "twitter.com"]` — social media and entertainment sites. Per the constitution's Operational Policy: "The whitelist identifies work-related domains/apps; the blacklist identifies degenerative content." These domains are degenerative content, not work domains. The file is therefore the **blacklist** by constitution definition, despite its filename. Implementation will rename or wrap it accordingly.

**Classification rules (per Constitution Principle V)**:
- URL hostname matches an entry in `blacklist` (degenerative list) → classified as `degenerative`
- URL hostname not in any list → classified as `neutral` (defaults to non-work per constitution: "unknowns default to non-work")
- Browser-internal URLs (`chrome://`, `edge://`, `about:`, `chrome-extension://`) → classified as `neutral`
- Blacklist takes precedence over any future whitelist entries

**Pet animation mapping**:
- `degenerative` → `angry.json` (pet distressed; user is on off-task content while potentially owing watch time)
- `neutral` (work or unknown) → `idle.json` (pet calm; user is on non-degenerative content)
- No active tab / internal page → `idle.json` (neutral, no error state shown)

**Note**: A future feature may add a work-domain whitelist (for "happy" state distinct from neutral). This feature scopes to two states: distressed (on blacklist) vs. idle (not on blacklist).

---

## Decision 4: Tab URL Monitoring Architecture

**Decision**: Background service worker monitors `chrome.tabs.onActivated` and `chrome.tabs.onUpdated` events, classifies the URL, and persists state to `chrome.storage.session`. Popup reads from storage on open and listens for storage changes.

**Rationale**: MV3 service workers are ephemeral — they spin down when idle and cannot hold in-memory state reliably. `chrome.storage.session` (cleared on browser close) is the right persistence tier for tab classification state: it survives popup open/close cycles but not intentional resets. The popup subscribes to `chrome.storage.onChanged` to react to background updates even while open.

**Alternatives considered**:
- `chrome.runtime.sendMessage` from background to popup — rejected: only works if popup is open; cannot push state to a closed popup
- `chrome.storage.local` for tab state — rejected: local storage persists indefinitely; stale state on browser restart is undesirable for a live classification signal
- Content script as intermediary — rejected: adds unnecessary complexity; background already has access to tab URL via the `tabs` API

---

## Decision 5: Lottie JSON File Placement

**Decision**: Copy lottie JSON files (`idle.json`, `angry.json`, etc.) from `/rot/` into the extension build output directory at build time. Declare them in `web_accessible_resources` for future flexibility.

**Rationale**: Chrome extension files must be packaged within the extension directory. The existing files in `/rot/` are shared assets used by both the Next.js app and the extension. A build script copies them into `extension/dist/animations/` so both consumers can maintain one source of truth in `/rot/`.

**Alternatives considered**:
- Hard-copy JSON files directly into `/extension/` — rejected: duplicates assets, diverges from source
- Fetch animations from the Next.js app at runtime — rejected: requires the app to be running; breaks offline use

---

## Decision 6: `tabs` Permission

**Decision**: Add the `tabs` permission to `manifest.json` (currently only `activeTab`, `storage`, `scripting` are declared).

**Rationale**: `activeTab` grants access to the current tab only when the user explicitly invokes the extension (clicks the icon). To monitor all tab switches passively (even without user interaction), the `tabs` permission is required for `chrome.tabs.onActivated` and `chrome.tabs.onUpdated` to return the `url` property. Without `tabs`, URL is undefined in those events.

---

## Summary of Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| Lottie library for extension | `lottie-web` (vanilla JS, bundled via esbuild) |
| Build tooling for extension | esbuild added as dev dependency |
| "Whitelist" vs "blacklist" naming | Existing `whitelist.json` = blacklist (degenerative domains) per constitution |
| URL classification logic | Domain-level match; blacklist wins; unknowns = neutral; internal pages = neutral |
| Background ↔ popup communication | `chrome.storage.session` + `chrome.storage.onChanged` |
| Lottie JSON asset placement | Copied from `/rot/` into extension build output at build time |
| `tabs` permission | Must be added to manifest |
