# Quickstart: Move Tamagotchi Logic to Extension

**Feature**: 005-move-to-extension
**Date**: 2026-03-26

## Prerequisites

- Node.js 20+
- Chrome or Chromium browser
- Existing project setup (`npm install` already run)

## Building the Extension

```bash
# Build the extension (compiles TypeScript, bundles lottie-web, copies animation assets)
npm run build:extension

# Output: extension/dist/
```

## Loading in Chrome (Development)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/dist/` directory
5. Pin the Rotagotchi extension icon to the toolbar

## Running Tests

```bash
# Unit tests (classification logic)
npm run test:unit

# E2E extension tests (requires Chrome)
npm run test:e2e

# All tests
npm test
```

## Verifying the Feature

1. Load the extension (see above)
2. Navigate to `https://youtube.com` → click the extension icon → pet should show **angry** animation
3. Navigate to `https://github.com` → click the extension icon → pet should show **idle** animation
4. Switch tabs rapidly between youtube.com and github.com → pet state should update within 1 second

## Editing the Blacklist (Development)

The default blacklist is seeded from `lib/whitelist.json` on install. To test with different domains:

```javascript
// In Chrome DevTools console (Extensions > Rotagotchi > Service Worker > Console)
chrome.storage.local.set({ blacklist: ['youtube.com', 'reddit.com'] });
```

## Key Files

| File | Purpose |
|------|---------|
| `extension/src/background.ts` | Tab URL monitoring and classification |
| `extension/src/popup.ts` | Lottie animation rendering |
| `extension/popup.html` | Popup UI shell |
| `extension/manifest.json` | Extension configuration |
| `lib/whitelist.json` | Default degenerative domain list (blacklist seed) |
| `rot/*.json` | Lottie animation assets |
