import { projectDoneFlag, projectSeenFlag } from "../../engine/engine";
import type { ConsumableDef, RunState } from "../../engine/types";
import {
  FORK_ACTION_IDS,
  currentFork,
  isForkChosen,
  isForkOpen,
} from "./forks";
import {
  PARADE_ACTION_ID,
  SMILE_PROJECTS,
  isParadeOpen,
  paradeLeft,
  knowhowOf,
  paradeCost,
} from "./knowhow";
import {
  QUIET_ACTION_IDS,
  canScootBack,
  canScootCloser,
  isQuietOpen,
  tellOf,
} from "./quiet";
import { PHASE_IDS } from "./resources";
import { isSameSceneInfo, sceneInfo } from "./scene";
import {
  TOGETHER_ACTION_IDS,
  activityOf,
  hintOf,
  hintStage,
  isSwitching,
  isTogetherOpen,
  wearOf,
  withoutTogether,
} from "./together";
import {
  DAY_HOT,
  DAY_NONE,
  DAY_RAIN,
  PRICE_ACTION_IDS,
  ROUTE_ACTION_IDS,
  TOWN_ACTION_IDS,
  canBuyFloat,
  coinsOf,
  crowdOf,
  dayKind,
  floatCost,
  grumpyCount,
  isTownOpen,
  lowestMood,
  priceOf,
  townMood,
} from "./town";
import { TUNING } from "./tuning";
import {
  DAY_NONE as WORLD_DAY_NONE,
  LEVEL_ACTION_IDS,
  dayKind as worldDayKind,
  isWorldOpen,
  realOf,
  withoutWorldDay,
} from "./world";

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

/**
 * True when the face has firmed up on something other than what you are
 * doing, or what you are doing has worn thin: a moment to choose again.
 */
function needsALook(run: RunState): boolean {
  if (!isTogetherOpen(run) || isSwitching(run)) return false;
  const act = activityOf(run);
  return (
    (hintStage(run) >= 1 && hintOf(run) !== act) ||
    wearOf(run, act) >= TUNING.together.thinAt
  );
}

/**
 * True when the friend's body says it is a moment to move: ready for a seat
 * closer, or uneasy where you sit.
 */
function needsABenchLook(run: RunState): boolean {
  const tell = tellOf(run);
  return (
    (tell === 3 && canScootCloser(run)) || (tell === 0 && canScootBack(run))
  );
}

/** Systems asking for the player's attention: the tap, the choice, the crowd. */
export function smilePlates(run: RunState): string[] {
  const plates = ["tap"];
  const fork = currentFork(run);
  if (isForkOpen(run, fork.id) && !isForkChosen(run, fork.id))
    plates.push("fork");
  if (isTogetherOpen(run)) plates.push("together");
  if (needsALook(run)) plates.push("face");
  if (
    isWorldOpen(run) &&
    (worldDayKind(run) !== WORLD_DAY_NONE || realOf(run) < 0.6)
  )
    plates.push("dial");
  if (isTownOpen(run)) {
    const day = dayKind(run);
    // Coins with nothing left to buy are a reason to look at the sign again.
    const coinsIdle = !canBuyFloat(run) && !hasOpenProject(run);
    if (
      day === DAY_HOT ||
      day === DAY_RAIN ||
      crowdOf(run) < 0.3 ||
      (coinsIdle && priceOf(run) > 0)
    )
      plates.push("stand");
    if (
      grumpyCount(run) > 0 ||
      lowestMood(run) < 0.5 ||
      (day !== DAY_NONE && day !== DAY_HOT) ||
      (canBuyFloat(run) && coinsOf(run) >= floatCost(run))
    )
      plates.push("route");
  }
  if (
    isParadeOpen(run) &&
    paradeLeft(run) <= 0 &&
    knowhowOf(run) >= paradeCost()
  )
    plates.push("parade");
  if (hasOpenProject(run)) plates.push("project");
  if (isQuietOpen(run) && needsABenchLook(run)) plates.push("friend");
  return plates;
}

/** The plates that count as tended while the player acts on them. */
export const SMILE_PLATE_ACTIONS: Readonly<Record<string, readonly string[]>> =
  {
    face: TOGETHER_ACTION_IDS,
    stand: PRICE_ACTION_IDS,
    route: ROUTE_ACTION_IDS,
    dial: LEVEL_ACTION_IDS,
    friend: QUIET_ACTION_IDS,
    fork: FORK_ACTION_IDS,
    parade: [PARADE_ACTION_ID],
  };

/**
 * Real choices, for the decision-gap metric: which fork, what to do
 * together, when to hold a parade, how to answer a friend. Tapping is not.
 */
export const SMILE_DECISION_ACTIONS: readonly string[] = [
  ...FORK_ACTION_IDS,
  ...TOGETHER_ACTION_IDS,
  ...TOWN_ACTION_IDS,
  ...LEVEL_ACTION_IDS,
  PARADE_ACTION_ID,
  ...QUIET_ACTION_IDS,
];

/**
 * The world's one watched number is the share of smiles that are real; the
 * town's is its mood (how happy its streets are).
 */
export const SMILE_CONSUMABLES: readonly ConsumableDef[] = [
  {
    id: "real",
    label: "Real smiles",
    // Read from the floor up: 0 is the least the world can keep, 1 is all real.
    level: (run) =>
      isWorldOpen(run)
        ? (realOf(run) - TUNING.world.floor) / (1 - TUNING.world.floor)
        : null,
    lowZone: { lo: 0.02, hi: 0.35 },
  },
  {
    id: "mood",
    label: "Mood",
    level: (run) => (isTownOpen(run) ? townMood(run) : null),
    lowZone: { lo: 0.02, hi: 0.4 },
  },
];

/**
 * Income probes read the friend at plain pay and the world on a plain day:
 * today's weather is not a bigger or a smaller town.
 */
export function smileIncomeView(run: RunState): RunState {
  if (run.phase === 0) return withoutTogether(run);
  return isWorldOpen(run) ? withoutWorldDay(run) : run;
}

/** True when the picture differs between two runs. */
export const smileSceneDiff = (before: RunState, after: RunState): boolean =>
  !isSameSceneInfo(sceneInfo(before), sceneInfo(after));
