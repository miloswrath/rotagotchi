import { classify } from './classify';
import { getValidSession } from './auth';

/** Default degenerative-content domains (seeded from lib/whitelist.json). */
const DEFAULT_BLACKLIST = [
  'youtube.com',
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'twitter.com',
];

// ─── T023: Startup — proactive token refresh ─────────────────────────────────
// Refresh an expiring session in the background when Chrome starts so the
// popup never has to wait for a refresh when first opened.

chrome.runtime.onStartup.addListener(async () => {
  try {
    await getValidSession();
  } catch {
    // Non-fatal — popup will handle expired sessions on next open.
  }
});

// ─── Install / Update ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Rotagotchi extension installed');
  const result = await chrome.storage.local.get('blacklist');
  if (!Array.isArray(result.blacklist)) {
    await chrome.storage.local.set({ blacklist: DEFAULT_BLACKLIST });
  }
});

// ─── Tab state helpers ────────────────────────────────────────────────────────

async function updateTabState(tabId: number, url: string): Promise<void> {
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    // internal or malformed URL — hostname stays empty
  }

  const classification = await classify(url);

  await chrome.storage.session.set({
    tabState: {
      url,
      hostname,
      classification,
      tabId,
      timestamp: Date.now(),
    },
  });
}

// ─── Tab event listeners ──────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    await updateTabState(activeInfo.tabId, tab.url);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id === tabId) {
    await updateTabState(tabId, changeInfo.url);
  }
});
