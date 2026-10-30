/**
 * Adaptive render quality. A device that cannot hold its frame rate steps down
 * one level at a time; a device with headroom steps back up, more slowly.
 *
 *   0  full: pixel ratio up to 1.5, 1024 shadow map, full draw distance
 *   1  pixel ratio 1
 *   2  ... and a 512 shadow map
 *   3  ... and fog pulled in, with obstacles cut off where it is opaque
 *
 * A step that would change nothing on this screen (level 1 on a 1x screen) is
 * skipped. A level that failed right after a step up is latched: the ladder
 * never climbs into it again, so a device between two levels settles instead
 * of resizing its canvas forever.
 */
export const MAX_QUALITY_LEVEL = 3;

export type QualityLevel = 0 | 1 | 2 | 3;

const LEVELS: readonly QualityLevel[] = [0, 1, 2, 3];

/** Least time between two step-downs, ms. */
export const STEP_DOWN_COOLDOWN_MS = 4000;
/** Least time between any change and a step back up, ms. */
export const STEP_UP_COOLDOWN_MS = 12000;
/** Trend reports are ignored this long after a (re)start: loads and compiles. */
export const WARMUP_MS = 6000;

export interface QualityState {
  level: QualityLevel;
  /** performance.now() of the last change (or of the start). */
  changedAt: number;
  /** Trend reports before this time are ignored. */
  warmupUntil: number;
  /** The direction of the last change. */
  lastMove: "up" | "down" | null;
  /** The ladder never climbs above this level number's worth of quality. */
  minLevel: QualityLevel;
}

export type QualityTrend = "decline" | "incline";

export function initialQuality(now: number): QualityState {
  return {
    level: 0,
    changedAt: now,
    warmupUntil: now + WARMUP_MS,
    lastMove: null,
    minLevel: 0,
  };
}

/** Ignores trend reports for a while, e.g. as a flight starts and loads. */
export function restartWarmup(state: QualityState, now: number): QualityState {
  return { ...state, warmupUntil: now + WARMUP_MS };
}

export interface QualitySettings {
  /** Canvas pixel ratio range. */
  dpr: [number, number];
  shadowMapSize: number;
  /** Obstacles further than this along the course are not drawn, m. */
  obstacleDistance: number;
  /** Where the fog is fully opaque, m. */
  fogFar: number;
}

const FULL_FOG_FAR = 900;
const FULL_DISTANCE = 1000;
/** A chunk appears where it is fully fogged: the cutoff is at the fog's end. */
const SHORT_FOG_FAR = 550;

const SETTINGS: Readonly<Record<QualityLevel, QualitySettings>> = {
  0: {
    dpr: [1, 1.5],
    shadowMapSize: 1024,
    obstacleDistance: FULL_DISTANCE,
    fogFar: FULL_FOG_FAR,
  },
  1: {
    dpr: [1, 1],
    shadowMapSize: 1024,
    obstacleDistance: FULL_DISTANCE,
    fogFar: FULL_FOG_FAR,
  },
  2: {
    dpr: [1, 1],
    shadowMapSize: 512,
    obstacleDistance: FULL_DISTANCE,
    fogFar: FULL_FOG_FAR,
  },
  3: {
    dpr: [1, 1],
    shadowMapSize: 512,
    obstacleDistance: SHORT_FOG_FAR + 10,
    fogFar: SHORT_FOG_FAR,
  },
};

export function qualitySettings(level: QualityLevel): QualitySettings {
  return SETTINGS[level];
}

/** What a level really draws on a screen with this pixel ratio. */
function look(level: QualityLevel, pixelRatio: number): string {
  const s = SETTINGS[level];
  const ratio = Math.min(Math.max(pixelRatio, s.dpr[0]), s.dpr[1]);
  return [ratio, s.shadowMapSize, s.obstacleDistance, s.fogFar].join("/");
}

/**
 * The next state for a trend report. Returns the same object when nothing
 * should change (at a limit, warming up, or cooling down).
 */
export function stepQuality(
  state: QualityState,
  trend: QualityTrend,
  now: number,
  pixelRatio = 2
): QualityState {
  if (now < state.warmupUntil) return state;
  const waited = now - state.changedAt;
  const here = look(state.level, pixelRatio);
  if (trend === "decline") {
    if (waited < STEP_DOWN_COOLDOWN_MS) return state;
    const next = LEVELS.find(
      (level) => level > state.level && look(level, pixelRatio) !== here
    );
    if (next === undefined) return state;
    // A decline right after climbing means the level we climbed into failed.
    const minLevel =
      state.lastMove === "up"
        ? (Math.max(state.minLevel, state.level + 1) as QualityLevel)
        : state.minLevel;
    return {
      ...state,
      level: next,
      changedAt: now,
      lastMove: "down",
      minLevel,
    };
  }
  if (waited < STEP_UP_COOLDOWN_MS) return state;
  const next = [...LEVELS]
    .reverse()
    .find(
      (level) =>
        level < state.level &&
        level >= state.minLevel &&
        look(level, pixelRatio) !== here
    );
  if (next === undefined) return state;
  return { ...state, level: next, changedAt: now, lastMove: "up" };
}
