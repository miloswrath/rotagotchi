import { describe, it, expect } from 'vitest';
import {
  calculateDebt,
  deriveAnimationState,
  deriveSpeechMessage,
  processTick,
  resetGameState,
  DEFAULT_GAME_STATE,
  DEBT_SECONDS_PER_LINE,
  DEBT_MAX_SECONDS,
  DRAIN_NEUTRAL_WITH_DEBT,
  DRAIN_DEGENERATE_WITH_DEBT,
  DRAIN_NEUTRAL_NO_DEBT,
  GAIN_DEGENERATE_NO_DEBT,
  GAIN_IMMEDIATE_FEED_BONUS,
  IMMEDIATE_FEED_WINDOW_MS,
  type GameState,
  type TickContext,
} from '../../extension/src/game';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...DEFAULT_GAME_STATE, lastTickAt: Date.now() - 60_000, ...overrides };
}

function makeCtx(overrides: Partial<TickContext> = {}): TickContext {
  return {
    gameState: makeState(),
    currentClassification: 'neutral',
    newCommits: [],
    elapsedMs: 60_000,
    ...overrides,
  };
}

// ─── calculateDebt ───────────────────────────────────────────────────────────

describe('calculateDebt', () => {
  it('calculates debt from diff size', () => {
    expect(calculateDebt(100)).toBe(100 * DEBT_SECONDS_PER_LINE);
  });

  it('returns 0 for 0 lines', () => {
    expect(calculateDebt(0)).toBe(0);
  });

  it('caps at DEBT_MAX_SECONDS', () => {
    expect(calculateDebt(999_999)).toBe(DEBT_MAX_SECONDS);
  });
});

// ─── deriveAnimationState ────────────────────────────────────────────────────

describe('deriveAnimationState', () => {
  it('returns idle for health > 70', () => {
    expect(deriveAnimationState(80)).toBe('idle');
  });

  it('returns starving for health 40–70', () => {
    expect(deriveAnimationState(55)).toBe('starving');
  });

  it('returns angry for health 10–40', () => {
    expect(deriveAnimationState(25)).toBe('angry');
  });

  it('returns dead for health 0', () => {
    expect(deriveAnimationState(0)).toBe('dead');
  });
});

// ─── deriveSpeechMessage ─────────────────────────────────────────────────────

describe('deriveSpeechMessage', () => {
  it('returns non-empty string for every animation state', () => {
    for (const state of ['idle', 'excited', 'starving', 'angry', 'dead'] as const) {
      expect(deriveSpeechMessage(state, 100).length).toBeGreaterThan(0);
    }
  });
});

// ─── resetGameState ──────────────────────────────────────────────────────────

describe('resetGameState', () => {
  it('returns default values with current timestamp', () => {
    const state = resetGameState();
    expect(state.health).toBe(100);
    expect(state.alive).toBe(true);
    expect(state.debtSeconds).toBe(0);
    expect(state.lastTickAt).toBeGreaterThan(0);
  });
});

// ─── processTick: drain cases ────────────────────────────────────────────────

describe('processTick — drain/gain', () => {
  it('drains health on neutral site with active debt', () => {
    const ctx = makeCtx({
      gameState: makeState({ debtSeconds: 300 }),
      currentClassification: 'neutral',
    });
    const { nextState } = processTick(ctx);
    expect(nextState.health).toBe(100 + DRAIN_NEUTRAL_WITH_DEBT);
  });

  it('drains health on degenerative site with active debt', () => {
    const ctx = makeCtx({
      gameState: makeState({ debtSeconds: 300 }),
      currentClassification: 'degenerative',
    });
    const { nextState } = processTick(ctx);
    expect(nextState.health).toBe(100 + DRAIN_DEGENERATE_WITH_DEBT);
  });

  it('drains health slowly on neutral site with no debt', () => {
    const ctx = makeCtx({
      gameState: makeState({ debtSeconds: 0 }),
      currentClassification: 'neutral',
    });
    const { nextState } = processTick(ctx);
    expect(nextState.health).toBe(100 + DRAIN_NEUTRAL_NO_DEBT);
  });

  it('recovers health on degenerative site with no debt', () => {
    const ctx = makeCtx({
      gameState: makeState({ health: 80, debtSeconds: 0 }),
      currentClassification: 'degenerative',
    });
    const { nextState } = processTick(ctx);
    expect(nextState.health).toBe(80 + GAIN_DEGENERATE_NO_DEBT);
  });

  it('clamps health at 0 (death)', () => {
    const ctx = makeCtx({
      gameState: makeState({ health: 1, debtSeconds: 300 }),
      currentClassification: 'neutral',
    });
    const { nextState } = processTick(ctx);
    expect(nextState.health).toBe(0);
    expect(nextState.alive).toBe(false);
    expect(nextState.animationState).toBe('dead');
  });

  it('clamps health at 100', () => {
    const ctx = makeCtx({
      gameState: makeState({ health: 100, debtSeconds: 0 }),
      currentClassification: 'degenerative',
    });
    const { nextState } = processTick(ctx);
    expect(nextState.health).toBe(100);
  });
});

// ─── processTick: commit processing ─────────────────────────────────────────

describe('processTick — commit processing', () => {
  it('accumulates debt from new commits', () => {
    const ctx = makeCtx({
      newCommits: [
        { commit_sha: 'abc', diff_size: 100, occurred_at: new Date().toISOString(), user_id: 'u1' },
      ],
    });
    const { nextState, notifications } = processTick(ctx);
    expect(nextState.debtSeconds).toBe(calculateDebt(100));
    expect(nextState.lastCommitSha).toBe('abc');
    expect(notifications.some(n => n.type === 'hunger')).toBe(true);
  });

  it('accumulates debt from multiple commits', () => {
    const ctx = makeCtx({
      newCommits: [
        { commit_sha: 'a', diff_size: 50, occurred_at: new Date().toISOString(), user_id: 'u1' },
        { commit_sha: 'b', diff_size: 100, occurred_at: new Date().toISOString(), user_id: 'u1' },
      ],
    });
    const { nextState } = processTick(ctx);
    expect(nextState.debtSeconds).toBe(calculateDebt(50) + calculateDebt(100));
  });

  it('caps cumulative debt at DEBT_MAX_SECONDS', () => {
    const ctx = makeCtx({
      gameState: makeState({ debtSeconds: 3000 }),
      newCommits: [
        { commit_sha: 'x', diff_size: 500, occurred_at: new Date().toISOString(), user_id: 'u1' },
      ],
    });
    const { nextState } = processTick(ctx);
    expect(nextState.debtSeconds).toBeLessThanOrEqual(DEBT_MAX_SECONDS);
  });
});

// ─── processTick: debt clock ─────────────────────────────────────────────────

describe('processTick — debt clock', () => {
  it('decrements debt on degenerative site', () => {
    const ctx = makeCtx({
      gameState: makeState({ debtSeconds: 120 }),
      currentClassification: 'degenerative',
      elapsedMs: 30_000,
    });
    const { nextState } = processTick(ctx);
    expect(nextState.debtSeconds).toBe(120 - 30);
  });

  it('does not decrement debt on neutral site', () => {
    const ctx = makeCtx({
      gameState: makeState({ debtSeconds: 120 }),
      currentClassification: 'neutral',
      elapsedMs: 30_000,
    });
    const { nextState } = processTick(ctx);
    // Debt stays the same (no decrement on neutral).
    expect(nextState.debtSeconds).toBe(120);
  });

  it('emits satiated notification when debt clears', () => {
    const ctx = makeCtx({
      gameState: makeState({ debtSeconds: 10 }),
      currentClassification: 'degenerative',
      elapsedMs: 60_000,
    });
    const { nextState, notifications } = processTick(ctx);
    expect(nextState.debtSeconds).toBe(0);
    expect(notifications.some(n => n.type === 'satiated')).toBe(true);
  });

  it('does not double-emit satiated when debt already zero', () => {
    const ctx = makeCtx({
      gameState: makeState({ debtSeconds: 0 }),
      currentClassification: 'degenerative',
    });
    const { notifications } = processTick(ctx);
    expect(notifications.some(n => n.type === 'satiated')).toBe(false);
  });
});

// ─── processTick: immediate feed bonus ───────────────────────────────────────

describe('processTick — immediate feed bonus', () => {
  it('applies bonus within window', () => {
    const ctx = makeCtx({
      gameState: makeState({
        health: 50,
        debtSeconds: 300,
        debtCreatedAt: Date.now() - 10_000, // 10s ago, within window
      }),
      currentClassification: 'degenerative',
    });
    const { nextState } = processTick(ctx);
    // HP = 50 + GAIN_IMMEDIATE_FEED_BONUS + DRAIN_DEGENERATE_WITH_DEBT (still has debt after bonus)
    expect(nextState.health).toBeGreaterThanOrEqual(50 + GAIN_IMMEDIATE_FEED_BONUS + DRAIN_DEGENERATE_WITH_DEBT);
    expect(nextState.animationState).toBe('excited');
  });

  it('does not apply bonus outside window', () => {
    const ctx = makeCtx({
      gameState: makeState({
        health: 50,
        debtSeconds: 300,
        debtCreatedAt: Date.now() - IMMEDIATE_FEED_WINDOW_MS - 10_000,
      }),
      currentClassification: 'degenerative',
    });
    const { nextState } = processTick(ctx);
    expect(nextState.animationState).not.toBe('excited');
  });

  it('clears debtCreatedAt after bonus (one-time guard)', () => {
    const ctx = makeCtx({
      gameState: makeState({
        health: 50,
        debtSeconds: 300,
        debtCreatedAt: Date.now() - 5_000,
      }),
      currentClassification: 'degenerative',
    });
    const { nextState } = processTick(ctx);
    expect(nextState.debtCreatedAt).toBeNull();
  });
});

// ─── processTick: dead state ─────────────────────────────────────────────────

describe('processTick — dead state', () => {
  it('does not tick when dead', () => {
    const ctx = makeCtx({
      gameState: makeState({ alive: false, health: 0, animationState: 'dead' }),
    });
    const { nextState } = processTick(ctx);
    expect(nextState.health).toBe(0);
    expect(nextState.alive).toBe(false);
  });
});
