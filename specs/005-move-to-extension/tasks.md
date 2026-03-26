# Tasks: Move Tamagotchi Logic to Browser Extension

**Input**: Design documents from `/specs/005-move-to-extension/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Unit tests included for classification engine (core logic). E2E and smoke tests extend existing Playwright infrastructure.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add build tooling and TypeScript source scaffolding needed for all user stories.

- [x] T001 Add `lottie-web` as a runtime dependency and `esbuild` as a dev dependency in `package.json`
- [x] T002 Create `extension/src/` directory and add empty TypeScript source files: `background.ts`, `popup.ts`, `classify.ts`
- [x] T003 [P] Create `extension/tsconfig.json` — TypeScript config for `extension/src/` targeting ES2020, module `commonjs`, strict mode, resolving against project root
- [x] T004 Add `build:extension` npm script in `package.json` — runs esbuild on `extension/src/background.ts`, `extension/src/popup.ts`, and `extension/src/classify.ts`, outputs to `extension/dist/`, then copies `rot/idle.json` and `rot/angry.json` to `extension/dist/animations/`
- [x] T005 Add `extension/dist/` to `.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required before any user story can be implemented — manifest permissions, classification engine, and storage initialization.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 Update `extension/manifest.json` — add `"tabs"` to the `permissions` array; add `web_accessible_resources` entry declaring `["dist/animations/*.json"]` for `<all_urls>`; update `background.service_worker` to `"dist/background.js"`
- [x] T007 Implement `classify(url: string): Promise<'degenerative' | 'neutral'>` in `extension/src/classify.ts` — parse URL hostname, read blacklist from `chrome.storage.local`, return `'degenerative'` if hostname matches any entry exactly or as a subdomain (e.g., `m.youtube.com` matches `youtube.com`), return `'neutral'` for internal URLs (`chrome://`, `edge://`, `about:`, `chrome-extension://`) and for any unmatched hostname
- [x] T008 [P] Write unit tests in `tests/unit/classify.spec.ts` — cover: (1) exact blacklist match returns `'degenerative'`, (2) subdomain match (`m.youtube.com`) returns `'degenerative'`, (3) unlisted domain returns `'neutral'`, (4) `chrome://` URL returns `'neutral'`, (5) `about:newtab` returns `'neutral'`, (6) empty blacklist returns `'neutral'` for any URL
- [x] T009 Add `chrome.runtime.onInstalled` handler in `extension/src/background.ts` — check if `chrome.storage.local` already has a `blacklist` key; if not, seed it with the contents of the bundled default list (the five domains from `lib/whitelist.json`: youtube.com, instagram.com, facebook.com, tiktok.com, twitter.com hardcoded as a constant)

**Checkpoint**: Classification engine passes all unit tests. Manifest permissions are updated. Extension can be loaded in Chrome without errors.

---

## Phase 3: User Story 1 — Pet Reacts to Current Tab (Priority: P1) 🎯 MVP

**Goal**: The pet animation in the extension popup changes to reflect whether the active tab is on the degenerative-content list — `angry.json` for blacklisted sites, `idle.json` for all others.

**Independent Test**: Load extension in Chrome → navigate to `https://youtube.com` → open popup → see angry animation playing. Navigate to `https://github.com` → open popup (or observe while open) → see idle animation playing. Switch tabs rapidly → animation updates within 1 second.

### Implementation for User Story 1

- [x] T010 [US1] Update `extension/popup.html` — add `<div id="pet-container" style="width:256px;height:256px;"></div>` as the lottie mount point; change `<script src="popup.js">` to `<script src="dist/popup.js">`
- [x] T011 [US1] Implement animation rendering in `extension/src/popup.ts` — on DOMContentLoaded: (1) read `tabState` from `chrome.storage.session`, (2) resolve animation filename using `ANIMATION_MAP` from the contracts (`degenerative` → `angry`, `neutral` → `idle`, null → `idle`), (3) load the resolved animation JSON via `fetch(chrome.runtime.getURL('dist/animations/<name>.json'))`, (4) call `lottie.loadAnimation({ container, animationData, renderer: 'svg', loop: true, autoplay: true })`
- [x] T012 [US1] Implement tab event listeners in `extension/src/background.ts` — add `chrome.tabs.onActivated` listener that gets the active tab URL and calls `classify()`, then write `TabState` object (`{ url, hostname, classification, tabId, timestamp }`) to `chrome.storage.session` key `tabState`; add `chrome.tabs.onUpdated` listener filtered on `changeInfo.url` to handle same-tab navigations
- [x] T013 [US1] Subscribe to `chrome.storage.onChanged` in `extension/src/popup.ts` — when `tabState` key changes in `chrome.storage.session`, destroy the current lottie instance and reload the appropriate animation without closing/reopening the popup
- [x] T014 [US1] Add E2E test cases in `tests/e2e/extension.spec.ts` — (1) navigate to `https://www.youtube.com`, open popup, assert `#pet-container svg` is present and no error state; (2) navigate to `https://github.com`, open popup, assert `#pet-container svg` is present; (3) switch tabs and verify popup reflects updated state within 1 second

**Checkpoint**: User Story 1 is fully functional. The pet reacts to the current tab. MVP is shippable.

---

## Phase 4: User Story 2 — Pet Visible via Extension Popup (Priority: P2)

**Goal**: The popup reliably shows the animated pet on every open, with correct state restored from the last classification — even after the popup was closed and reopened.

**Independent Test**: Open popup with no prior tab navigation → idle animation plays (no blank screen, no error). Close and reopen popup while on youtube.com → angry animation resumes (state persists across popup open/close cycles).

### Implementation for User Story 2

- [x] T015 [US2] Harden the `chrome.storage.session` read in `extension/src/popup.ts` — ensure `null` / `undefined` tabState renders `idle.json` cleanly with no console errors or blank popup
- [x] T016 [P] [US2] Add smoke test in `tests/smoke/extension-loads.spec.ts` — load extension, open popup, assert `#pet-container` exists in the DOM and contains at least one child element (animation mounted), assert no JS errors in the popup console
- [x] T017 [US2] Validate lottie render dimensions in `extension/src/popup.ts` — pass `rendererSettings: { preserveAspectRatio: 'xMidYMid slice' }` and explicitly set container `width` and `height` to 256px so animation renders at consistent size matching the Next.js app

**Checkpoint**: User Story 2 complete. Popup always shows an animation; state survives popup close/reopen.

---

## Phase 5: User Story 3 — Whitelist Configuration (Priority: P3)

**Goal**: Users can view and edit the degenerative-content domain list from within the extension. Changes take effect immediately.

**Independent Test**: Open extension options page → add `reddit.com` to the list → navigate to `https://reddit.com` → open popup → angry animation plays. Remove `reddit.com` from the list → navigate to `https://reddit.com` → popup shows idle animation.

### Implementation for User Story 3

- [x] T018 [P] [US3] Create `extension/options.html` — options page with heading "Manage Blocked Sites", an unordered list (`<ul id="domain-list">`), a text input (`<input id="new-domain" placeholder="e.g. reddit.com">`), an Add button, and a `<script src="dist/options.js">` reference
- [x] T019 [US3] Implement `extension/src/options.ts` — on load: read `blacklist` from `chrome.storage.local` and render each domain as a list item with a Remove button; Add button: validate input is a bare domain (no protocol, no path), check for duplicates, push to blacklist, write back to `chrome.storage.local`, re-render list; Remove button: filter domain out of blacklist, write back, re-render
- [x] T020 [US3] Register options page in `extension/manifest.json` — add `"options_page": "options.html"` field
- [x] T021 [US3] Add `extension/src/options.ts` as a fourth esbuild entry point in the `build:extension` script in `package.json`, outputting `extension/dist/options.js`

**Checkpoint**: All three user stories are independently functional. Users can configure the classification list.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation and cleanup across all stories.

- [x] T022 Run `npm run build:extension && npm test && npm run lint` — resolve all TypeScript compile errors and ESLint violations in `extension/src/`; confirm all pre-existing unit, integration, e2e, and smoke tests still pass
- [x] T023 [P] Follow `quickstart.md` end-to-end — build extension, load unpacked in Chrome, perform the three verification steps (youtube.com → angry, github.com → idle, rapid tab switching) and confirm all pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Phase 2 — no dependency on US2 or US3
- **User Story 2 (Phase 4)**: Depends on Phase 2 — **note**: US2's popup polish depends on US1's `popup.ts` implementation
- **User Story 3 (Phase 5)**: Depends on Phase 2 — fully independent of US1 and US2
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — independent
- **US2 (P2)**: Can start after US1 (reuses `popup.ts` built in US1) — lightly coupled
- **US3 (P3)**: Can start after Phase 2 — fully independent of US1 and US2

### Within Each User Story

- `classify.ts` (T007) must be complete before `background.ts` (T012) can import it
- `popup.ts` animation init (T011) must be complete before storage listener (T013) can be added
- Manifest `tabs` permission (T006) must be in place before `background.ts` tab events return URLs

### Parallel Opportunities

- T003, T008 can run in parallel during Phase 1/2 setup (different files)
- T018 and T019 can start in parallel within US3 (HTML and TS files are independent)
- T016 (US2 smoke test) can run in parallel with T015 and T017
- T022 and T023 can run in parallel in the Polish phase

---

## Parallel Example: User Story 1

```bash
# After Foundational phase completes, launch in parallel:
Task A: "Implement animation rendering in extension/src/popup.ts" (T011)
Task B: "Implement tab event listeners in extension/src/background.ts" (T012)
# T011 and T012 write to different files with no shared in-progress state

# After T011 completes:
Task: "Subscribe to chrome.storage.onChanged in extension/src/popup.ts" (T013)

# After T012 completes:
Task: "Add E2E test cases in tests/e2e/extension.spec.ts" (T014)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T009) — pass unit tests (T008)
3. Complete Phase 3: User Story 1 (T010–T014)
4. **STOP and VALIDATE**: Navigate to youtube.com → open popup → see angry animation; navigate to github.com → see idle animation
5. E2E test suite passes

### Incremental Delivery

1. Phase 1 + 2 → Classification engine working, extension loads cleanly
2. Phase 3 → Tab-reactive pet animation in popup (MVP shipped)
3. Phase 4 → Popup is robust and polished across all open/close cycles
4. Phase 5 → Users can self-configure blocked domains
5. Phase 6 → Full test suite passes, quickstart validated

### Parallel Team Strategy

With two developers after Phase 2:
- Developer A: User Story 1 (background.ts + popup.ts animation)
- Developer B: User Story 3 (options.html + options.ts) — fully independent

---

## Notes

- `[P]` tasks touch different files with no in-progress dependencies
- `[Story]` label maps each task to its user story for traceability
- Classification engine in `classify.ts` is the core logic; unit tests (T008) validate it before any UI work
- `lib/whitelist.json` is the source of truth for the default blacklist; it is NOT modified by this feature
- `extension/dist/` is build output and must be gitignored (T005)
- The `angry.json` animation is used for degenerative tabs; `idle.json` for all others. Additional animation states (`excited`, `starving`, `death`) exist in `/rot/` and are available for future features.
