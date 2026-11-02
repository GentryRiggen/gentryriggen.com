import { projectDoneFlag, projectSeenFlag } from "../../engine/engine";
import type { ConsumableDef, RunState } from "../../engine/types";
import { BOND_ACTION_IDS, isBondOpen } from "./bond";
import { FETCH_ACTION_ID, isBallReady } from "./fetch";
import {
  FORK_ACTION_IDS,
  currentFork,
  isForkChosen,
  isForkOpen,
} from "./forks";
import {
  PARADE_ACTION_ID,
  SMILE_PROJECTS,
  canParade,
  isParadeOpen,
  paradeLeft,
  knowhowOf,
  paradeCost,
} from "./knowhow";
import { hasMeter, heatOf, withoutHeat } from "./meter";
import { QUIET_ACTION_IDS, isWanting } from "./quiet";
import { PHASE_IDS } from "./resources";
import { isSameSceneInfo, sceneInfo } from "./scene";

/** A project is on offer and not yet done. */
function hasOpenProject(run: RunState): boolean {
  const phaseId = PHASE_IDS[run.phase];
  return SMILE_PROJECTS.some(
    (p) =>
      p.phase === phaseId &&
      run.flags[projectSeenFlag(p.id)] === true &&
      run.flags[projectDoneFlag(p.id)] !== true
  );
}

/** Systems asking for the player's attention: the tap, the choice, the crowd. */
export function smilePlates(run: RunState): string[] {
  const plates = ["tap"];
  const fork = currentFork(run);
  if (isForkOpen(run, fork.id) && !isForkChosen(run, fork.id))
    plates.push("fork");
  if (isBondOpen(run)) plates.push("bond");
  if (isBallReady(run)) plates.push("fetch");
  if (hasMeter(run) && heatOf(run) >= 0.6) plates.push("meter");
  if (
    isParadeOpen(run) &&
    paradeLeft(run) <= 0 &&
    knowhowOf(run) >= paradeCost() &&
    canParade(run)
  )
    plates.push("parade");
  if (hasOpenProject(run)) plates.push("project");
  if (run.phase === 3 && isWanting(run)) plates.push("friend");
  return plates;
}

/** The plates that count as tended while the player acts on them. */
export const SMILE_PLATE_ACTIONS: Readonly<Record<string, readonly string[]>> =
  {
    fetch: [FETCH_ACTION_ID],
    friend: QUIET_ACTION_IDS,
    fork: FORK_ACTION_IDS,
    parade: [PARADE_ACTION_ID],
  };

/**
 * Real choices, for the decision-gap metric: which fork, how much to set
 * aside, when to hold a parade, how to answer a friend. Tapping is not.
 */
export const SMILE_DECISION_ACTIONS: readonly string[] = [
  ...FORK_ACTION_IDS,
  ...BOND_ACTION_IDS,
  PARADE_ACTION_ID,
  ...QUIET_ACTION_IDS,
];

/** The cheer meter is the town's and the world's one watched number. */
export const SMILE_CONSUMABLES: readonly ConsumableDef[] = [
  {
    id: "cool",
    label: "Cool",
    level: (run) => (hasMeter(run) ? 1 - heatOf(run) : null),
    lowZone: { lo: 0.02, hi: 0.35 },
  },
];

/** Income probes read the crowd rested: being worn out is not a smaller town. */
export function smileIncomeView(run: RunState): RunState {
  return hasMeter(run) ? withoutHeat(run) : run;
}

/** True when the picture differs between two runs. */
export const smileSceneDiff = (before: RunState, after: RunState): boolean =>
  !isSameSceneInfo(sceneInfo(before), sceneInfo(after));
