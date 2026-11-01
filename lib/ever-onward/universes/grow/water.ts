import { nextRandom } from "../../engine/rng";
import type { RunState } from "../../engine/types";
import { TUNING } from "./tuning";

const W = TUNING.water;

/** A thirsty garden still earns this share of its helpers' income. */
export const DRY_FLOOR = 0.5;

/** Mixed into the run's seed so the rain has a stream of its own. */
const SEED_MIX = 0x57a7e5;

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** Water storage upgrades; later parts add wells, irrigation and more. */
export const STORAGE_IDS: readonly string[] = ["rain-barrel", "garden-hose"];

/** Units the tank holds right now. */
export function waterCapacity(run: RunState): number {
  return (
    W.baseCapacity +
    W.barrelCapacity * owned(run, "rain-barrel") +
    W.hoseCapacity * owned(run, "garden-hose")
  );
}

/** How full the tank is, 0 to 1. */
export function waterLevel(run: RunState): number {
  return Math.min(
    1,
    Math.max(0, (run.resources.tank ?? 0) / waterCapacity(run))
  );
}

/** 0 is a dry spell, 1 is rainy. Drifts like the oil price. */
export const rainOutlook = (run: RunState): number =>
  run.resources.rainOutlook ?? W.outlookStart;

/** True when the tank has run out. */
export const isDry = (run: RunState): boolean => (run.resources.tank ?? 0) <= 0;

/** 1 while there is water, the floor when the tank is empty. */
export const waterFactor = (run: RunState): number =>
  isDry(run) ? DRY_FLOOR : 1;

/** Gives the rain its own stream (call when the yard begins). */
export function seedWater(run: RunState): void {
  run.resources.wtRng = (run.rng ^ SEED_MIX) | 0;
}

/**
 * Rain drifts toward its mean on a stream of its own (`run.rng` is never
 * touched), fills the tank, and the garden drinks from it.
 */
export function tickWater(run: RunState, dt: number): void {
  const stream = { rng: run.resources.wtRng | 0 };
  const before = rainOutlook(run);
  const wobble = (nextRandom(stream) - 0.5) * W.outlookWobble * Math.sqrt(dt);
  const pull = (W.outlookMean - before) * W.outlookPull * dt;
  const outlook = Math.min(1, Math.max(0, before + pull + wobble));
  run.resources.wtRng = stream.rng;
  run.resources.rainOutlook = outlook;
  const net = W.rainMax * outlook - W.thirst;
  run.resources.tank = Math.min(
    waterCapacity(run),
    Math.max(0, (run.resources.tank ?? 0) + net * dt)
  );
}
