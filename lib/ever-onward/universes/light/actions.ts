import type { ActionDef } from "../../engine/types";
import { PHASE_COAST } from "./resources";
import { barrelOil, isOilCheap, isOilDear, tankCapacity } from "./tick";

const TREND_THRESHOLD = 0.015;

const trendArrow = (trend: number): string =>
  trend > TREND_THRESHOLD ? "↑" : trend < -TREND_THRESHOLD ? "↓" : "→";

/** Buying oil by hand at whatever the price is doing. */
const BUY_OIL: ActionDef = {
  id: "buy-oil",
  phases: [PHASE_COAST],
  visibleWhen: (run) => run.resources.ships >= 12,
  describe: (run) => {
    const oil = barrelOil(run);
    const price = run.resources.oilPrice;
    const tone = isOilCheap(run) ? "good" : isOilDear(run) ? "bad" : "neutral";
    const text = isOilCheap(run)
      ? "cheap!"
      : isOilDear(run)
        ? "pricey"
        : "fair";
    return {
      label: oil < 1 ? "The tank is full" : `Buy oil (${Math.floor(oil)})`,
      detail: `${price.toFixed(2)} a barrel ${trendArrow(
        run.resources.oilTrend
      )} · tank ${Math.floor(run.resources.oil)} of ${Math.floor(
        tankCapacity(run)
      )}`,
      cost: { resource: "coins", amount: oil * price },
      isBlocked: oil < 1,
      hint: { text, tone },
      trendResource: "oilPrice",
    };
  },
  perform: (run) => {
    run.resources.oil += barrelOil(run);
  },
};

export const ACTIONS: readonly ActionDef[] = [BUY_OIL];
