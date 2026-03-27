import lottie, { AnimationItem } from 'lottie-web';
import {
  getValidSession,
  launchOAuthFlow,
  signOut,
  onSessionChanged,
  StoredAuthSession,
  PopupScreen,
} from './auth';

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

// ─── T013 + T019 + T022: Enter main screen ───────────────────────────────────

async function enterMain(): Promise<void> {
  // Load animation matching the current tab classification.
  const result = await chrome.storage.session.get('tabState');
  const tabState = (result.tabState as TabState | null) ?? null;
  await loadAnimation(resolveAnimationName(tabState?.classification));

  // Render connection badge with the current session.
  const session = await getValidSession();
  renderConnectionBadge(session);

  showScreen('main');

  // T019: Subscribe to session changes for live badge updates.
  if (unsubscribeSessionChange) unsubscribeSessionChange();
  unsubscribeSessionChange = onSessionChanged((s) => renderConnectionBadge(s));

  // Update animation reactively while the popup stays open.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'session' || !changes.tabState) return;
    const newState = changes.tabState.newValue as TabState | null;
    loadAnimation(resolveAnimationName(newState?.classification));
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
});
