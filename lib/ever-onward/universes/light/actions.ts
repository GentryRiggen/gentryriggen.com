import type { ActionDef } from "../../engine/types";
import { PHASE_COAST, PHASE_LAST, PHASE_NIGHT, PHASE_SKY } from "./resources";
import {
  boatArrived,
  boatHeadingOf,
  isBoatOut,
  isReadyToFlash,
  steerBonus,
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
  isGridGlowing,
  isFleetGlowing,
  isGridInPlay,
  isOilCheap,
  isOilDear,
  isRushOn,
  nextFlareIn,
  nextRushIn,
  rushBonus,
  balanceKnowhow,
  tankCapacity,
  calmIncomePerSecond,
  calmSkyIncomePerSecond,
  resolvePerSecond,
} from "./tick";
import { TUNING } from "./tuning";
import {
  TOWNS,
  chanceOf,
  hasWeatherVane,
  isShielded,
  shieldActionId,
  shieldSlots,
  toggleShield,
  weatherStage,
} from "./weather";
import {
  HAUL_ACTION,
  SET_NETS_ACTION,
  catchCoins,
  earlinessIfSetNow,
  haulIn,
  isTideOpen,
  netState,
  setNets,
} from "./tide";
import {
  ROUTES,
  isProbeOut,
  isProbesOpen,
  launchActionId,
  launchProbe,
  routeHaul,
  routeSeconds,
} from "./probes";
import {
  PICK_ACTION,
  WATER_ACTION,
  bloomCount,
  pickWorthShown,
  canWaterNow,
  growingCount,
  isGardenOpen,
  pickBlooms,
  waterCooldownLeft,
  waterGarden,
} from "./garden";
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
    const room = tankCapacity(run) - run.resources.oil;
    const price = run.resources.oilPrice;
    const tone = isOilCheap(run) ? "good" : isOilDear(run) ? "bad" : "neutral";
    const text = isOilCheap(run)
      ? "cheap!"
      : isOilDear(run)
        ? "pricey"
        : "fair";
    return {
      label:
        room < 1
          ? "The tank is full"
          : oil < 1
            ? "Not enough coins for oil"
            : oil >= room - 0.5
              ? `Buy oil, fill the tank (${Math.floor(oil)})`
              : `Buy oil (${Math.floor(oil)})`,
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
  // The engine took `paid` coins for what the tank could take or the coins
  // could buy; the oil is exactly what that paid for.
  perform: (run, paid) => {
    run.resources.oil += paid / Math.max(run.resources.oilPrice, 0.01);
  },
};

/** Steadiness at or above this has nothing to fix. */
const GRID_STEADY = 75;

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
        steadiness >= GRID_STEADY
          ? "The grid is steady and glowing"
          : "Balance the grid",
      detail: `Steadiness ${Math.floor(steadiness)}% · cities pay ${pays}%${
        isGridGlowing(run) ? " (steady glow +15%)" : ""
      }${isRushOn(run) ? " · rush hour is waiting" : ""}`,
      isBlocked: steadiness >= GRID_STEADY,
      hint: { text, tone },
      trendResource: "grid",
    };
  },
  perform: (run) => {
    run.resources.grid = 100;
    run.resources.knowhow = (run.resources.knowhow ?? 0) + balanceKnowhow(run);
  },
};

/** A claimable bonus while the evening rush is on; claiming it never costs. */
const RIDE_RUSH: ActionDef = {
  id: "ride-rush",
  phases: [PHASE_NIGHT],
  visibleWhen: (run) => isRushOn(run),
  describe: (run) => ({
    label: "Ride the evening rush",
    detail: `Everyone is switching on at once, and it will wait for you: +${formatNumber(
      Math.floor(rushBonus(run))
    )} power`,
    hint: { text: "bonus", tone: "good" },
  }),
  perform: (run) => {
    run.resources.power += rushBonus(run);
    run.resources.knowhow =
      (run.resources.knowhow ?? 0) + TUNING.projects.perRush;
    run.resources.rushRides = (run.resources.rushRides ?? 0) + 1;
    run.resources.rush = 0;
    run.resources.rushCooldown = nextRushIn(run);
  },
};

/** Heading at or above this has nothing to correct. */
const ON_COURSE = 75;

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
          ? "The fleet is on course, in formation"
          : "Send a course correction",
      detail: `Heading ${Math.floor(heading)}% · the fleet works at ${pace}% pace${
        isFleetGlowing(run) ? " (steady glow +15%)" : ""
      }${isFlareOn(run) ? " · a flare is out" : ""}`,
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
    detail: `A burst of sunlight, waiting for you to take it: +${formatNumber(
      Math.floor(flareBonus(run))
    )} energy`,
    hint: { text: "bonus", tone: "good" },
  }),
  perform: (run) => {
    run.resources.energy += flareBonus(run);
    run.resources.flare = 0;
    run.resources.flareCooldown = nextFlareIn(run);
  },
};

/** Heading at or above this has nothing to steer. */
const BOAT_TRUE = 80;

/** The first ship's boat drifts in the dark; tap the old beam to steer it. */
const STEER_BOAT: ActionDef = {
  id: "steer-boat",
  phases: [PHASE_LAST],
  visibleWhen: (run) => isBoatOut(run) && !boatArrived(run),
  describe: (run) => {
    const heading = boatHeadingOf(run);
    const home = Math.floor(run.resources.boatProgress ?? 0);
    const tone =
      heading < 40 ? "bad" : heading < BOAT_TRUE ? "neutral" : "good";
    const text =
      heading < 40 ? "lost" : heading < BOAT_TRUE ? "drifting" : "true";
    return {
      label:
        heading >= BOAT_TRUE ? "The boat is on its way" : "Tap the old beam",
      detail: `The boat is ${home}% of the way home · heading ${Math.floor(heading)}% · letting go ${steerBonus(run).toFixed(1)}x faster`,
      isBlocked: heading >= BOAT_TRUE,
      hint: { text, tone },
      trendResource: "boatHeading",
    };
  },
  perform: (run) => {
    run.resources.boatHeading = Math.min(
      100,
      boatHeadingOf(run) + TUNING.last.boatSteer
    );
  },
};

/** The game's first action, at the very end: one flash, the boat turns home. */
const FLASH_LAMP: ActionDef = {
  id: "flash-lamp",
  phases: [PHASE_LAST],
  visibleWhen: isReadyToFlash,
  describe: () => ({
    label: "Flash the lamp, once",
    detail:
      "The boat is waiting at the edge of the dark, with one lantern lit.",
    hint: { text: "the first ship", tone: "good" },
  }),
  perform: (run) => {
    run.resources.ships = 1;
    run.flags.finished = true;
  },
};

/** One shield toggle per town; the weather desk draws them itself. */
const SHIELD_TOWN: readonly ActionDef[] = TOWNS.map((name, town) => ({
  id: shieldActionId(town),
  phases: [PHASE_NIGHT],
  isInline: true,
  visibleWhen: (run) => weatherStage(run) === "forecast",
  describe: (run) => {
    const isOn = isShielded(run, town);
    const slots = shieldSlots(run);
    return {
      label: isOn ? `Lift the sandbags at ${name}` : `Sandbag ${name}`,
      detail: `${chanceOf(run, town)}% chance the storm lands here · ${slots} ${
        slots === 1 ? "town" : "towns"
      } at a time${hasWeatherVane(run) ? " · the weather vane covers you" : ""}`,
      hint: isOn ? { text: "shielded", tone: "good" as const } : undefined,
    };
  },
  perform: (run) => toggleShield(run, town),
}));

/** The tide clock's two buttons; its panel draws them itself. */
const SET_NETS: ActionDef = {
  id: SET_NETS_ACTION,
  phases: [PHASE_COAST],
  isInline: true,
  visibleWhen: isTideOpen,
  describe: (run) => {
    const state = netState(run);
    return {
      label: state === "empty" ? "Set the nets" : "The nets are out",
      detail:
        state === "empty"
          ? earlinessIfSetNow(run) >= 0.85
            ? "A full rising tide: the biggest catch."
            : "Set them before high tide. The earlier, the bigger the catch."
          : "They fill at high tide, and wait for you.",
      isBlocked: state !== "empty",
    };
  },
  perform: setNets,
};

const HAUL_IN: ActionDef = {
  id: HAUL_ACTION,
  phases: [PHASE_COAST],
  isInline: true,
  visibleWhen: isTideOpen,
  describe: (run) => ({
    label: "Haul in!",
    detail:
      netState(run) === "full"
        ? `The nets are full: about ${formatNumber(Math.floor(catchCoins(run, calmIncomePerSecond(run))))} coins.`
        : "Nothing to haul in yet.",
    isBlocked: netState(run) !== "full",
  }),
  perform: (run) => haulIn(run, calmIncomePerSecond(run)),
};

/** One launch button per route; the race panel draws them itself. */
const LAUNCH_ROUTE: readonly ActionDef[] = ROUTES.map((route, index) => ({
  id: launchActionId(index),
  phases: [PHASE_SKY],
  isInline: true,
  visibleWhen: isProbesOpen,
  describe: (run) => ({
    label: `Launch: ${route.name}`,
    detail: isProbeOut(run)
      ? "The probe is out. It will be back soon."
      : `${Math.round(routeSeconds(run, index))} s, about ${formatNumber(
          Math.floor(routeHaul(run, index, calmSkyIncomePerSecond(run)))
        )} energy.`,
    isBlocked: isProbeOut(run),
  }),
  perform: (run) => launchProbe(run, index, calmSkyIncomePerSecond(run)),
}));
/** The memory garden's two buttons; its panel draws them itself. */
const WATER_GARDEN: ActionDef = {
  id: WATER_ACTION,
  phases: [PHASE_LAST],
  isInline: true,
  visibleWhen: isGardenOpen,
  describe: (run) => {
    const wait = Math.ceil(waterCooldownLeft(run));
    return {
      label: "Water the garden",
      detail:
        growingCount(run) === 0
          ? "Everything is in bloom. Nothing is thirsty."
          : wait > 0
            ? "The can is filling up again."
            : "Every thirsty plant drinks and grows faster for a little while.",
      isBlocked: !canWaterNow(run),
    };
  },
  perform: waterGarden,
};

const PICK_BLOOMS: ActionDef = {
  id: PICK_ACTION,
  phases: [PHASE_LAST],
  isInline: true,
  visibleWhen: isGardenOpen,
  describe: (run) => {
    const ready = bloomCount(run);
    return {
      label: "Pick the blooms",
      detail:
        ready > 0
          ? `${ready} ${ready === 1 ? "flower is" : "flowers are"} ready: about +${formatNumber(
              pickWorthShown(ready, resolvePerSecond(run))
            )} resolve.`
          : "Nothing in bloom yet. They wait for you when they are.",
      isBlocked: ready <= 0,
    };
  },
  perform: (run) => pickBlooms(run, resolvePerSecond(run)),
};

export const ACTIONS: readonly ActionDef[] = [
  BUY_OIL,
  BALANCE_GRID,
  RIDE_RUSH,
  CORRECT_COURSE,
  CATCH_FLARE,
  STEER_BOAT,
  FLASH_LAMP,
  ...SHIELD_TOWN,
  SET_NETS,
  HAUL_IN,
  ...LAUNCH_ROUTE,
  WATER_GARDEN,
  PICK_BLOOMS,
];
