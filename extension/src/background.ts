import { classify, classifyUrl } from './classify';
import { getValidSession } from './auth';
import {
  readGameState,
  writeGameState,
  fetchNewCommits,
  processTick,
  resetGameState,
  DEFAULT_GAME_STATE,
  TICK_INTERVAL_MIN_MS,
  TICK_INTERVAL_MAX_MS,
} from './game';
import { fireNotification } from './notifications';

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
  await ensureGameStateInitialized();
  await ensureGameTickAlarm();
});

// ─── Install / Update ────────────────────────────────────────────────────────

async function ensureGameStateInitialized(): Promise<void> {
  const result = await chrome.storage.local.get('gameState');
  if (!result.gameState) {
    await writeGameState({ ...DEFAULT_GAME_STATE, lastTickAt: Date.now() });
  }
}

async function ensureGameTickAlarm(): Promise<void> {
  const existing = await chrome.alarms.get('game-tick');
  if (!existing) {
    const gameState = await readGameState();
    chrome.alarms.create('game-tick', {
      periodInMinutes: gameState.tickIntervalMs / 60_000,
    });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Rotagotchi extension installed');
  const result = await chrome.storage.local.get('blacklist');
  if (!Array.isArray(result.blacklist)) {
    await chrome.storage.local.set({ blacklist: DEFAULT_BLACKLIST });
  }
  await ensureGameStateInitialized();
  await ensureGameTickAlarm();
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

// ─── Game tick ───────────────────────────────────────────────────────────────

interface TabState {
  url: string;
  hostname: string;
  classification: 'degenerative' | 'neutral';
  tabId: number;
  timestamp: number;
}

async function runGameTick(): Promise<void> {
  try {
    const gameState = await readGameState();

    // Read current tab state + blacklist.
    const storageResult = await chrome.storage.session.get('tabState');
    const tabState = (storageResult.tabState as TabState | undefined) ?? null;
    const localResult = await chrome.storage.local.get('blacklist');
    const blacklist: string[] = Array.isArray(localResult.blacklist) ? localResult.blacklist : [];

    // Determine current site classification.
    const currentClassification = tabState
      ? classifyUrl(tabState.url, blacklist)
      : 'neutral' as const;

    console.log('[rotagotchi] tick', {
      url: tabState?.url ?? '(none)',
      currentClassification,
      health: gameState.health,
      debtSeconds: gameState.debtSeconds,
      tickIntervalMs: gameState.tickIntervalMs,
      elapsedMs: gameState.lastTickAt > 0 ? Date.now() - gameState.lastTickAt : gameState.tickIntervalMs,
    });

    // Fetch new commits if authenticated.
    let newCommits: import('./game').CommitRecord[] = [];
    try {
      const session = await getValidSession();
      if (session) {
        newCommits = await fetchNewCommits(session, gameState.lastCommitAt);
      }
    } catch (err) {
      console.error('[rotagotchi] Session/commit fetch error:', err);
    }

    const elapsedMs = gameState.lastTickAt > 0
      ? Date.now() - gameState.lastTickAt
      : gameState.tickIntervalMs;

    const { nextState, notifications } = processTick({
      gameState,
      currentClassification,
      newCommits,
      elapsedMs,
    });

    await writeGameState(nextState);

    for (const n of notifications) {
      try {
        await fireNotification(n);
      } catch (err) {
        console.error('[rotagotchi] Notification error:', err);
      }
    }
  } catch (err) {
    console.error('[rotagotchi] Game tick error:', err);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'game-tick') {
    await runGameTick();
  }
});

// ─── Message handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message.type !== 'string') return;

  if (message.type === 'RESTART_GAME') {
    (async () => {
      const freshState = resetGameState();
      await writeGameState(freshState);
      await chrome.alarms.clear('game-tick');
      chrome.alarms.create('game-tick', {
        periodInMinutes: freshState.tickIntervalMs / 60_000,
      });
    })();
  }

  if (message.type === 'SET_TICK_SPEED') {
    (async () => {
      const intervalMs = Math.max(
        TICK_INTERVAL_MIN_MS,
        Math.min(TICK_INTERVAL_MAX_MS, message.intervalMs ?? TICK_INTERVAL_MAX_MS),
      );
      const gameState = await readGameState();
      gameState.tickIntervalMs = intervalMs;
      gameState.lastTickAt = Date.now();
      await writeGameState(gameState);
      await chrome.alarms.clear('game-tick');
      chrome.alarms.create('game-tick', {
        periodInMinutes: intervalMs / 60_000,
      });
    })();
  }
});
