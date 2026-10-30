/**
 * Adaptive render quality. A device that cannot hold its frame rate steps down
 * one level at a time; a device with headroom steps back up, more slowly.
 *
 *   0  full: pixel ratio up to 1.5, 1024 shadow map, full draw distance
 *   1  pixel ratio 1
 *   2  ... and a 512 shadow map
 *   3  ... and a shorter obstacle draw distance (fog hides it)
 */
export const MAX_QUALITY_LEVEL = 3;

export type QualityLevel = 0 | 1 | 2 | 3;

/** Least time between two step-downs, ms. */
export const STEP_DOWN_COOLDOWN_MS = 4000;
/** Least time between any change and a step back up, ms. */
export const STEP_UP_COOLDOWN_MS = 12000;

export interface QualityState {
  level: QualityLevel;
  /** performance.now() of the last change (or of the start). */
  changedAt: number;
}

export type QualityTrend = "decline" | "incline";

export function initialQuality(now: number): QualityState {
  return { level: 0, changedAt: now };
}

/**
 * The next state for a trend report. Returns the same object when nothing
 * should change (at a limit, or still cooling down), so callers can compare.
 */
export function stepQuality(
  state: QualityState,
  trend: QualityTrend,
  now: number
): QualityState {
  const waited = now - state.changedAt;
  if (trend === "decline") {
    if (state.level >= MAX_QUALITY_LEVEL || waited < STEP_DOWN_COOLDOWN_MS) {
      return state;
    }
    return { level: (state.level + 1) as QualityLevel, changedAt: now };
  }
  if (state.level <= 0 || waited < STEP_UP_COOLDOWN_MS) return state;
  return { level: (state.level - 1) as QualityLevel, changedAt: now };
}

export interface QualitySettings {
  /** Canvas pixel ratio range. */
  dpr: [number, number];
  shadowMapSize: number;
  /** Obstacles further than this along the course are not drawn, m. */
  obstacleDistance: number;
}

const FULL_DISTANCE = 1000;

const SETTINGS: Readonly<Record<QualityLevel, QualitySettings>> = {
  0: { dpr: [1, 1.5], shadowMapSize: 1024, obstacleDistance: FULL_DISTANCE },
  1: { dpr: [1, 1], shadowMapSize: 1024, obstacleDistance: FULL_DISTANCE },
  2: { dpr: [1, 1], shadowMapSize: 512, obstacleDistance: FULL_DISTANCE },
  3: { dpr: [1, 1], shadowMapSize: 512, obstacleDistance: 550 },
};

export function qualitySettings(level: QualityLevel): QualitySettings {
  return SETTINGS[level];
}
