import type { RunState } from "../../engine/types";
import { helperForkMult, tapForkMult } from "./forks";
import { phaseBoost } from "./knowhow";
import { HELPER_LINES, SCALE_IDS, owned } from "./lines";
import { TUNING } from "./tuning";

/**
 * The pay formulas that do not depend on the tower's lean or the footing, so
 * the footing can weigh itself against them without a circular import.
 */

const speed = (run: RunState): number => run.mods.speed ?? 1;
const tapMult = (run: RunState): number => run.mods.tapMult ?? 1;

/**
 * What a line of helpers makes at `level`: every level multiplies the line by
 * `TUNING.stackGrowth`, so each purchase is a visible jump, not one more
 * identical helper. Level 0 is nothing.
 */
export const stacked = (level: number): number =>
  level <= 0 ? 0 : TUNING.stackGrowth ** level;

/** Scaling upgrades multiply too: each level makes taps and helpers pay more. */
export const scaleMult = (run: RunState): number =>
  (1 + TUNING.phases[run.phase].scalePer) ** owned(run, SCALE_IDS[run.phase]);

/** One-off boosts: fairy lights, the neon sign, the beacon. */
export function oneOffMult(run: RunState): number {
  const O = TUNING.oneOffs;
  if (run.phase === 0 && owned(run, "fairy-lights") > 0) return O.fairyLights;
  if (run.phase === 1 && owned(run, "neon-sign") > 0) return O.neonSign;
  if (run.phase === 2 && owned(run, "beacon") > 0) return O.beacon;
  if (run.phase === 3)
    return (
      (owned(run, "rest-bench") > 0 ? O.restBench : 1) *
      (owned(run, "window-seat") > 0 ? O.windowSeat : 1)
    );
  return 1;
}

/** The helpers' output per second at level 1 of each line, before any bonus. */
export const helpersBase = (run: RunState): number =>
  (HELPER_LINES[run.phase] ?? []).reduce(
    (sum, id) => sum + stacked(owned(run, id)) * (TUNING.rates[id] ?? 0),
    0
  );

/** The phase's main resource per second, before sway, footing and the kept share. */
export const grossIncome = (run: RunState): number =>
  helpersBase(run) *
  scaleMult(run) *
  helperForkMult(run) *
  oneOffMult(run) *
  phaseBoost(run) *
  speed(run);

/** What one tap earns, before the footing and the kept share. */
export const grossTap = (run: RunState): number =>
  TUNING.phases[run.phase].tap *
  scaleMult(run) *
  tapMult(run) *
  tapForkMult(run) *
  oneOffMult(run) *
  phaseBoost(run);

/** The site's pay, with a few taps a second, that the footing is weighed against. */
export const referenceIncome = (run: RunState): number =>
  grossIncome(run) + TUNING.footing.referenceTaps * grossTap(run);
