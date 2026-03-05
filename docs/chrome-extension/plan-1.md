You’ve got two separate problems to solve:

1. **Auth** (OAuth to GitHub)
2. **“Listen for commits”** (getting notified when new commits happen)

A Chrome extension can do (1) entirely client-side, but (2) is either **polling** or **a backend webhook relay** (GitHub can’t push events straight into a user’s browser reliably without a server you control).

Below is a build plan that starts with a working MVP (polling), then the recommended “real” version (webhooks), then publishing.

---

## Architecture options (pick one)

### Option A — MVP (no server): poll GitHub

* Extension stores a token + list of repos
* A scheduled alarm runs every N minutes
* For each repo, fetch “latest commit SHA on default branch”
* If SHA changed, fetch commit details and compute **diff size**
* Trigger your post-diff function

Pros: simplest to ship.
Cons: not real-time; rate limits; misses events between polls if you only track “latest.”

### Option B — Recommended: GitHub webhook → your backend → extension

* Users authorize via OAuth
* Your backend registers **webhooks** on selected repos (or uses GitHub App install)
* Backend receives push events, computes diff size, then notifies extension (WebSocket / SSE / long-poll / FCM)

Pros: near-real-time, scalable, less API polling.
Cons: you need a server and webhook security.

GitHub webhooks have payload constraints (e.g., payloads capped) so you should expect to occasionally fetch extra detail via API if needed. ([GitHub Docs][1])

---

# Part 1 — Build the extension core (Manifest V3)

## 1) Project skeleton

* `manifest.json`
* `background.js` (service worker)
* `popup.html` + `popup.js` (connect + repo selection UI)
* `options.html` (optional; settings)
* `icons/`

## 2) Manifest essentials (MV3)

You’ll want:

* `background.service_worker`
* `action.default_popup`
* `permissions`: `storage`, `alarms`, `notifications` (if you notify), maybe `identity`
* `host_permissions`: `https://api.github.com/*` (and any backend domain if you add one)

Also note MV3 store requirements: your extension’s functionality must be discernible from submitted code; you can fetch data externally but shouldn’t load remote “logic.” ([Chrome for Developers][2])

---

# Part 2 — OAuth to GitHub (client-side)

## 3) Create a GitHub OAuth App

In GitHub Developer Settings:

* Register an OAuth app ([GitHub Docs][3])
* Set a callback/redirect URL you’ll use with the extension flow (details below)

GitHub supports standard OAuth authorization flows for OAuth Apps. ([GitHub Docs][4])

## 4) Use `chrome.identity.launchWebAuthFlow` pattern

Chrome provides `chrome.identity` APIs for OAuth flows inside extensions. ([Chrome for Developers][5])

**Recommended flow for extensions:**

1. Build an `authorize` URL:

   * `https://github.com/login/oauth/authorize`
   * `client_id=...`
   * `redirect_uri=<your extension redirect URL>`
   * `scope=repo` (or narrower if possible)
   * `state=<random>` (CSRF protection)

2. Call:

   * `chrome.identity.launchWebAuthFlow({ url, interactive: true })`

3. Parse the returned redirect URL to extract `code` and verify `state`

4. Exchange `code` for an access token

### Critical security note (don’t skip)

**Do not ship a GitHub OAuth client secret inside the extension.**
If you’re using the “authorization code” flow, the code→token exchange typically requires a client secret—meaning you should do that exchange on a backend you control.

**If you insist on no backend**, your safest MVP is:

* use polling + an auth approach that doesn’t require embedding a secret (often ends up being device flow, but that has UX tradeoffs and must be enabled in the app settings) ([GitHub Docs][4])

In practice, for production: **extension gets code → backend exchanges for token → backend returns token** (or better, backend stores token and issues your own session).

---

# Part 3 — “Listen for commits” + diff size

## 5) Repo selection UI

In popup:

* After auth, list repos user can access (REST: “list repos”)
* Let user select repos + branch (default branch is fine initially)
* Store selection in `chrome.storage.sync`/`local`

## 6) Compute diff size (simple, reliable)

For each new commit SHA you detect, call the GitHub “Get a commit” endpoint and use:

* `stats.total` (or additions + deletions)
* and/or sum `files[].changes`

GitHub’s commit API response includes `stats` and `files` metadata. ([GitHub Docs][6])

Define your “diff size” precisely (pick one):

* **Total line changes**: `stats.total`
* **Total additions**: `stats.additions`
* **Total deletions**: `stats.deletions`
* **Files changed**: `files.length`
* **Weighted score**: e.g., `stats.total + files.length*10`

Then:

* If diff size > threshold → run function A
* Else → run function B

## 7) MVP polling loop (no server)

In `background.js`:

* On install, set an alarm: `chrome.alarms.create('poll', { periodInMinutes: X })`
* On alarm:

  * For each repo:

    * fetch latest SHA on branch
    * compare to last-seen SHA in storage
    * if changed:

      * fetch commit details → compute diff size → run function

Be careful about:

* rate limiting (use ETags / `If-None-Match` caching if you can)
* storing “last seen” per repo+branch
* handling multiple commits between polls (you might need to walk history, not just “latest”)

## 8) Production webhook loop (recommended)

Instead of polling:

* Backend registers GitHub webhook(s) on selected repos
* Backend receives `push` events, then (optionally) calls commit API to compute diff size
* Backend notifies the extension:

  * easiest: extension polls your backend every minute for “new events”
  * better: WebSocket/SSE
* Extension runs post-diff function locally

Webhook docs emphasize payload constraints; treat webhook as a “signal,” and fetch exact details via API when needed. ([GitHub Docs][1])

---

# Part 4 — Hardening checklist (before publishing)

## 9) Permissions minimization

* Request `repo` scope only if needed; prefer narrower scopes if possible
* Limit `host_permissions` to `api.github.com` + your backend only
* Avoid `<all_urls>`

## 10) Token storage & safety

* Store tokens in `chrome.storage` (not localStorage)
* Treat tokens as secrets:

  * don’t log them
  * don’t send to random domains
  * if using a backend, store tokens server-side whenever possible

## 11) MV3 compliance

* No remotely hosted executable code
* Keep logic in the extension bundle
* External calls should be data, not code ([Chrome for Developers][2])

---

# Part 5 — Publishing (Chrome Web Store)

## 12) You’ll need

* Icons (16/48/128)
* Store listing text + screenshots
* Privacy disclosures (especially because you access GitHub account/repo data)

## 13) Package

* bump `version` in `manifest.json`
* zip the extension directory (manifest at root)
* upload to the Chrome Web Store developer dashboard
* complete permission justifications + privacy section
* submit for review

---

## What I would implement first (fastest path)

1. OAuth (with backend token exchange—don’t embed secrets)
2. Repo picker UI
3. Polling every 5–10 minutes
4. Diff size via commit endpoint `stats.total` ([GitHub Docs][6])
5. Notifications + “run function” stub
6. Later: replace polling with webhook relay

If you tell me your exact “function afterwards” (notify? open PR? run local analysis? call another API?), I’ll translate this into a concrete file-by-file implementation plan (manifest + background + popup + backend endpoints) with the minimal scopes/permissions to avoid store review pain.

[1]: https://docs.github.com/en/webhooks/webhook-events-and-payloads?utm_source=chatgpt.com "Webhook events and payloads"
[2]: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements?utm_source=chatgpt.com "Additional Requirements for Manifest V3 - Program Policies"
[3]: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app?utm_source=chatgpt.com "Creating an OAuth app"
[4]: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps?utm_source=chatgpt.com "Authorizing OAuth apps"
[5]: https://developer.chrome.com/docs/extensions/reference/api/identity?utm_source=chatgpt.com "chrome.identity | API"
[6]: https://docs.github.com/v3/repos/commits?utm_source=chatgpt.com "REST API endpoints for commits"
