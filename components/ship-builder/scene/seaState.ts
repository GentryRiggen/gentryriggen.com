import { clamp } from "./animationMath";

export const SEA_STATES = ["calm", "choppy", "stormy"] as const;
export type SeaState = (typeof SEA_STATES)[number];

export const DEFAULT_SEA_STATE: SeaState = "calm";

export function isSeaState(value: unknown): value is SeaState {
  return SEA_STATES.includes(value as SeaState);
}

export interface SeaParams {
  /** Peak wave height in world units, away from the ship. */
  amplitude: number;
  /** Multiplier on how fast the waves travel. */
  speed: number;
  /** Multiplier on the ship's up-and-down bob. */
  bobScale: number;
  /** Multiplier on the ship's roll. */
  rollScale: number;
  /** Share of the sky the clouds cover: clear, partly cloudy, overcast. */
  cloudCover: number;
  /** How far the light and sky turn grey and dim; 0 leaves them untouched. */
  overcast: number;
}

const SEA_PARAMS: Record<SeaState, SeaParams> = {
  // Calm is the original look: a barely visible swell and the original bob.
  calm: {
    amplitude: 0.03,
    speed: 0.6,
    bobScale: 1,
    rollScale: 1,
    cloudCover: 0.2,
    overcast: 0,
  },
  choppy: {
    amplitude: 0.2,
    speed: 1,
    bobScale: 1.8,
    rollScale: 1.6,
    cloudCover: 0.55,
    overcast: 0.25,
  },
  stormy: {
    amplitude: 0.45,
    speed: 1.6,
    bobScale: 3,
    rollScale: 2.4,
    cloudCover: 1,
    overcast: 0.85,
  },
};

export function seaParams(sea: SeaState): SeaParams {
  return SEA_PARAMS[sea];
}

/** Wave amplitude is damped near the ship so the sea never pokes through. */
export const SEA_NEAR_FACTOR = 0.6;
export const SEA_NEAR_RADIUS = 4;
export const SEA_NEAR_FULL_RADIUS = 14;
/** Far water is too coarse to show waves, so they fade out. */
export const SEA_FAR_START = 45;
export const SEA_FAR_END = 80;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Share of the amplitude that applies at `distance` from the ship. */
export function seaFade(distance: number): number {
  const near =
    SEA_NEAR_FACTOR +
    (1 - SEA_NEAR_FACTOR) *
      smoothstep(SEA_NEAR_RADIUS, SEA_NEAR_FULL_RADIUS, distance);
  return near * (1 - smoothstep(SEA_FAR_START, SEA_FAR_END, distance));
}

export interface Wave {
  dirX: number;
  dirY: number;
  wavelength: number;
  /** Share of the peak height; the weights sum to 1. */
  weight: number;
  /** Radians per unit of time at speed 1. */
  omega: number;
}

export const WAVES: readonly Wave[] = [
  { dirX: 0.8, dirY: 0.6, wavelength: 9, weight: 0.5, omega: 1.1 },
  { dirX: -0.5, dirY: 0.866, wavelength: 5.5, weight: 0.3, omega: 1.5 },
  { dirX: 0.2, dirY: -0.98, wavelength: 3.2, weight: 0.2, omega: 2 },
];

/** CPU twin of the vertex shader's height, used to pin down its behaviour. */
export function seaHeight(
  x: number,
  y: number,
  time: number,
  amplitude: number
): number {
  const sum = WAVES.reduce((total, w) => {
    const k = (Math.PI * 2) / w.wavelength;
    const phase = k * (w.dirX * x + w.dirY * y) + w.omega * time;
    return total + w.weight * Math.sin(phase);
  }, 0);
  return sum * amplitude * seaFade(Math.hypot(x, y));
}
