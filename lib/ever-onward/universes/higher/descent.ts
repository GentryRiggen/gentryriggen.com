import type { RunState } from "../../engine/types";
import { owned, res } from "./lines";
import { FULL_DESCENT } from "./resources";
import { TUNING } from "./tuning";

/** The robot's way down: quiet is spent on steps, and steps bring the ground closer. */
export function stepDown(run: RunState, amount: number): void {
  run.resources.quiet = res(run, "quiet") + amount;
  run.resources.descent = Math.min(
    FULL_DESCENT,
    res(run, "descent") +
      amount *
        TUNING.top.descentPerQuiet *
        (1 + TUNING.top.lanternBoost * owned(run, "block-lantern"))
  );
}

/** How far down the robot is, 0 (at the top) to 1 (on the grass). */
export const descentShare = (run: RunState): number =>
  Math.min(1, Math.max(0, res(run, "descent") / FULL_DESCENT));

/** True once the robot has reached the ground: the milestone that brings a visitor. */
export const isDownOnTheGrass = (run: RunState): boolean =>
  descentShare(run) >= 1;
