# Rotagotchi Chrome Extension (Development)

## Prerequisites

Create `.env.local` in the project root with the Supabase credentials before building.
Without it the build will warn and the extension will crash at startup (blank popup, broken service worker).

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

## Build

```bash
npm run build:extension
```

This compiles TypeScript, bundles dependencies, and copies animation files into `extension/dist/`.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder (not `extension/dist/`)

The extension has a fixed key in `manifest.json` so the extension ID is the same on every
machine. After loading, verify the ID shown in `chrome://extensions` matches what you have
configured in Supabase.

## Supabase redirect URL (required for sign-in)

The GitHub OAuth flow uses `chrome.identity.launchWebAuthFlow`, which redirects back through
`https://<extensionId>.chromiumapp.org/`. Supabase must have this URL in its allowed list.

**One-time setup:**

1. Load the extension in Chrome and note the **Extension ID** shown in `chrome://extensions`
2. Open your Supabase project → **Authentication** → **URL Configuration** → **Redirect URLs**
3. Add: `https://<extensionId>.chromiumapp.org/`

The extension ID is pinned by the `"key"` field in `manifest.json`, so it will be the same
on every machine that loads this extension — you only need to add the URL to Supabase once.

If sign-in opens the web app in a separate popup window instead of completing silently,
the redirect URL is missing from Supabase or the Supabase URL is wrong in `.env.local`.

## Files

- `manifest.json`: Manifest V3 config (includes pinned `key` for stable extension ID)
- `src/`: TypeScript source — compiled to `dist/` by `npm run build:extension`
- `dist/`: Build output (gitignored) — `background.js`, `popup.js`, `options.js`, animations
- `popup.html`, `options.html`: Extension UI pages (load `dist/*.js`)
- `content.js`: Minimal content script injected on all pages
