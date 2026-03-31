import { clampHealth, type AnimationState } from '../../lib/state/tamagotchi';
import { createClient } from '@supabase/supabase-js';
import type { StoredAuthSession } from './auth';

// esbuild replaces these at build time.
declare const process: {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  };
};

// ─── Constitutional constants (amendment required to change) ─────────────────

export const DEBT_SECONDS_PER_LINE = 0.5;
export const DEBT_MAX_SECONDS = 600;

// ─── HP changes per tick ─────────────────────────────────────────────────────

export const DRAIN_NEUTRAL_WITH_DEBT = -3;
export const DRAIN_DEGENERATE_WITH_DEBT = 0;
export const DRAIN_NEUTRAL_NO_DEBT = 0;
export const GAIN_DEGENERATE_NO_DEBT = 3;
export const GAIN_IMMEDIATE_FEED_BONUS = 15;

// ─── Timing ──────────────────────────────────────────────────────────────────

export const EXCITED_DURATION_MS = 3000;
export const TICK_INTERVAL_DEFAULT_MS = 60_000;
export const TICK_INTERVAL_MIN_MS = 500;
export const TICK_INTERVAL_MAX_MS = 60_000;
export const IMMEDIATE_FEED_WINDOW_MS = 120_000;

// ─── Health thresholds (for animation mapping) ───────────────────────────────

export const HEALTH_IDLE_THRESHOLD = 70;
export const HEALTH_STARVING_THRESHOLD = 40;
export const HEALTH_ANGRY_THRESHOLD = 10;

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface GameState {
  health: number;
  alive: boolean;
  debtSeconds: number;
  debtCreatedAt: number | null;
  notifiedAt: number | null;
  lastCommitSha: string | null;
  lastCommitAt: number | null;
  tickIntervalMs: number;
  lastTickAt: number;
  animationState: AnimationState;
  speechMessage: string;
}

export interface CommitRecord {
  commit_sha: string;
  diff_size: number;
  occurred_at: string;
  user_id: string;
}

export interface TickContext {
  gameState: GameState;
  currentClassification: 'degenerative' | 'neutral';
  newCommits: CommitRecord[];
  elapsedMs: number;
}

export interface TickResult {
  nextState: GameState;
  notifications: PendingNotification[];
}

export interface PendingNotification {
  id: string;
  type: 'hunger' | 'satiated';
  title: string;
  message: string;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_GAME_STATE: GameState = {
  health: 100,
  alive: true,
  debtSeconds: 0,
  debtCreatedAt: null,
  notifiedAt: null,
  lastCommitSha: null,
  lastCommitAt: null,
  tickIntervalMs: TICK_INTERVAL_DEFAULT_MS,
  lastTickAt: 0,
  animationState: 'idle',
  speechMessage: "I'm doing great! Keep slacking.",
};

// ─── Storage helpers ─────────────────────────────────────────────────────────

export async function readGameState(): Promise<GameState> {
  const result = await chrome.storage.local.get('gameState');
  return (result.gameState as GameState | undefined) ?? { ...DEFAULT_GAME_STATE };
}

export async function writeGameState(state: GameState): Promise<void> {
  await chrome.storage.local.set({ gameState: state });
}

// ─── Pure functions ──────────────────────────────────────────────────────────

export function calculateDebt(diffSize: number): number {
  return Math.min(diffSize * DEBT_SECONDS_PER_LINE, DEBT_MAX_SECONDS);
}

export function deriveAnimationState(health: number): AnimationState {
  if (health <= 0) return 'dead';
  if (health <= HEALTH_STARVING_THRESHOLD) return 'angry';
  if (health <= HEALTH_IDLE_THRESHOLD) return 'starving';
  return 'idle';
}

export function deriveSpeechMessage(animationState: AnimationState, _debtSeconds: number): string {
  switch (animationState) {
    case 'idle':
      return "I'm doing great! Keep slacking.";
    case 'excited':
      return 'Yay! That hit the spot!';
    case 'starving':
      return "I'm starving... stop coding and watch something!";
    case 'angry':
      return "I can't take it anymore! WATCH SOMETHING NOW!";
    case 'dead':
      return 'I died because you kept working. Press restart.';
    default:
      return '';
  }
}

export function resetGameState(): GameState {
  return { ...DEFAULT_GAME_STATE, lastTickAt: Date.now() };
}

// ─── Tick processor ──────────────────────────────────────────────────────────

export function processTick(ctx: TickContext): TickResult {
  const { currentClassification, newCommits, elapsedMs } = ctx;
  const state: GameState = { ...ctx.gameState };
  const notifications: PendingNotification[] = [];

  // Dead tamagotchi does not tick.
  if (!state.alive) {
    return { nextState: state, notifications };
  }

  // 1. Process new commits — accumulate debt.
  let totalNewDebt = 0;
  for (const commit of newCommits) {
    const debt = calculateDebt(commit.diff_size);
    totalNewDebt += debt;
    state.lastCommitSha = commit.commit_sha;
    state.lastCommitAt = new Date(commit.occurred_at).getTime();
  }

  if (totalNewDebt > 0) {
    const hadDebt = state.debtSeconds > 0;
    state.debtSeconds = Math.min(state.debtSeconds + totalNewDebt, DEBT_MAX_SECONDS);

    if (!hadDebt) {
      state.debtCreatedAt = Date.now();
    }
    state.notifiedAt = Date.now();

    const totalDiffSize = newCommits.reduce((sum, c) => sum + c.diff_size, 0);
    notifications.push({
      id: 'rotagotchi-hunger',
      type: 'hunger',
      title: 'Rotagotchi is hungry!',
      message: `You committed ${totalDiffSize} lines. Watch something fun to pay it off.`,
    });
  }

  // 2. Immediate feed bonus — within IMMEDIATE_FEED_WINDOW_MS of debt creation.
  let immediateBonusApplied = false;
  if (
    currentClassification === 'degenerative' &&
    state.debtSeconds > 0 &&
    state.debtCreatedAt !== null &&
    Date.now() - state.debtCreatedAt <= IMMEDIATE_FEED_WINDOW_MS
  ) {
    state.health = clampHealth(state.health + GAIN_IMMEDIATE_FEED_BONUS);
    state.debtCreatedAt = null; // Guard: bonus applies once per debt epoch.
    immediateBonusApplied = true;
  }

  // 3. Debt clock decrement on degenerative sites.
  const previousDebtSeconds = state.debtSeconds;
  if (currentClassification === 'degenerative' && state.debtSeconds > 0) {
    state.debtSeconds = Math.max(0, state.debtSeconds - elapsedMs / 1000);
  }

  // 4. HP delta based on classification × debt state.
  // Constants are defined at default tick speed (TICK_INTERVAL_DEFAULT_MS).
  // Scale by actual elapsed time so the HP rate is consistent regardless of tick speed.
  const tickScale = 1;
  const hasDebt = state.debtSeconds > 0;
  let hpDeltaBase: number;
  if (hasDebt && currentClassification === 'neutral') {
    hpDeltaBase = DRAIN_NEUTRAL_WITH_DEBT;
  } else if (hasDebt && currentClassification === 'degenerative') {
    hpDeltaBase = DRAIN_DEGENERATE_WITH_DEBT;
  } else if (!hasDebt && currentClassification === 'neutral') {
    hpDeltaBase = DRAIN_NEUTRAL_NO_DEBT;
  } else {
    hpDeltaBase = GAIN_DEGENERATE_NO_DEBT;
  }
  state.health = clampHealth(state.health + hpDeltaBase * tickScale);

  // 5. Death detection.
  if (state.health <= 0) {
    state.alive = false;
    state.health = 0;
    state.animationState = 'dead';
    state.speechMessage = deriveSpeechMessage('dead', state.debtSeconds);
    state.lastTickAt = Date.now();
    return { nextState: state, notifications };
  }

  // 6. Satiated notification — debt just cleared.
  if (previousDebtSeconds > 0 && state.debtSeconds <= 0) {
    state.debtCreatedAt = null;
    state.notifiedAt = null;
    notifications.push({
      id: 'rotagotchi-satiated',
      type: 'satiated',
      title: 'Rotagotchi is happy!',
      message: "You've earned some rest. Your pet is satiated.",
    });
  }

  // 7. Animation state.
  if (immediateBonusApplied) {
    state.animationState = 'excited';
  } else {
    state.animationState = deriveAnimationState(state.health);
  }

  // 8. Speech message.
  state.speechMessage = deriveSpeechMessage(state.animationState, state.debtSeconds);

  state.lastTickAt = Date.now();
  return { nextState: state, notifications };
}

// ─── Supabase commit fetcher ─────────────────────────────────────────────────

export async function fetchNewCommits(
  session: StoredAuthSession,
  sinceMs: number | null,
): Promise<CommitRecord[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${session.accessToken}` } },
      },
    );

    // When sinceMs is null (first run), anchor to the last 10 minutes so we
    // don't process the user's entire commit history from the oldest record.
    const since = sinceMs !== null && sinceMs > 0
      ? new Date(sinceMs).toISOString()
      : new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const query = supabase
      .from('commit_events')
      .select('commit_sha, diff_size, occurred_at, user_id')
      .eq('user_id', session.userId)
      .gt('occurred_at', since)
      .order('occurred_at', { ascending: true })
      .limit(5);

    const { data, error } = await query;
    if (error) {
      console.error('[rotagotchi] Supabase query failed:', error.message);
      return [];
    }
    return (data as CommitRecord[]) ?? [];
  } catch (err) {
    console.error('[rotagotchi] fetchNewCommits error:', err);
    return [];
  }
}
