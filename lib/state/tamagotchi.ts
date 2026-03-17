export const HEALTH_MIN = 0;
export const HEALTH_MAX = 100;
export const HEALTH_DEFAULT = 100;

export interface TamagotchiState {
  health: number;
  hunger?: number;
  websiteDebt?: number;
}

export const initialTamagotchiState: TamagotchiState = {
  health: HEALTH_DEFAULT,
};

export function clampHealth(value: number): number {
  return Math.min(HEALTH_MAX, Math.max(HEALTH_MIN, value));
}
