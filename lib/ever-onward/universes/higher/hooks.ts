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
import {
  FOREMAN_ACTION_IDS,
  LIGHT_ACTION_IDS,
  darkness,
  isTownOpen,
} from "./town";
import {
  NC_START_ACTION_ID,
  NC_STOP_ACTION_ID,
  SKY_CONSUMABLE,
  STRAIN_ACTION_IDS,
  TIE_ACTION_ID,
  forecastOf,
  isBlowing,
  isSkyOpen,
} from "./sky";
import { SWAY_CONSUMABLE, hasSway, swayOf } from "./sway";
import { TUNING } from "./tuning";

/** The sway plate lights when the tower leans this much. */
const LEAN_PLATE = 0.45;

/** The shadow plate lights when the dark takes this much of the pay's range. */
const SHADOW_PLATE = 0.12;

/** Systems asking for the player's attention: the tap, the lean and the load. */
export function higherPlates(run: RunState): string[] {
  const plates = ["tap"];
  const fork = currentFork(run);
  if (isForkOpen(run, fork.id) && !isForkChosen(run, fork.id))
    plates.push("fork");
  if (hasSway(run) && swayOf(run) >= LEAN_PLATE) plates.push("sway");
  if (isTownOpen(run) && darkness(run) >= SHADOW_PLATE) plates.push("shadow");
  if (
    isSkyOpen(run) &&
    (forecastOf(run) >= TUNING.sky.plateAt || isBlowing(run))
  )
    plates.push("wind");
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
    sway: PACE_ACTION_IDS,
    wind: [TIE_ACTION_ID, ...STRAIN_ACTION_IDS],
    shadow: LIGHT_ACTION_IDS,
    streak: [BANK_ACTION_ID],
    toddler: [BANK_ACTION_ID, ...PACE_ACTION_IDS],
    load: LOAD_ACTION_IDS,
    fork: FORK_ACTION_IDS,
    overtime: [OVERTIME_ACTION_ID],
  };

/**
 * Real choices, for the decision-gap metric: which side of a fork, how much to
 * keep for the footing, which load to place, when to call overtime, how fast
 * to build, how tight to pull the cable, whether to tie down, and when to try
 * the no-crane climb. Banking a streak is a claim, not a choice.
 */
export const HIGHER_DECISION_ACTIONS: readonly string[] = [
  ...PACE_ACTION_IDS,
  ...STRAIN_ACTION_IDS,
  TIE_ACTION_ID,
  NC_START_ACTION_ID,
  NC_STOP_ACTION_ID,
  ...FOREMAN_ACTION_IDS,
  ...LIGHT_ACTION_IDS,
  ...FORK_ACTION_IDS,
  ...FOOTING_ACTION_IDS,
  ...LOAD_ACTION_IDS,
  OVERTIME_ACTION_ID,
];

/** The playroom's safe stacking, the town's steadiness and the sky's safe hoisting. */
export const HIGHER_CONSUMABLES: readonly ConsumableDef[] = [
  PLAYROOM_CONSUMABLE,
  SWAY_CONSUMABLE,
  SKY_CONSUMABLE,
];

/**
 * Income probes see the sky without its passing stops: a tied tower, a
 * dropped load, a snapped cable and a no-crane stretch all end soon, and
 * are not what the site pays.
 */
export const higherIncomeView = (run: RunState): RunState =>
  run.phase === 2 && isSkyOpen(run)
    ? {
        ...run,
        resources: {
          ...run.resources,
          skTie: 0,
          skStallUntil: 0,
          skRestringUntil: 0,
          skRestUntil: 0,
          skNc: 0,
        },
      }
    : run;

/** True when the picture differs between two runs. */
export const higherSceneDiff = (before: RunState, after: RunState): boolean =>
  sceneKey(sceneInfo(before)) !== sceneKey(sceneInfo(after));
