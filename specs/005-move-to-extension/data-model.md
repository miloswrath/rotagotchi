# Data Model: Move Tamagotchi Logic to Browser Extension

**Feature**: 005-move-to-extension
**Date**: 2026-03-26

---

## Entities

### TabClassification

Represents the result of classifying the currently active browser tab.

| Field | Type | Description |
|-------|------|-------------|
| `url` | `string` | Full URL of the active tab (e.g., `https://youtube.com/watch?v=...`) |
| `hostname` | `string` | Extracted hostname used for classification (e.g., `youtube.com`) |
| `classification` | `'degenerative' \| 'neutral'` | Result of blacklist check |
| `tabId` | `number` | Chrome tab ID of the active tab |
| `timestamp` | `number` | Unix epoch milliseconds when classification was determined |

**Validation rules**:
- `url` must be a valid URL string; `chrome://`, `edge://`, `about:`, and `chrome-extension://` URLs are classified as `neutral` without hostname extraction
- `hostname` is the `hostname` property of a parsed URL (no port, no protocol)
- `classification` defaults to `neutral` if the hostname is not found in the blacklist
- `timestamp` is always set; stale entries (older than browser session) are discarded on startup

**State transitions**:
```
[any state] --tab activated/updated--> classify(url) --match--> degenerative
                                                     --no match--> neutral
                                                     --internal url--> neutral
```

---

### BlacklistEntry

A single domain in the degenerative-content deny list (sourced from `lib/whitelist.json`).

| Field | Type | Description |
|-------|------|-------------|
| `domain` | `string` | Bare domain to block (e.g., `youtube.com`) |

**Matching rules**:
- Exact hostname match: `youtube.com` matches `youtube.com`
- Subdomain match: `youtube.com` matches `m.youtube.com`, `www.youtube.com`
- Does NOT match across TLDs: `youtube.com` does NOT match `youtube.co.uk`
- Case-insensitive comparison

**Source**: `lib/whitelist.json` (array of domain strings). User-editable copy is stored in `chrome.storage.local` under the key `blacklist`. On first install, the default list from `lib/whitelist.json` is written to storage.

---

### PetAnimationState

The animation currently being played in the extension popup. Derived from `TabClassification`.

| Field | Type | Description |
|-------|------|-------------|
| `animation` | `'idle' \| 'angry'` | The lottie JSON file to play |
| `loop` | `boolean` | Whether the animation loops (always `true`) |

**Derivation rules**:
- `TabClassification.classification === 'degenerative'` → `animation: 'angry'`
- `TabClassification.classification === 'neutral'` → `animation: 'idle'`

**Extensibility**: Additional animation states (`excited`, `starving`, `death`) exist as JSON assets in `/rot/` and can be mapped to additional classifications in future features (e.g., when the tamagotchi health/debt system is integrated).

---

## Storage Schema

### `chrome.storage.session` — volatile, cleared on browser close

```typescript
interface SessionStorage {
  tabState: {
    url: string;
    hostname: string;
    classification: 'degenerative' | 'neutral';
    tabId: number;
    timestamp: number;
  } | null;
}
```

Key: `tabState`
Written by: background service worker on every tab activation/navigation
Read by: popup on open, and on `chrome.storage.onChanged` events

### `chrome.storage.local` — persistent across sessions

```typescript
interface LocalStorage {
  blacklist: string[];   // User's degenerative-domain list
}
```

Key: `blacklist`
Default value: contents of `lib/whitelist.json` at install time
Written by: options page (future) or extension install handler
Read by: background service worker for classification

---

## Classification Logic (pseudocode)

```
function classify(url: string): 'degenerative' | 'neutral'
  if url starts with chrome:// or edge:// or about: or chrome-extension://
    return 'neutral'

  hostname = new URL(url).hostname.toLowerCase()
  blacklist = await chrome.storage.local.get('blacklist')

  for each domain in blacklist
    if hostname === domain OR hostname ends with '.' + domain
      return 'degenerative'

  return 'neutral'   // unknown defaults to neutral (non-work)
```

This implements Constitution Principle V: "The blacklist takes precedence; unknowns default to non-work."
