import { upgradeCost } from "../../engine/engine";
import type { ConsumableDef, RunState } from "../../engine/types";
import { YARD_HARVEST, ripeProduce } from "./actions";
import { sceneInfo } from "./scene";
import { pickPerSecond } from "./tick";
import { TUNING } from "./tuning";
import { UPGRADES } from "./upgrades";
import { STORAGE_IDS, waterLevel } from "./water";

/** The water plate lights when the tank is under this share. */
const WATER_LOW = 0.35;

/** True when a storage upgrade is on offer and the seeds are in hand. */
function canBuildStorage(run: RunState): boolean {
  return UPGRADES.some((u) => {
    if (!STORAGE_IDS.includes(u.id)) return false;
    if ((run.owned[u.id] ?? 0) >= (u.maxLevel ?? 1)) return false;
    if (!run.revealed.includes(u.id)) return false;
    return (run.resources[u.currency] ?? 0) >= upgradeCost(run, u);
  });
}

/** Systems asking for the player's attention: the tap, water and the harvest. */
export function growPlates(run: RunState): string[] {
  const plates = ["tap"];
  if (run.phase === 0) {
    if (waterLevel(run) < WATER_LOW || canBuildStorage(run))
      plates.push("water");
    if (ripeProduce(run) >= TUNING.yard.ripeFor) plates.push("harvest");
  }
  return plates;
}

/** The harvest plate counts as tended while the player picks by hand. */
export const GROW_PLATE_ACTIONS: Readonly<Record<string, readonly string[]>> = {
  harvest: [YARD_HARVEST],
};

/** The tank is the backyard's one watched number. */
export const GROW_CONSUMABLES: readonly ConsumableDef[] = [
  {
    id: "water",
    label: "Water",
    level: (run) => (run.phase === 0 ? waterLevel(run) : null),
    lowZone: { lo: 0.02, hi: 0.35 },
  },
];

/**
 * Income probes read the baskets at work: a harvest by hand is not income,
 * and an emptied basket should not read as no helpers at all.
 */
export function growIncomeView(run: RunState): RunState {
  if (run.phase !== 0) return run;
  const floor = pickPerSecond(run) * 2;
  if (floor <= ripeProduce(run)) return run;
  return { ...run, resources: { ...run.resources, produce: floor } };
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
    s.season,
    s.dry,
    s.ended,
    s.growth,
  ].join("|");
}

/** True when the picture differs between two runs. */
export const growSceneDiff = (before: RunState, after: RunState): boolean =>
  sceneKey(before) !== sceneKey(after);
