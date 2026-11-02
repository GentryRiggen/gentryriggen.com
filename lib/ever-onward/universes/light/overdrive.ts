import type { RunState } from "../../engine/types";
import { PHASE_NIGHT, PHASE_SKY } from "./resources";
import { TUNING } from "./tuning";

/**
 * Overdrive: the second thing know-how buys. Projects are for good; this is
 * for a minute. Pay know-how and the night's plants (or the sky's fleet) run
 * hot: everything pays double, but the grid (or the fleet's heading) slips
 * three times as fast. Keep it steady the whole minute and half the
 * know-how comes back. So a player chooses between an idea that helps the
 * rest of the game and a minute that helps now, and skill (tending the
 * grid, correcting the course) decides what the minute is worth.
 *
 * Nothing here is chance. State is a few hidden numbers, so a save without
 * them reads as "never run".
 */

const O = TUNING.overdrive;

export const OVERDRIVE_ACTION = "overdrive";

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** Offered in the night once the steam plants are going, and in the sky once a probe flies. */
export function isOverdriveOpen(run: RunState): boolean {
  if (run.phase === 1) return owned(run, "gen2") >= O.nightAtSteamPlants;
  if (run.phase === 2) return owned(run, "probe") > 0;
  return false;
}

export const overdriveCost = (run: RunState): number =>
  run.phase === 2 ? O.skyCost : O.nightCost;

export const isOverdriveOn = (run: RunState): boolean =>
  (run.phase === 1 || run.phase === 2) && res(run, "odLeft") > 0;

export const overdriveSecondsLeft = (run: RunState): number =>
  isOverdriveOn(run) ? res(run, "odLeft") : 0;

/** What everything pays while it runs (1 otherwise). */
export const overdriveBoost = (run: RunState): number =>
  isOverdriveOn(run) ? O.boost : 1;

/** How much faster the grid (or the heading) slips while it runs. */
export const overdriveStrain = (run: RunState): number =>
  isOverdriveOn(run) ? O.strain : 1;

/** True while the run has stayed steady so far. */
export const isOverdriveSteady = (run: RunState): boolean =>
  res(run, "odClean") > 0;

/** The last run's result: 0 none yet, 1 held steady, 2 slipped. */
export const lastOverdrive = (run: RunState): 0 | 1 | 2 => {
  const kind = Math.round(res(run, "odKind"));
  return kind === 1 || kind === 2 ? kind : 0;
};

export function startOverdrive(run: RunState): void {
  run.resources.odLeft = O.seconds;
  run.resources.odClean = 1;
}

/**
 * Runs the clock. `steadiness` is the grid's (night) or the fleet's (sky)
 * 0..100, read lazily. When the minute is up, a steady run hands back part
 * of its know-how.
 */
export function tickOverdrive(
  run: RunState,
  dt: number,
  steadiness: () => number
): void {
  if (res(run, "odLeft") <= 0) return;
  const r = run.resources;
  // The part of the story ended mid-run: it finishes as it stands.
  const isHere = run.phase === 1 || run.phase === 2;
  if (isHere && steadiness() < O.cleanAbove) r.odClean = 0;
  r.odLeft = isHere ? Math.max(0, res(run, "odLeft") - dt) : 0;
  if (r.odLeft > 0) return;
  r.odRuns = res(run, "odRuns") + 1;
  if (isOverdriveSteady(run)) {
    const cost = run.phase === 2 ? O.skyCost : O.nightCost;
    r.knowhow = res(run, "knowhow") + cost * O.refund;
    r.odCleanRuns = res(run, "odCleanRuns") + 1;
    r.odKind = 1;
  } else {
    r.odKind = 2;
  }
  r.odClean = 0;
}

export const OVERDRIVE_PHASES: readonly string[] = [PHASE_NIGHT, PHASE_SKY];
