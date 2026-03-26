import lottie, { AnimationItem } from 'lottie-web';

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

document.addEventListener('DOMContentLoaded', async () => {
  // Read current tab state and play the appropriate animation.
  const result = await chrome.storage.session.get('tabState');
  const tabState = (result.tabState as TabState | null) ?? null;
  await loadAnimation(resolveAnimationName(tabState?.classification));

  // Update animation reactively while the popup stays open.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'session' || !changes.tabState) return;
    const newState = changes.tabState.newValue as TabState | null;
    loadAnimation(resolveAnimationName(newState?.classification));
  });
});
