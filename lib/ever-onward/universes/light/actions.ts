import type { ActionDef } from "../../engine/types";
import { PHASE_COAST, PHASE_NIGHT, PHASE_SKY } from "./resources";
import {
  barrelOil,
  flareBonus,
  headingFactor,
  headingOf,
  isCourseAuto,
  isCourseInPlay,
  isFlareOn,
  gridFactor,
  gridSteadiness,
  isGridAuto,
  isGridInPlay,
  isOilCheap,
  isOilDear,
  isRushOn,
  rushBonus,
  tankCapacity,
} from "./tick";
import { formatNumber } from "../../engine/format";

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

/** Steadiness at or above this has nothing to fix. */
const GRID_STEADY = 95;

/** The grid strains as cities light; a free fix, whenever you like. */
const BALANCE_GRID: ActionDef = {
  id: "balance-grid",
  phases: [PHASE_NIGHT],
  visibleWhen: (run) => isGridInPlay(run) && !isGridAuto(run),
  describe: (run) => {
    const steadiness = gridSteadiness(run);
    const pays = Math.round(gridFactor(run) * 100);
    const tone = steadiness < 50 ? "bad" : steadiness < 80 ? "neutral" : "good";
    const text =
      steadiness < 50 ? "dimming" : steadiness < 80 ? "uneasy" : "steady";
    return {
      label:
        steadiness >= GRID_STEADY ? "The grid is steady" : "Balance the grid",
      detail: `Steadiness ${Math.floor(steadiness)}% · cities pay ${pays}%${
        isRushOn(run) ? " · rush hour, it strains fast" : ""
      }`,
      isBlocked: steadiness >= GRID_STEADY,
      hint: { text, tone },
      trendResource: "grid",
    };
  },
  perform: (run) => {
    run.resources.grid = 100;
  },
};

/** A claimable bonus while the evening rush is on; claiming it never costs. */
const RIDE_RUSH: ActionDef = {
  id: "ride-rush",
  phases: [PHASE_NIGHT],
  visibleWhen: (run) => isRushOn(run),
  describe: (run) => ({
    label: "Ride the evening rush",
    detail: `Everyone is switching on at once: +${formatNumber(
      Math.floor(rushBonus(run))
    )} power`,
    hint: { text: "bonus", tone: "good" },
  }),
  perform: (run) => {
    run.resources.power += rushBonus(run);
    run.resources.rush = 0;
  },
};

/** Heading at or above this has nothing to correct. */
const ON_COURSE = 95;

/** Probes wander as the fleet grows; a free correction points them home. */
const CORRECT_COURSE: ActionDef = {
  id: "correct-course",
  phases: [PHASE_SKY],
  visibleWhen: (run) => isCourseInPlay(run) && !isCourseAuto(run),
  describe: (run) => {
    const heading = headingOf(run);
    const pace = Math.round(headingFactor(run) * 100);
    const tone = heading < 50 ? "bad" : heading < 80 ? "neutral" : "good";
    const text = heading < 50 ? "lost" : heading < 80 ? "drifting" : "true";
    return {
      label:
        heading >= ON_COURSE
          ? "The fleet is on course"
          : "Send a course correction",
      detail: `Heading ${Math.floor(heading)}% · the fleet works at ${pace}% pace${
        isFlareOn(run) ? " · a flare is out" : ""
      }`,
      isBlocked: heading >= ON_COURSE,
      hint: { text, tone },
      trendResource: "heading",
    };
  },
  perform: (run) => {
    run.resources.heading = 100;
  },
};

/** A claimable bonus while a solar flare is out; claiming it never costs. */
const CATCH_FLARE: ActionDef = {
  id: "catch-flare",
  phases: [PHASE_SKY],
  visibleWhen: (run) => isFlareOn(run),
  describe: (run) => ({
    label: "Catch the solar flare",
    detail: `A burst of sunlight for the taking: +${formatNumber(
      Math.floor(flareBonus(run))
    )} energy`,
    hint: { text: "bonus", tone: "good" },
  }),
  perform: (run) => {
    run.resources.energy += flareBonus(run);
    run.resources.flare = 0;
  },
};

export const ACTIONS: readonly ActionDef[] = [
  BUY_OIL,
  BALANCE_GRID,
  RIDE_RUSH,
  CORRECT_COURSE,
  CATCH_FLARE,
];
