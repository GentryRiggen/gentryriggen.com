import type { ActionDef } from "../../engine/types";
import { PHASE_COAST, PHASE_LAST, PHASE_NIGHT } from "./resources";
import {
  barrelOil,
  isOilCheap,
  isOilDear,
  tankCapacity,
  isBeamOpen,
  incomePerSecond,
} from "./tick";
import { short } from "./preview";
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
  moveFee,
  isCommitted,
} from "./weather";
import { TOLL_ACTIONS } from "./toll";
import { noteBuy } from "./tanker";
import { DESIGN_ACTIONS, RECALL } from "./design";
import { DISTANCE_ACTIONS } from "./sunEdge";
import { LET_GO_ACTIONS, isReadyToFlash, letAllGo } from "./warmth";
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

/** The game's first action, at the very end: one flash, the boat turns home. */
const FLASH_LAMP: ActionDef = {
  id: "flash-lamp",
  phases: [PHASE_LAST],
  visibleWhen: isReadyToFlash,
  describe: () => ({
    label: "Flash the lamp, once",
    detail:
      "The boat is home, waiting at the edge of the dark with one lantern lit. Whatever still burns will lift off with the flash.",
    hint: { text: "the first ship", tone: "good" },
  }),
  perform: (run) => {
    // Whatever still burns lifts off together with the flash.
    letAllGo(run);
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
        detail: isCommitted(run, crew)
          ? "On watch until the storm lands."
          : postOf(run, crew) === post
            ? "Already there."
            : post >= POST_WATCH
              ? `The road takes ${TUNING.grid.moveSeconds} s, and the sandbags and wages cost about ${short(moveFee(incomePerSecond(run)))} power.`
              : `The road takes ${TUNING.grid.moveSeconds} s, and nothing else.`,
        isBlocked: postOf(run, crew) === post || isCommitted(run, crew),
      }),
      perform: (run) => {
        if (postOf(run, crew) === post || isCommitted(run, crew)) return;
        // Going out on storm duty costs sandbags and wages; coming home is free.
        const fee = post >= POST_WATCH ? moveFee(incomePerSecond(run)) : 0;
        run.resources.power = Math.max(0, (run.resources.power ?? 0) - fee);
        setPost(run, crew, post);
      },
    }))
).flat();

/**
 * The second thing know-how buys: a minute of everything paying double. The
 * plants run hot, nothing charges the batteries and the evening rush is
 * bigger. Keep every district lit all minute and half comes back.
 */
const OVERDRIVE: ActionDef = {
  id: OVERDRIVE_ACTION,
  phases: [PHASE_NIGHT],
  visibleWhen: isOverdriveOpen,
  describe: (run) => {
    const O = TUNING.overdrive;
    if (isOverdriveOn(run)) {
      const isSteady = isOverdriveSteady(run);
      return {
        label: "The plants are running hot",
        detail: `${Math.ceil(overdriveSecondsLeft(run))} s left · ${
          isSteady
            ? `steady so far: half your know-how comes back`
            : "a district went dark: no know-how comes back"
        }`,
        isBlocked: true,
        hint: isSteady
          ? { text: "steady", tone: "good" }
          : { text: "slipped", tone: "bad" },
      };
    }
    const last = lastOverdrive(run);
    return {
      label: "Run the plants hot",
      detail: `${last === 1 ? "Last run held steady. " : last === 2 ? "Last run slipped. " : ""}Everything pays ${O.boost}× for ${O.seconds} s, but nothing charges the batteries and the evening rush is ${Math.round((TUNING.grid.hotPeak - 1) * 100)}% bigger. Keep every district lit all minute and half the know-how comes back.`,
      cost: { resource: "knowhow", amount: overdriveCost() },
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
  FLASH_LAMP,
  ...CREW_POSTS,
  ...DESIGN_ACTIONS,
  RECALL,
  ...DISTANCE_ACTIONS,
  ...LET_GO_ACTIONS,
  ...LAMP_ACTIONS,
  ...BEAM_ACTIONS,
  ...TOLL_ACTIONS,
];
