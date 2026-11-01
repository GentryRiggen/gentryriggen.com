import { formatNumber } from "../../engine/format";
import type { ActionDef, RunState } from "../../engine/types";
import { PHASE_YARD } from "./resources";
import { seasonBoost, seasonOf } from "./seasons";
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

export const GROW_ACTIONS: readonly ActionDef[] = [HARVEST];

/** Used by the plate and by bots: enough ripe to bother with. */
export const isWorthPicking = (run: RunState): boolean =>
  ripeProduce(run) >= TUNING.yard.ripeShown;
