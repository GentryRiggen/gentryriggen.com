export const SMOKE_LIFE = 3;
export const SMOKE_PUFFS_SMALL = 5;
export const SMOKE_PUFFS_LARGE = 8;
export const SMOKE_MAX_PUFFS = 300;
/** How much bigger and further-reaching a large funnel's puffs are. */
export const SMOKE_LARGE_FACTOR = 1.5;

const RISE = 3;
const DRIFT = 1.4;
const START_SCALE = 0.3;
const END_SCALE = 1.1;
const PEAK_ALPHA = 0.4;
const FADE_IN = 0.1;

export interface PuffState {
  /** Height gained above the funnel top, world units. */
  rise: number;
  /** Distance travelled aft (world -X). */
  drift: number;
  scale: number;
  alpha: number;
}

export function createPuffState(): PuffState {
  return { rise: 0, drift: 0, scale: 0, alpha: 0 };
}

/**
 * A puff at `age` (0 to 1 of its life): rises, drifts aft, grows, fades in
 * quickly and out slowly so it never pops into or out of view. Writes into
 * `out` so the render loop allocates nothing.
 */
export function puffState(
  age: number,
  factor: number,
  out: PuffState
): PuffState {
  const fadeIn = Math.min(1, age / FADE_IN);
  const remaining = 1 - age;
  out.rise = RISE * age * factor;
  out.drift = DRIFT * age * factor;
  out.scale = (START_SCALE + (END_SCALE - START_SCALE) * age) * factor;
  out.alpha = PEAK_ALPHA * fadeIn * remaining * remaining;
  return out;
}

/** Total live puffs wanted for these funnels, capped. */
export function smokeCapacity(
  smallFunnels: number,
  largeFunnels: number
): number {
  return Math.min(
    SMOKE_MAX_PUFFS,
    smallFunnels * SMOKE_PUFFS_SMALL + largeFunnels * SMOKE_PUFFS_LARGE
  );
}
