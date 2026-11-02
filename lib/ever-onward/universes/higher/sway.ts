import type { ActionDef, ConsumableDef, RunState } from "../../engine/types";
import { gainOf as footingGain } from "./footing";
import { swayForkMult } from "./forks";
import { knowhowSwayMult } from "./knowhow";
import {
  BRACE_IDS,
  STEADY_ONEOFF_IDS,
  helperLevels,
  owned,
  res,
} from "./lines";
import { PHASE_PLAYROOM, PHASE_SKY, PHASE_TOWN } from "./resources";
import { TUNING } from "./tuning";

/**
 * Sway: the managed risk. A taller tower leans a little more every second,
 * and a leaning tower slows its crew down (to half at the very worst, never
 * to nothing, and nothing is ever knocked down). One press of Steady puts it
 * right. Braces, a good footing, hard hats and the fork's side all slow the
 * lean, so a well-built tower hardly needs the button.
 */

const S = TUNING.sway;

export const STEADY_ACTION_ID = "steady";

/** Sway belongs to the first three parts. */
export const hasSway = (run: RunState): boolean => run.phase <= 2;

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

/** How much the footing, braces, projects and forks slow the sway (1 = none). */
export function swayCalm(run: RunState): number {
  if (!hasSway(run)) return 1;
  return (
    (S.brace ** owned(run, BRACE_IDS[run.phase]) *
      (owned(run, STEADY_ONEOFF_IDS[run.phase]) > 0 ? S.fortMult : 1) *
      swayForkMult(run) *
      knowhowSwayMult(run)) /
    (1 + footingGain(run) * S.footing)
  );
}

/** Share of the whole scale the tower sways per second. */
export function swayPerSecond(run: RunState): number {
  if (!hasSway(run)) return 0;
  return (
    S.rise[run.phase] * (1 + S.perLevel * helperLevels(run)) * swayCalm(run)
  );
}

/** How strongly the tower rights itself: braces and a fort pull it upright. */
export function swayRelax(run: RunState): number {
  if (!hasSway(run)) return 0;
  return (
    S.relax *
    (owned(run, BRACE_IDS[run.phase]) +
      (owned(run, STEADY_ONEOFF_IDS[run.phase]) > 0 ? 2 : 0))
  );
}

export function tickSway(run: RunState, dt: number): void {
  if (!hasSway(run)) return;
  const sway = swayOf(run);
  run.resources.sway = Math.min(
    1,
    Math.max(0, sway + (swayPerSecond(run) - swayRelax(run) * sway) * dt)
  );
}

/** A steadying pole from a delivery: takes some of the sway away. */
export function relieveSway(run: RunState, share: number): void {
  run.resources.sway = Math.max(0, swayOf(run) * (1 - share));
}

const WORDS = ["blocks", "bricks", "beams"] as const;
const TOWERS = ["block tower", "tower", "tower"] as const;

/** Press to set the tower right. Free, and never a loss. */
export const STEADY_ACTION: ActionDef = {
  id: STEADY_ACTION_ID,
  phases: [PHASE_PLAYROOM, PHASE_TOWN, PHASE_SKY],
  isInline: true,
  visibleWhen: (run) => hasSway(run) && helperLevels(run) >= 2,
  describe: (run) => {
    const sway = swayOf(run);
    return {
      label: sway < S.steadyAt ? "Standing straight" : "Steady the tower",
      detail:
        sway < S.steadyAt
          ? `The ${TOWERS[run.phase]} is upright, and the ${WORDS[run.phase]} flow.`
          : `The ${TOWERS[run.phase]} is leaning. Steady it and the crew works at full speed.`,
      isBlocked: sway < S.steadyAt,
      hint:
        sway >= 0.7
          ? { text: "wobbling!", tone: "bad" }
          : sway >= S.from
            ? { text: "leaning", tone: "neutral" }
            : undefined,
    };
  },
  perform: (run) => {
    run.resources.sway = 0;
  },
};

/** The tower's lean is the one watched number (0 is a wobble). */
export const SWAY_CONSUMABLE: ConsumableDef = {
  id: "steadiness",
  label: "Steadiness",
  level: (run) => (hasSway(run) ? 1 - swayOf(run) : null),
  lowZone: { lo: 0.02, hi: 0.5 },
};
