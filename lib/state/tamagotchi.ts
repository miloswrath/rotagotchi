export const HEALTH_MIN = 0;
export const HEALTH_MAX = 100;
export const HEALTH_DEFAULT = 100;

export type AnimationState = 'idle' | 'starving' | 'angry' | 'excited' | 'dead';

export interface TamagotchiState {
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

export const initialTamagotchiState: TamagotchiState = {
  health: HEALTH_DEFAULT,
  alive: true,
  debtSeconds: 0,
  debtCreatedAt: null,
  notifiedAt: null,
  lastCommitSha: null,
  lastCommitAt: null,
  tickIntervalMs: 60_000,
  lastTickAt: 0,
  animationState: 'idle',
  speechMessage: "I'm doing great! Keep slacking.",
};

export function clampHealth(value: number): number {
  return Math.min(HEALTH_MAX, Math.max(HEALTH_MIN, value));
}
