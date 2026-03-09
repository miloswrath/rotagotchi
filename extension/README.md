# Rotagotchi Chrome Extension (Development)

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `extension/`

## Files

- `manifest.json`: Manifest V3 config
- `background.js`: service worker for extension lifecycle/events
- `content.js`: content script loaded on matched pages
- `popup.html` + `popup.js`: toolbar popup UI
