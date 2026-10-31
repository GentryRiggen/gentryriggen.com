import { WAVES, WILD_WAVES } from "@/lib/ship-builder/sim/seaWaves";
import { clamp } from "./animationMath";

/** The main screen's seas, the ones the sea chips offer. */
export const SEA_STATES = ["calm", "choppy", "stormy"] as const;
export type SeaState = (typeof SEA_STATES)[number];

/**
 * Any sea the scene can show: the main screen's three plus the storm trial's
 * own wild sea, which the chips never offer.
 */
export type SceneSea = SeaState | "wild";

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
  /** Each of `SEA_WAVES`' share of the peak height; they sum to 1. */
  weights: readonly number[];
}

/** The sim's three waves, then its six wild ones, as the scene draws them. */
export interface Wave {
  dirX: number;
  dirY: number;
  wavelength: number;
  /** Radians per unit of time at speed 1. */
  omega: number;
  /** Starting phase, radians. */
  phase: number;
}

/**
 * Every wave the sea can sum, with the sim's directions, wavelengths and
 * frequencies (built from `lib/ship-builder/sim/seaWaves.ts`, so they stay in
 * step). The three main waves start at phase 0, as the scene always drew
 * them; the wild ones keep the sim's phases. Each sea weighs them by its own
 * `weights`: the main seas give the wild ones 0 and the wild sea the main
 * ones 0, so one shader draws every sea and eases between them.
 */
export const SEA_WAVES: readonly Wave[] = [
  ...WAVES.map(({ dirX, dirY, wavelength, omega }) => ({
    dirX,
    dirY,
    wavelength,
    omega,
    phase: 0,
  })),
  ...WILD_WAVES.map(({ dirX, dirY, wavelength, omega, phase }) => ({
    dirX,
    dirY,
    wavelength,
    omega,
    phase,
  })),
];

const MAIN_WEIGHTS: readonly number[] = [
  ...WAVES.map((w) => w.weight),
  ...WILD_WAVES.map(() => 0),
];
const WILD_WEIGHTS: readonly number[] = [
  ...WAVES.map(() => 0),
  ...WILD_WAVES.map((w) => w.weight),
];

const SEA_PARAMS: Record<SceneSea, SeaParams> = {
  // Calm is the original look: a barely visible swell and the original bob.
  calm: {
    amplitude: 0.03,
    speed: 0.6,
    bobScale: 1,
    rollScale: 1,
    cloudCover: 0.2,
    overcast: 0,
    weights: MAIN_WEIGHTS,
  },
  choppy: {
    amplitude: 0.2,
    speed: 1,
    bobScale: 1.8,
    rollScale: 1.6,
    cloudCover: 0.55,
    overcast: 0.25,
    weights: MAIN_WEIGHTS,
  },
  stormy: {
    amplitude: 0.45,
    speed: 1.6,
    bobScale: 3,
    rollScale: 2.4,
    cloudCover: 1,
    overcast: 0.85,
    weights: MAIN_WEIGHTS,
  },
  // The storm trial's wild sea: a steep cross sea, as fast as the sim's
  // (WILD_SPEED 2), under a dark, closed-in sky.
  wild: {
    amplitude: 0.65,
    speed: 2,
    bobScale: 3.6,
    rollScale: 3,
    cloudCover: 1,
    overcast: 1,
    weights: WILD_WEIGHTS,
  },
};

export function seaParams(sea: SceneSea): SeaParams {
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

/**
 * CPU twin of the vertex shader's height, used to pin down its behaviour.
 * `weights` defaults to the main seas' (calm, choppy and stormy share them).
 */
export function seaHeight(
  x: number,
  y: number,
  time: number,
  amplitude: number,
  weights: readonly number[] = MAIN_WEIGHTS
): number {
  const sum = SEA_WAVES.reduce((total, w, i) => {
    const weight = weights[i] ?? 0;
    if (weight === 0) return total;
    const k = (Math.PI * 2) / w.wavelength;
    const phase = k * (w.dirX * x + w.dirY * y) + w.omega * time + w.phase;
    return total + weight * Math.sin(phase);
  }, 0);
  return sum * amplitude * seaFade(Math.hypot(x, y));
}
