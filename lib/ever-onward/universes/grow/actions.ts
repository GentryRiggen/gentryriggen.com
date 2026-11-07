import { formatNumber } from "../../engine/format";
import type { ActionDef, RunState } from "../../engine/types";
import {
  BEDS,
  SELL_ALL_ID,
  SELL_HALF_ID,
  addBee,
  addBeeActionId,
  canAddBee,
  beesOn,
  honeyOf,
  honeyPrice,
  isBeesOpen,
  isDormant,
  isPlanted,
  plantActionId,
  plantBed,
  plantCost,
  sellHoney,
  takeBee,
  takeBeeActionId,
} from "./bees";
import { MIX_ACTIONS } from "./biomes";
import { pumpkinActions } from "./pumpkin";
import { FORK_ACTIONS } from "./forks";
import { FESTIVAL_ACTIONS } from "./knowhow";
import { MARKET_ACTIONS } from "./market";
import { PHASE_YARD } from "./resources";
import { seasonBoost, seasonOf } from "./seasons";
import { dayFarmPay, incomePerSecond } from "./tick";
import { BLIND_ACTIONS } from "./windowbox";
import { TUNING } from "./tuning";

export const YARD_HARVEST = "yard-harvest";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** Ripe produce waiting in the garden. */
export const ripeProduce = (run: RunState): number =>
  run.resources.produce ?? 0;

/** True once a sprinkler has the garden ripening. */
export const hasYardHarvest = (run: RunState): boolean =>
  owned(run, "sprinkler") >= 1 || ripeProduce(run) >= 1;

/** What picking it all by hand pays right now (autumn pays the most). */
export const handHarvestPays = (run: RunState): number =>
  ripeProduce(run) *
  seasonBoost(run, "harvest") *
  (owned(run, "honey-stand") > 0 ? TUNING.yard.honey : 1);

const SEASON_HINT = {
  spring: "Spring: planting pays more.",
  summer: "Summer: things grow fast.",
  autumn: "Autumn: the best time to pick!",
  winter: "Winter: the garden rests.",
} as const;

/** Pick everything ripe by hand. It waits forever, so there is no hurry. */
const HARVEST: ActionDef = {
  id: YARD_HARVEST,
  phases: [PHASE_YARD],
  visibleWhen: hasYardHarvest,
  describe: (run) => {
    const ripe = ripeProduce(run);
    const season = seasonOf(run);
    const boost = seasonBoost(run, "harvest");
    return {
      label:
        ripe < 1
          ? "Nothing ripe yet"
          : `Pick the harvest (${formatNumber(Math.floor(ripe))})`,
      detail: `${SEASON_HINT[season]} Ripe produce waits, it never spoils.`,
      isBlocked: ripe < 1,
      hint:
        boost > 1
          ? { text: season === "autumn" ? "best!" : "nice", tone: "good" }
          : undefined,
    };
  },
  perform: (run) => {
    run.resources.seeds += handHarvestPays(run);
    run.resources.produce = 0;
  },
};

/** Pollination's buttons; the bee panel draws them itself. */
const POLLINATION: readonly ActionDef[] = [
  ...BEDS.flatMap((bed, index): ActionDef[] => [
    {
      id: plantActionId(index),
      phases: [PHASE_YARD],
      isInline: true,
      visibleWhen: isBeesOpen,
      describe: (run) => ({
        label: `Plant ${bed.name.toLowerCase()}`,
        detail: bed.gives,
        cost: {
          resource: "seeds",
          amount: plantCost(run, index, incomePerSecond(run)),
        },
        isBlocked: isPlanted(run, index),
      }),
      perform: (run) => plantBed(run, index),
    },
    {
      id: addBeeActionId(index),
      phases: [PHASE_YARD],
      isInline: true,
      visibleWhen: isBeesOpen,
      describe: (run) => ({
        label: `Send a bee to the ${bed.name.toLowerCase()}`,
        isBlocked: !canAddBee(run, index),
      }),
      perform: (run) => addBee(run, index),
    },
    {
      id: takeBeeActionId(index),
      phases: [PHASE_YARD],
      isInline: true,
      visibleWhen: isBeesOpen,
      describe: (run) => ({
        label: `Call a bee home from the ${bed.name.toLowerCase()}`,
        isBlocked: beesOn(run, index) <= 0,
      }),
      perform: (run) => takeBee(run, index),
    },
  ]),
  ...[
    { id: SELL_HALF_ID, share: 0.5, label: "Sell half the honey" },
    { id: SELL_ALL_ID, share: 1, label: "Sell all the honey" },
  ].map(({ id, share, label }): ActionDef => ({
    id,
    phases: [PHASE_YARD],
    isInline: true,
    visibleWhen: isBeesOpen,
    describe: (run) => ({
      label,
      detail: `+${formatNumber(
        Math.floor(honeyOf(run) * share * honeyPrice(run, incomePerSecond(run)))
      )} seeds${isDormant(run) ? " (winter price!)" : ""}`,
      isBlocked: honeyOf(run) < 1,
    }),
    perform: (run) => sellHoney(run, share, incomePerSecond(run)),
  })),
];

export const GROW_ACTIONS: readonly ActionDef[] = [
  HARVEST,
  ...FORK_ACTIONS,
  ...POLLINATION,
  ...MARKET_ACTIONS,
  ...FESTIVAL_ACTIONS,
  ...MIX_ACTIONS,
  ...pumpkinActions(dayFarmPay),
  ...BLIND_ACTIONS,
];

/** Used by the plate and by bots: enough ripe to bother with. */
export const isWorthPicking = (run: RunState): boolean =>
  ripeProduce(run) >= TUNING.yard.ripeShown;
