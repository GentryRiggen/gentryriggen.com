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
  isFleetGlowing,
  isOilCheap,
  isOilDear,
  nextFlareIn,
  tankCapacity,
  isBeamOpen,
  calmSkyIncomePerSecond,
  resolvePerSecond,
} from "./tick";
import { TUNING } from "./tuning";
import { LAMP_ACTIONS } from "./lamps";
import { BEAM_ACTIONS } from "./beam";
import {
  MAX_CREWS,
  POST_COUNT,
  TOWNS,
  POST_BUILD,
  POST_SCHOOL,
  POST_WATCH,
  crewCount,
  crewPostActionId,
  isCrewsOpen,
  isWeatherOpen,
  postOf,
  setPost,
} from "./weather";
import { TOLL_ACTIONS } from "./toll";
import { noteBuy } from "./tanker";
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
import { FORK_ACTIONS } from "./forks";
import {
  OVERDRIVE_ACTION,
  isOverdriveOn,
  isOverdriveOpen,
  isOverdriveSteady,
  lastOverdrive,
  overdriveCost,
  overdriveSecondsLeft,
  startOverdrive,
} from "./overdrive";
import {
  DEPOSIT_SHARES,
  WITHDRAW_ACTION,
  deposit,
  depositActionId,
  fundBalance,
  fundFee,
  fundKind,
  fundPayout,
  isFundOpen,
  withdrawAll,
} from "./fund";

const TREND_THRESHOLD = 0.015;

const trendArrow = (trend: number): string =>
  trend > TREND_THRESHOLD ? "↑" : trend < -TREND_THRESHOLD ? "↓" : "→";

/** Buying oil by hand at whatever the price is doing. */
const BUY_OIL: ActionDef = {
  id: "buy-oil",
  phases: [PHASE_COAST],
  // The lamp panel draws the button next to the tank and the knob.
  isInline: true,
  visibleWhen: (run) => isBeamOpen(run),
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
    const wasDark = run.resources.oil <= 0;
    const oil = paid / Math.max(run.resources.oilPrice, 0.01);
    run.resources.oil += oil;
    noteBuy(run, wasDark, oil / tankCapacity(run));
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
    run.resources.knowhow =
      (run.resources.knowhow ?? 0) + TUNING.projects.sky.perCourse;
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
    run.resources.knowhow =
      (run.resources.knowhow ?? 0) + TUNING.projects.sky.perFlare;
    run.resources.flaresCaught = (run.resources.flaresCaught ?? 0) + 1;
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

/** Where a post is, in words. */
const postName = (post: number): string =>
  post === POST_BUILD
    ? "building"
    : post === POST_SCHOOL
      ? "the school"
      : `${TOWNS[post - POST_WATCH]} on storm watch`;

/** One button per crew and post; the crews panel draws them itself. */
const CREW_POSTS: readonly ActionDef[] = Array.from(
  { length: MAX_CREWS },
  (_, crew) =>
    Array.from({ length: POST_COUNT }, (_, post): ActionDef => ({
      id: crewPostActionId(crew, post),
      phases: [PHASE_NIGHT],
      isInline: true,
      visibleWhen: (run) =>
        isCrewsOpen(run) &&
        crew < crewCount(run) &&
        (post < POST_WATCH || isWeatherOpen(run)),
      describe: (run) => ({
        label: `Crew ${crew + 1}: ${postName(post)}`,
        detail:
          postOf(run, crew) === post
            ? "Already there."
            : "It spends a little while on the road first.",
        isBlocked: postOf(run, crew) === post,
      }),
      perform: (run) => setPost(run, crew, post),
    }))
).flat();

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

/**
 * The second thing know-how buys: a minute of everything paying double. At
 * night nothing charges the batteries and the evening rush is bigger; in the
 * sky the fleet slips faster. Steady all minute, half comes back.
 */
const OVERDRIVE: ActionDef = {
  id: OVERDRIVE_ACTION,
  phases: [PHASE_NIGHT, PHASE_SKY],
  visibleWhen: isOverdriveOpen,
  describe: (run) => {
    const O = TUNING.overdrive;
    const isNight = run.phase === 1;
    if (isOverdriveOn(run)) {
      const isSteady = isOverdriveSteady(run);
      return {
        label: isNight
          ? "The plants are running hot"
          : "The fleet is at full burn",
        detail: `${Math.ceil(overdriveSecondsLeft(run))} s left · ${
          isSteady
            ? `steady so far: half your know-how comes back`
            : isNight
              ? "a district went dark: no know-how comes back"
              : "the fleet slipped: no know-how comes back"
        }`,
        isBlocked: true,
        hint: isSteady
          ? { text: "steady", tone: "good" }
          : { text: "slipped", tone: "bad" },
      };
    }
    const last = lastOverdrive(run);
    return {
      label: isNight ? "Run the plants hot" : "Full burn",
      detail: `${last === 1 ? "Last run held steady. " : last === 2 ? "Last run slipped. " : ""}Everything pays ${O.boost}× for ${O.seconds} s, ${
        isNight
          ? `but nothing charges the batteries and the evening rush is ${Math.round((TUNING.grid.hotPeak - 1) * 100)}% bigger. Keep every district lit all minute and half the know-how comes back.`
          : `but the fleet slips ${O.strain}× as fast. Keep it above ${O.cleanAbove}% and half the know-how comes back.`
      }`,
      cost: { resource: "knowhow", amount: overdriveCost(run) },
    };
  },
  perform: (run) => startOverdrive(run),
};

/** The smallest deposit worth a click. */
const MIN_DEPOSIT = 1;

/** The fund's buttons (a share of what you hold goes in); its panel draws them. */
const FUND_IN: readonly ActionDef[] = DEPOSIT_SHARES.map((share) => ({
  id: depositActionId(share),
  isInline: true,
  visibleWhen: isFundOpen,
  describe: (run) => {
    const { currency, name } = fundKind(run);
    const amount = (run.resources[currency] ?? 0) * share;
    return {
      label:
        share >= 1
          ? `Put it all in the ${name}`
          : `Put ${Math.round(share * 100)}% in the ${name}`,
      detail: `${formatNumber(Math.floor(amount))} ${currency} goes in.`,
      cost: { resource: currency, amount },
      isBlocked: amount < MIN_DEPOSIT,
    };
  },
  perform: (run, paid) => deposit(run, paid),
}));

const FUND_OUT: ActionDef = {
  id: WITHDRAW_ACTION,
  isInline: true,
  visibleWhen: isFundOpen,
  describe: (run) => {
    const { name } = fundKind(run);
    const balance = fundBalance(run);
    return {
      label: `Take it all out of the ${name}`,
      detail: `${formatNumber(Math.floor(fundPayout(run)))} comes out after the ${Math.round(fundFee(run) * 100)}% fee.`,
      isBlocked: balance < MIN_DEPOSIT,
    };
  },
  perform: (run) => withdrawAll(run),
};

export const ACTIONS: readonly ActionDef[] = [
  OVERDRIVE,
  ...FORK_ACTIONS,
  ...FUND_IN,
  FUND_OUT,
  BUY_OIL,
  CORRECT_COURSE,
  CATCH_FLARE,
  STEER_BOAT,
  FLASH_LAMP,
  ...CREW_POSTS,
  ...LAUNCH_ROUTE,
  WATER_GARDEN,
  PICK_BLOOMS,
  ...LAMP_ACTIONS,
  ...BEAM_ACTIONS,
  ...TOLL_ACTIONS,
];
