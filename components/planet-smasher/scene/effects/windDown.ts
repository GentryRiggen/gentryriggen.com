/** Seconds an effect takes to leave once the ending has taken over. */
export const WIND_DOWN = 0.35;

/** True once the game has left "playing": effects go quiet and fade out. */
export function shouldWindDown(phase: string): boolean {
  return phase !== "playing";
}

/** 1 → 0 over WIND_DOWN seconds since the wind-down began (smoothstep). */
export function windDownFactor(sinceStart: number): number {
  const k = Math.min(1, Math.max(0, sinceStart / WIND_DOWN));
  return 1 - k * k * (3 - 2 * k);
}
