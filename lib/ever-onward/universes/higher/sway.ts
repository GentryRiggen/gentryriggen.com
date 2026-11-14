import type { ConsumableDef, RunState } from "../../engine/types";
import { gainOf as footingGain } from "./footing";
import { swayForkMult } from "./forks";
import { knowhowSwayMult } from "./knowhow";
import { BRACE_IDS, STEADY_ONEOFF_IDS, owned, res } from "./lines";
import { TUNING } from "./tuning";

/**
 * Sway: the town's lean, which slows its crew (to half at the very worst,
 * never to nothing, and nothing is ever knocked down). Its level follows the
 * build pace (town.ts). Braces, a good footing, hard hats and the fork's side
 * calm it, and the same calm (`leanCalm`) makes the sky's gusts and cables
 * less dangerous (sky.ts).
 */

const S = TUNING.sway;

/**
 * Sway belongs to the town. The playroom's lean comes from the build pace
 * (playroom.ts) and the sky has wind and cable strain instead (sky.ts).
 */
export const hasSway = (run: RunState): boolean => run.phase === 1;

/** How far the tower leans, 0 (upright) to 1. */
export const swayOf = (run: RunState): number =>
  hasSway(run) ? Math.min(1, Math.max(0, res(run, "sway"))) : 0;

/** 1 while the tower is steady; the floor when it wobbles the most. */
export function swayFactor(run: RunState): number {
  if (!hasSway(run)) return 1;
  const over = (swayOf(run) - S.from) / (1 - S.from);
  return 1 - (1 - S.floor) * Math.min(1, Math.max(0, over));
}

/** True when the crew has slowed down because the tower leans. */
export const isWobbly = (run: RunState): boolean =>
  hasSway(run) && swayOf(run) > S.from;

/**
 * How much the footing, braces, projects and forks slow the lean (1 = none).
 * The playroom uses it too, to shrink the lean its build pace brings.
 */
export function leanCalm(run: RunState): number {
  if (run.phase > 2) return 1;
  return (
    (S.brace ** owned(run, BRACE_IDS[run.phase]) *
      (owned(run, STEADY_ONEOFF_IDS[run.phase]) > 0 ? S.fortMult : 1) *
      swayForkMult(run) *
      knowhowSwayMult(run)) /
    (1 + footingGain(run) * S.footing)
  );
}

/** How much the footing, braces, projects and forks slow the sway (1 = none). */
export const swayCalm = (run: RunState): number =>
  hasSway(run) ? leanCalm(run) : 1;

/** A steadying pole from a delivery: takes some of the sway away. */
export function relieveSway(run: RunState, share: number): void {
  run.resources.sway = Math.max(0, swayOf(run) * (1 - share));
  // In the town the pole also holds the lean down for a while.
  if (run.phase === 1)
    run.resources.twPoleUntil = run.time + TUNING.town.poleSeconds;
}

/** The tower's lean is the one watched number (0 is a wobble). */
export const SWAY_CONSUMABLE: ConsumableDef = {
  id: "steadiness",
  label: "Steadiness",
  level: (run) => (hasSway(run) ? 1 - swayOf(run) : null),
  lowZone: { lo: 0.02, hi: 0.5 },
};
