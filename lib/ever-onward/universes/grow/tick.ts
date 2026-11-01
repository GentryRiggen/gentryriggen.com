import type { RunState } from "../../engine/types";
import { visitorHereFlag } from "../../engine/engine";
import {
  FULL_GROWTH,
  MANUAL_RESOURCES,
  PHASE_SEED,
  PHASE_IDS,
} from "./resources";
import { TUNING } from "./tuning";
import { RETURN_VISITOR_ID } from "./visitors";

/** The helper and the scaling upgrade of each phase, by phase index. */
export const HELPER_IDS = ["sprinkler", "scarecrow", "windbreak", "trellis"];
export const SCALE_IDS = ["mulch", "compost", "rain-makers", "sunny-sill"];

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const speed = (run: RunState): number => run.mods.speed ?? 1;
const tapMult = (run: RunState): number => run.mods.tapMult ?? 1;

const scaleMult = (run: RunState): number =>
  1 + TUNING.phases[run.phase].scalePer * owned(run, SCALE_IDS[run.phase]);

/** What one tap earns right now. */
export function manualPerTap(run: RunState): number {
  return TUNING.phases[run.phase].tap * scaleMult(run) * tapMult(run);
}

/** The phase's manual resource per second from helpers alone. */
export function incomePerSecond(run: RunState): number {
  return (
    owned(run, HELPER_IDS[run.phase]) *
    TUNING.phases[run.phase].helper *
    scaleMult(run) *
    speed(run)
  );
}

/** Earned care also grows the one pot, which is all the seed phase asks for. */
function earn(run: RunState, amount: number): void {
  const id = MANUAL_RESOURCES[run.phase];
  run.resources[id] += amount;
  if (PHASE_IDS[run.phase] === PHASE_SEED)
    run.resources.growth = Math.min(
      FULL_GROWTH,
      run.resources.growth + amount * TUNING.seed.growthPerCare
    );
}

export function tickGrow(run: RunState, dt: number): void {
  earn(run, incomePerSecond(run) * dt);
}

export function manualGrow(run: RunState): void {
  earn(run, manualPerTap(run));
}

export const isGrowComplete = (run: RunState): boolean =>
  run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true;
