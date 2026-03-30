import lottie, { AnimationItem } from 'lottie-web';
import {
  getValidSession,
  launchOAuthFlow,
  signOut,
  onSessionChanged,
  StoredAuthSession,
  PopupScreen,
} from './auth';
import type { GameState } from './game';
import { EXCITED_DURATION_MS } from './game';

type Classification = 'degenerative' | 'neutral';

interface TabState {
  url: string;
  hostname: string;
  classification: Classification;
  tabId: number;
  timestamp: number;
}

const ANIMATION_MAP: Record<Classification, string> = {
  degenerative: 'angry',
  neutral: 'idle',
};

let currentAnimation: AnimationItem | null = null;
let introTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeSessionChange: (() => void) | null = null;
let excitedResetTimer: ReturnType<typeof setTimeout> | null = null;
let lastAnimationName: string | null = null;

// ─── Animation helpers ────────────────────────────────────────────────────────

function resolveAnimationName(classification: Classification | null | undefined): string {
  if (!classification || !(classification in ANIMATION_MAP)) return 'idle';
  return ANIMATION_MAP[classification];
}

async function loadAnimation(name: string): Promise<void> {
  const container = document.getElementById('pet-container');
  if (!container) return;

  if (currentAnimation) {
    currentAnimation.destroy();
    currentAnimation = null;
  }

  const url = chrome.runtime.getURL(`dist/animations/${name}.json`);
  const response = await fetch(url);
  const animationData: unknown = await response.json();

  currentAnimation = lottie.loadAnimation({
    container,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    animationData: animationData as any,
    renderer: 'svg',
    loop: true,
    autoplay: true,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
    },
  });
}

// ─── T012: Screen router ──────────────────────────────────────────────────────

function showScreen(screen: PopupScreen): void {
  const loginOverlay = document.getElementById('screen-login')!;
  const connectionBadge = document.getElementById('connection-badge')!;
  const signoutBtn = document.getElementById('btn-signout')!;
  const statusLabel = document.getElementById('status-label')!;

  // Cancel any pending intro-to-login timer when switching screens.
  if (introTimer !== null) {
    clearTimeout(introTimer);
    introTimer = null;
  }

  loginOverlay.classList.toggle('screen-hidden', screen !== 'login');
  connectionBadge.classList.toggle('screen-hidden', screen !== 'main');
  signoutBtn.classList.toggle('screen-hidden', screen !== 'main');
  // "watching" label is only for the intro screen.
  statusLabel.classList.toggle('screen-hidden', screen !== 'intro');
}

// ─── T018: Connection badge renderer ─────────────────────────────────────────

function renderConnectionBadge(session: StoredAuthSession | null): void {
  const connected = document.querySelector<HTMLElement>('.badge-connected');
  const disconnected = document.querySelector<HTMLElement>('.badge-disconnected');
  if (!connected || !disconnected) return;

  connected.classList.toggle('screen-hidden', !session);
  disconnected.classList.toggle('screen-hidden', !!session);
}

// ─── T013 + T022: Enter intro screen ─────────────────────────────────────────

async function enterIntro(): Promise<void> {
  // Unsubscribe any previous session listener.
  if (unsubscribeSessionChange) {
    unsubscribeSessionChange();
    unsubscribeSessionChange = null;
  }

  await loadAnimation('idle');
  showScreen('intro');

  // Auto-transition to login after 3 seconds.
  introTimer = setTimeout(() => {
    introTimer = null;
    showScreen('login');
  }, 3000);
}

// ─── Game state UI update ────────────────────────────────────────────────────

function updateFromGameState(state: GameState): void {
  // Health bar.
  const healthBar = document.getElementById('health-bar');
  const healthLabel = document.getElementById('health-label');
  if (healthBar) {
    healthBar.style.width = `${state.health}%`;
    healthBar.classList.toggle('low', state.health <= 70 && state.health > 30);
    healthBar.classList.toggle('critical', state.health <= 30);
  }
  if (healthLabel) {
    healthLabel.textContent = `HP: ${Math.round(state.health)}`;
  }

  // Status indicator.
  const statusIndicator = document.getElementById('status-indicator');
  if (statusIndicator) {
    if (!state.alive) {
      statusIndicator.textContent = 'DEAD';
      statusIndicator.className = 'status-dead';
    } else if (state.debtSeconds > 0) {
      statusIndicator.textContent = 'HUNGRY';
      statusIndicator.className = 'status-hungry';
    } else {
      statusIndicator.textContent = 'SATIATED';
      statusIndicator.className = 'status-healthy';
    }
  }

  // Speech bubble.
  const speechBubble = document.getElementById('speech-bubble');
  if (speechBubble) {
    speechBubble.textContent = state.speechMessage;
  }

  // Death overlay.
  const deathOverlay = document.getElementById('death-overlay');
  if (deathOverlay) {
    deathOverlay.style.display = state.alive ? 'none' : 'flex';
  }

  // Animation — driven by game state, not tab classification.
  const animName = state.animationState === 'dead' ? 'death' : state.animationState;
  if (animName !== lastAnimationName) {
    lastAnimationName = animName;
    loadAnimation(animName);
  }

  // Excited override: auto-revert after EXCITED_DURATION_MS.
  if (state.animationState === 'excited') {
    if (excitedResetTimer) clearTimeout(excitedResetTimer);
    excitedResetTimer = setTimeout(() => {
      excitedResetTimer = null;
      // Re-read game state and update without the override.
      chrome.storage.local.get('gameState', (result) => {
        const gs = result.gameState as GameState | undefined;
        if (gs && gs.animationState !== 'excited') {
          lastAnimationName = null;
          updateFromGameState(gs);
        }
      });
    }, EXCITED_DURATION_MS);
  }

  // Tick slider sync.
  const tickSlider = document.getElementById('tick-slider') as HTMLInputElement | null;
  const tickLabel = document.getElementById('tick-label');
  if (tickSlider) {
    tickSlider.value = String(state.tickIntervalMs);
  }
  if (tickLabel) {
    tickLabel.textContent = formatTickInterval(state.tickIntervalMs);
  }
}

function formatTickInterval(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
  return `${ms}ms`;
}

// ─── T013 + T019 + T022: Enter main screen ───────────────────────────────────

async function enterMain(): Promise<void> {
  // Render connection badge with the current session.
  const session = await getValidSession();
  renderConnectionBadge(session);

  showScreen('main');

  // Show game UI elements.
  const gameStatus = document.getElementById('game-status');
  const speechBubble = document.getElementById('speech-bubble');
  const settingsBtn = document.getElementById('settings-btn');
  if (gameStatus) gameStatus.classList.remove('screen-hidden');
  if (speechBubble) speechBubble.classList.remove('screen-hidden');
  if (settingsBtn) settingsBtn.classList.remove('screen-hidden');

  // Read initial game state and render.
  const storeResult = await chrome.storage.local.get('gameState');
  const gameState = storeResult.gameState as GameState | undefined;
  if (gameState) {
    updateFromGameState(gameState);
  } else {
    // No game state yet — load tab-based animation as fallback.
    const tabResult = await chrome.storage.session.get('tabState');
    const tabState = (tabResult.tabState as TabState | null) ?? null;
    await loadAnimation(resolveAnimationName(tabState?.classification));
  }

  // T019: Subscribe to session changes for live badge updates.
  if (unsubscribeSessionChange) unsubscribeSessionChange();
  unsubscribeSessionChange = onSessionChanged((s) => renderConnectionBadge(s));

  // Subscribe to game state changes for reactive UI updates.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.gameState) {
      const newState = changes.gameState.newValue as GameState | undefined;
      if (newState) updateFromGameState(newState);
    }
    // Also keep tab-based animation fallback for when game state doesn't drive animation.
    if (areaName === 'session' && changes.tabState) {
      // Tab state changes are now handled via game tick, but keep for responsiveness.
    }
  });
}

// ─── T013 + T022: DOMContentLoaded — initial routing ─────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // T022: Check for a valid (possibly refreshed) session first.
  // If the token is near-expiry, getValidSession() will try to refresh it
  // before we decide which screen to show — preventing a flash of the intro
  // screen for returning users whose token just expired.
  const session = await getValidSession();

  if (session) {
    // T003/T022: Returning user — skip intro and login entirely.
    await enterMain();
  } else {
    // T013: No session — play intro animation, then auto-transition to login.
    await enterIntro();
  }

  // ─── T014: Sign-in button ────────────────────────────────────────────────

  document.getElementById('btn-signin')?.addEventListener('click', async () => {
    const signinBtn = document.getElementById('btn-signin') as HTMLButtonElement;
    const loginError = document.getElementById('login-error')!;

    signinBtn.disabled = true;
    loginError.classList.add('screen-hidden');

    try {
      await launchOAuthFlow();
      await enterMain();
    } catch (err) {
      // T015: Show error and retry path.
      const errorMsg = document.getElementById('error-msg')!;
      errorMsg.textContent =
        err instanceof Error ? err.message : 'Sign in failed. Please try again.';
      loginError.classList.remove('screen-hidden');
      signinBtn.disabled = false;
    }
  });

  // T015: Retry button re-triggers the sign-in flow.
  document.getElementById('btn-retry')?.addEventListener('click', () => {
    document.getElementById('btn-signin')?.click();
  });

  // T021: Sign-out button — clear session and restart intro.
  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    await signOut();
    await enterIntro();
  });

  // T020: Clicking the disconnected badge navigates to the login screen.
  document.querySelector<HTMLElement>('.badge-disconnected')?.addEventListener('click', () => {
    showScreen('login');
  });

  // Restart button — sends RESTART_GAME message to background.
  document.getElementById('restart-btn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'RESTART_GAME' });
    const deathOverlay = document.getElementById('death-overlay');
    if (deathOverlay) deathOverlay.style.display = 'none';
  });

  // Settings gear toggle.
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('settings-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  });

  // Tick speed slider.
  const tickSlider = document.getElementById('tick-slider') as HTMLInputElement | null;
  tickSlider?.addEventListener('input', () => {
    const ms = parseInt(tickSlider.value, 10);
    const tickLabel = document.getElementById('tick-label');
    if (tickLabel) tickLabel.textContent = formatTickInterval(ms);
    chrome.runtime.sendMessage({ type: 'SET_TICK_SPEED', intervalMs: ms });
  });
});
