import type { ConsumableDef, RunState } from "../../engine/types";
import { LOAD_ACTION_IDS, isLoadHere } from "./deliveries";
import { FOOTING_ACTION_IDS, isFootingOpen } from "./footing";
import {
  FORK_ACTION_IDS,
  currentFork,
  isForkChosen,
  isForkOpen,
} from "./forks";
import {
  OVERTIME_ACTION_ID,
  hasAffordableProject,
  isOvertimeOn,
  isOvertimeOpen,
  knowhowOf,
} from "./knowhow";
import {
  BANK_ACTION_ID,
  PACE_ACTION_IDS,
  PLAYROOM_CONSUMABLE,
  isPlayroomOpen,
  streakOf,
  toddlerStage,
} from "./playroom";
import { sceneInfo, sceneKey } from "./scene";
import { STEADY_ACTION_ID, SWAY_CONSUMABLE, hasSway, swayOf } from "./sway";
import { TUNING } from "./tuning";

/** The sway plate lights when the tower leans this much. */
const LEAN_PLATE = 0.45;

/** Systems asking for the player's attention: the tap, the lean and the load. */
export function higherPlates(run: RunState): string[] {
  const plates = ["tap"];
  const fork = currentFork(run);
  if (isForkOpen(run, fork.id) && !isForkChosen(run, fork.id))
    plates.push("fork");
  if (hasSway(run) && swayOf(run) >= LEAN_PLATE) plates.push("sway");
  if (isPlayroomOpen(run) && streakOf(run) >= TUNING.playroom.plateAt)
    plates.push("streak");
  if (isPlayroomOpen(run) && toddlerStage(run) !== "away")
    plates.push("toddler");
  if (isFootingOpen(run)) plates.push("footing");
  if (hasAffordableProject(run)) plates.push("project");
  if (isLoadHere(run)) plates.push("load");
  if (
    isOvertimeOpen(run) &&
    !isOvertimeOn(run) &&
    knowhowOf(run) >= TUNING.knowhow.overtimeCost
  )
    plates.push("overtime");
  return plates;
}

/** Plates that only count as spinning while the player tends them. */
export const HIGHER_PLATE_ACTIONS: Readonly<Record<string, readonly string[]>> =
  {
    sway: [STEADY_ACTION_ID],
    streak: [BANK_ACTION_ID],
    toddler: [BANK_ACTION_ID, ...PACE_ACTION_IDS],
    load: LOAD_ACTION_IDS,
    fork: FORK_ACTION_IDS,
    overtime: [OVERTIME_ACTION_ID],
  };

/**
 * Real choices, for the decision-gap metric: which side of a fork, how much to
 * keep for the footing, which load to place, when to call overtime, how fast
 * to build. Steadying the tower is a fix, and banking a streak is a claim,
 * not a choice.
 */
export const HIGHER_DECISION_ACTIONS: readonly string[] = [
  ...PACE_ACTION_IDS,
  ...FORK_ACTION_IDS,
  ...FOOTING_ACTION_IDS,
  ...LOAD_ACTION_IDS,
  OVERTIME_ACTION_ID,
];

/** The tower's steadiness is the one watched number. */
export const HIGHER_CONSUMABLES: readonly ConsumableDef[] = [
  PLAYROOM_CONSUMABLE,
  SWAY_CONSUMABLE,
];

/** Income probes need no change: loads are placed at once and never flow in. */
export const higherIncomeView = (run: RunState): RunState => run;

/** True when the picture differs between two runs. */
export const higherSceneDiff = (before: RunState, after: RunState): boolean =>
  sceneKey(sceneInfo(before)) !== sceneKey(sceneInfo(after));
