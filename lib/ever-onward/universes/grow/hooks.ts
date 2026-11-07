import { upgradeCost } from "../../engine/engine";
import type { ConsumableDef, RunState } from "../../engine/types";
import { YARD_HARVEST, ripeProduce } from "./actions";
import { BEE_ACTION_IDS, needsBees, isBeesOpen, withoutBees } from "./bees";
import {
  PUMPKIN_ACTION_IDS,
  PUMPKIN_HAND_ID,
  isDayFree,
  isPumpkinOpen,
  withoutPumpkin,
} from "./pumpkin";
import { SPREAD_ACTION_IDS, biomeGap } from "./biomes";
import {
  MIGRATION_ACTION_IDS,
  isFlockReady,
  isMigrationOpen,
  withoutMigration,
} from "./migration";
import {
  MARKET_AGENT_ID,
  PLANT_ACTION_IDS,
  isFieldPlanted,
  withoutMarketDay,
} from "./market";
import { PHASE_IDS } from "./resources";
import {
  FESTIVAL_ACTION_ID,
  festivalCost,
  isFestivalOn,
  isFestivalOpen,
  knowhowOf,
} from "./knowhow";
import {
  FORK_ACTION_IDS,
  currentFork,
  isForkChosen,
  isForkOpen,
} from "./forks";
import { sceneInfo } from "./scene";
import { pickPerSecond } from "./tick";
import { TUNING } from "./tuning";
import { UPGRADES } from "./upgrades";
import { STORAGE_IDS, waterLevel } from "./water";
import {
  WINDOWBOX_ACTION_IDS,
  isWanting,
  potStage,
  withoutWindowBox,
} from "./windowbox";

/** The water plate lights when the tank is under this share. */
const WATER_LOW = 0.35;

/** True when a storage upgrade is on offer and the money is in hand. */
function canBuildStorage(run: RunState): boolean {
  const phase = PHASE_IDS[run.phase];
  return UPGRADES.some((u) => {
    if (!STORAGE_IDS.includes(u.id)) return false;
    if (!u.phases?.includes(phase)) return false;
    if ((run.owned[u.id] ?? 0) >= (u.maxLevel ?? 1)) return false;
    if (!run.revealed.includes(u.id)) return false;
    return (run.resources[u.currency] ?? 0) >= upgradeCost(run, u);
  });
}

/** Systems asking for the player's attention: the tap, water and the harvest. */
export function growPlates(run: RunState): string[] {
  const plates = ["tap"];
  const fork = currentFork(run);
  if (isForkOpen(run, fork.id) && !isForkChosen(run, fork.id))
    plates.push("fork");
  if (run.phase === 0) {
    if (waterLevel(run) < WATER_LOW || canBuildStorage(run))
      plates.push("water");
    if (ripeProduce(run) >= TUNING.yard.ripeFor) plates.push("harvest");
    if (needsBees(run)) plates.push("bees");
  }
  if (
    isFestivalOpen(run) &&
    !isFestivalOn(run) &&
    knowhowOf(run) >= festivalCost()
  )
    plates.push("festival");
  if (run.phase === 1) {
    if (waterLevel(run) < WATER_LOW || canBuildStorage(run))
      plates.push("water");
    if (!isFieldPlanted(run)) plates.push("market");
    if (isDayFree(run)) plates.push("pumpkin");
  }
  if (run.phase === 2) {
    if (waterLevel(run) < WATER_LOW || canBuildStorage(run))
      plates.push("water");
    if (biomeGap(run) >= TUNING.world.playerMargin) plates.push("spread");
    if (isFlockReady(run)) plates.push("flock");
  }
  if (run.phase === 3 && isWanting(run)) plates.push("pot");
  return plates;
}

/** The harvest plate counts as tended while the player picks by hand. */
export const GROW_PLATE_ACTIONS: Readonly<Record<string, readonly string[]>> = {
  harvest: [YARD_HARVEST],
  bees: BEE_ACTION_IDS,
  market: PLANT_ACTION_IDS,
  spread: SPREAD_ACTION_IDS,
  pumpkin: PUMPKIN_ACTION_IDS,
  flock: MIGRATION_ACTION_IDS,
  pot: WINDOWBOX_ACTION_IDS,
  fork: FORK_ACTION_IDS,
  festival: [FESTIVAL_ACTION_ID],
};

/**
 * Real choices, for the decision-gap metric: which patch to follow, what to
 * plant, what to spread, whether to feed or enter the pumpkin, where to send the flock,
 * how to tend the pot. Picking the harvest is a collect, not a choice.
 */
export const GROW_DECISION_ACTIONS: readonly string[] = [
  ...BEE_ACTION_IDS,
  ...FORK_ACTION_IDS,
  FESTIVAL_ACTION_ID,
  ...PLANT_ACTION_IDS,
  ...SPREAD_ACTION_IDS,
  ...PUMPKIN_ACTION_IDS,
  ...MIGRATION_ACTION_IDS,
  ...WINDOWBOX_ACTION_IDS,
];

/** The tank is the backyard's one watched number. */
export const GROW_CONSUMABLES: readonly ConsumableDef[] = [
  {
    id: "water",
    label: "Water",
    level: (run) => (run.phase <= 2 ? waterLevel(run) : null),
    lowZone: { lo: 0.02, hi: 0.35 },
  },
];

/**
 * Income probes read the baskets at work: a harvest by hand is not income,
 * and an emptied basket should not read as no helpers at all.
 */
export function growIncomeView(run: RunState): RunState {
  if (run.phase === 1) {
    // A harvest day's or a ribbon's pay flowing in is not income.
    const view = withoutMarketDay({ ...run, resources: { ...run.resources } });
    return isPumpkinOpen(view) ? withoutPumpkin(view) : view;
  }
  if (run.phase === 2 && isMigrationOpen(run))
    // A landing flowing in is not income.
    return withoutMigration({ ...run, resources: { ...run.resources } });
  if (run.phase === 3)
    // An answer from the music box is not income.
    return withoutWindowBox({ ...run, resources: { ...run.resources } });
  if (run.phase !== 0) return run;
  const floor = pickPerSecond(run) * 2;
  const view =
    floor <= ripeProduce(run)
      ? run
      : { ...run, resources: { ...run.resources, produce: floor } };
  if (!isBeesOpen(view)) return view;
  // A pollination flowing in is not income.
  return withoutBees({ ...view, resources: { ...view.resources } });
}

/** Each of the first few shows up on its own, then one more for every two. */
const tierOf = (n: number): number =>
  n <= 4 ? Math.max(0, n) : 4 + Math.floor((n - 4) / 2);

/** The parts of the scene that visibly change when something is built. */
function sceneKey(run: RunState): string {
  const s = sceneInfo(run);
  return [
    s.phase,
    tierOf(s.helpers),
    tierOf(s.scaling),
    tierOf(s.hives),
    tierOf(s.pickers),
    tierOf(s.storage),
    tierOf(s.machines),
    s.crop,
    s.cover,
    s.forest,
    s.jungle,
    s.meadow,
    s.wetland,
    s.biome,
    s.season,
    s.dry,
    s.ended,
    s.growth,
    potStage(run),
    s.beds,
    s.bloom,
    s.greenhouse,
    s.orchard,
    s.stand,
    s.barrow,
    s.tea,
    s.keeper,
    s.fork,
    s.projects,
    s.festival,
    // The farm's one-offs: silos, the market agent, the fair tent and helper.
    run.owned.silo ?? 0,
    run.owned[MARKET_AGENT_ID] ?? 0,
    isPumpkinOpen(run),
    run.owned[PUMPKIN_HAND_ID] ?? 0,
  ].join("|");
}

/** True when the picture differs between two runs. */
export const growSceneDiff = (before: RunState, after: RunState): boolean =>
  sceneKey(before) !== sceneKey(after);
