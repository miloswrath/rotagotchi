# Contract: Extension Internal Messaging & Storage

**Feature**: 005-move-to-extension
**Date**: 2026-03-26

This document defines the internal contracts between extension components (background service worker, popup, and future options page). These are intra-extension interfaces, not public APIs.

---

## Storage Contracts

### `chrome.storage.session` key: `tabState`

Written by the background service worker on every tab change. Read by the popup on open and via `onChanged` listener.

```typescript
type TabClassification = 'degenerative' | 'neutral';

interface TabState {
  url: string;           // Full URL of active tab, e.g. "https://youtube.com/watch?v=..."
  hostname: string;      // Extracted hostname, e.g. "youtube.com"
  classification: TabClassification;
  tabId: number;
  timestamp: number;     // Date.now() at time of classification
}

// chrome.storage.session layout
interface SessionStorage {
  tabState: TabState | null;  // null when no tab active or on first install
}
```

**Invariants**:
- `tabState` is always written atomically; no partial updates
- `timestamp` must be set to `Date.now()` at the moment of classification
- A `null` value is valid and must be handled by the popup (render neutral/idle state)

---

### `chrome.storage.local` key: `blacklist`

Written once on extension install (seeded from `lib/whitelist.json`). Overwritten by the options page when the user edits the list.

```typescript
interface LocalStorage {
  blacklist: string[];  // Array of bare domain strings, e.g. ["youtube.com", "instagram.com"]
}
```

**Invariants**:
- All entries are lowercase bare domains (no protocol, no path, no port)
- Duplicates are not allowed
- Empty array is valid (no sites classified as degenerative)
- Must be initialized on `chrome.runtime.onInstalled` if not already present

---

## Runtime Message Contract

One message type is defined for future direct popup notifications (backup to storage polling). Currently not required but reserved.

```typescript
// Sent from background to popup (if popup is open) as supplemental notification
interface TabStateUpdatedMessage {
  type: 'TAB_STATE_UPDATED';
  payload: TabState;
}

type ExtensionMessage = TabStateUpdatedMessage;
```

**Note**: The primary communication channel is `chrome.storage.session` + `chrome.storage.onChanged`. This message type is a fallback for latency-sensitive updates.

---

## Animation State Derivation Contract

The popup derives which animation to play from `TabState.classification`. This mapping is the authoritative source of truth.

```typescript
const ANIMATION_MAP: Record<TabClassification, string> = {
  degenerative: 'angry',   // plays angry.json
  neutral:      'idle',    // plays idle.json
};

// Null/undefined tabState → 'idle'
function resolveAnimation(tabState: TabState | null): string {
  if (!tabState) return 'idle';
  return ANIMATION_MAP[tabState.classification];
}
```

**Invariants**:
- Every `TabClassification` value has a corresponding animation key
- The animation key must match a `.json` file bundled in the extension's `animations/` directory
- Changing the mapping requires updating both this contract and the popup implementation

---

## Required Manifest Permissions

The following permissions must be declared in `manifest.json` for the above contracts to function:

| Permission | Why Needed |
|-----------|------------|
| `storage` | Read/write `chrome.storage.session` and `chrome.storage.local` |
| `tabs` | Access `url` property in `onActivated` / `onUpdated` events |
| `activeTab` | Retained from existing manifest |
| `scripting` | Retained from existing manifest |

`host_permissions: ["<all_urls>"]` is already declared and satisfies URL access requirements.
