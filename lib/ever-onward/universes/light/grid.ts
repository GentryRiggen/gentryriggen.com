import { isProjectDone } from "../../engine/engine";
import { nextRandom } from "../../engine/rng";
import type { RunState } from "../../engine/types";
import { hasFork, windRamp } from "./forkState";
import { isOverdriveOn } from "./overdrive";
import {
  isGridInPlay,
  lampEffect,
  returnLampsHome,
  supplyMW,
  tier,
} from "./tick";
import { TUNING } from "./tuning";

/**
 * The grid: plants, power lines and batteries have to stay in step.
 *
 * A day is `daySeconds` long. At dusk everybody switches on, and for a short
 * rush the cities want more than the plants make. Batteries soak up a share
 * of the plants' power by day and give it back at the rush; the power lines
 * limit how fast they can. Short of power at the rush, districts snap dark
 * for a little while and pay nothing; ride it out with every light on and
 * the night pays a bonus. Nothing is ever lost for good.
 *
 * The world moves the answer: each evening's rush is drawn from the grid's
 * own random stream (mild to scorching) and shown from the morning, so the
 * streetlights (which change how hard the rush hits) are worth setting each
 * evening. A battery is a buy; the clock, the charge and the tallies are
 * hidden numbers, so a save without them reads as "not begun".
 */

const G = TUNING.grid;
const FK = TUNING.fork;

/** Makes the grid's stream differ from the run's own and the weather's. */
const SEED_MIX = 0x27d4eb2f;

export const EVENING_NAMES = ["mild", "usual", "hot", "scorching"] as const;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const hasProject = (run: RunState, id: string): boolean =>
  isProjectDone(run, id);

// ------------------------------------------------------------------ the clock

export const isGridOpen = (run: RunState): boolean => isGridInPlay(run);

/** Seconds into the day (0 until the grid opens). */
export const gridClock = (run: RunState): number => res(run, "pgClock");

/** Where the day is, 0..1. */
export const dayShare = (run: RunState): number =>
  Math.min(1, Math.max(0, gridClock(run) / G.daySeconds));

export const isRushNow = (run: RunState): boolean =>
  isGridOpen(run) && res(run, "pgRush") > 0;

/** True from sunset to the rush (the time to set the streetlights). */
export const isDusk = (run: RunState): boolean =>
  isGridOpen(run) && gridClock(run) >= G.duskAt && !isRushNow(run);

/** Seconds until the rush begins (0 during it, counting on to tomorrow's after). */
export function secondsToRush(run: RunState): number {
  if (isRushNow(run)) return 0;
  const clock = gridClock(run);
  const until = G.rushAt - clock;
  return until >= 0 ? until : until + G.daySeconds;
}

/** Tonight's rush: 0 mild, 1 usual, 2 hot, 3 scorching. */
export const eveningLevel = (run: RunState): number =>
  Math.min(G.excess.length - 1, Math.max(0, Math.round(res(run, "pgLevel"))));

export const eveningName = (run: RunState): string =>
  EVENING_NAMES[eveningLevel(run)];

/** How much more than usual the rush asks tonight, before anything shapes it. */
export const eveningExcess = (run: RunState): number =>
  G.excess[eveningLevel(run)];

// ------------------------------------------------------------------ the pieces

/** What sets the rush's size on top of the evening's own. */
function peakMult(run: RunState, lampPeak: number): number {
  const fork = hasFork(run, "coal")
    ? FK.night.coalPeak
    : 1 + (FK.night.windPeak - 1) * windRamp(run);
  return (
    lampPeak *
    fork *
    (hasProject(run, "co-op") ? G.coopPeak : 1) *
    (hasProject(run, "rush-pricing") ? G.pricingPeak : 1) *
    (isOverdriveOn(run) ? G.hotPeak : 1)
  );
}

/** The rush's extra demand, as a share of the plants' power, at a streetlight step. */
export const rushExcessAt = (
  run: RunState,
  level: number,
  lampPeak: number
): number => G.excess[level] * peakMult(run, lampPeak);

/** The rush's extra demand tonight, with the streetlights as they are. */
export const rushExcess = (run: RunState): number =>
  rushExcessAt(run, eveningLevel(run), lampEffect(run).peak);

/** Steps of the battery chain bought (0 to 8). */
export const batteryCount = (run: RunState): number => tier(run, "batt");

/** What the batteries can hold (MW-seconds): each step holds about 2.7 times the last. */
export const batteryCapacity = (run: RunState): number => {
  const steps = batteryCount(run);
  return steps > 0
    ? G.batteryHolds[Math.min(steps, G.batteryHolds.length) - 1]
    : 0;
};

/** What is in them now, never more than they hold. */
export const batteryCharge = (run: RunState): number =>
  Math.min(batteryCapacity(run), Math.max(0, res(run, "pgCharge")));

/** How full they are, 0..1 (0 with none built). */
export const chargeShare01 = (run: RunState): number => {
  const cap = batteryCapacity(run);
  return cap > 0 ? Math.min(1, batteryCharge(run) / cap) : 0;
};

/** How much of the plants' power the lines let the batteries give back at once. */
export const rateShare = (run: RunState): number =>
  (G.rateBase + G.ratePerLine * tier(run, "lines")) *
  (hasProject(run, "line-patrols") ? TUNING.projects.patrolRate : 1);

/** The most the batteries can give back at once (MW). */
export const rushCarry = (run: RunState): number =>
  supplyMW(run) * rateShare(run);

// ------------------------------------------------------------------ the evening

export const districtsDark = (run: RunState): number =>
  isGridOpen(run)
    ? Math.min(G.districts, Math.max(0, Math.ceil(res(run, "pgDark") - 1e-9)))
    : 0;

/** 0 none yet, 1 the last evening stayed lit, 2 it went dark. */
export const lastEvening = (run: RunState): 0 | 1 | 2 => {
  const kind = Math.round(res(run, "pgLast"));
  return kind === 1 || kind === 2 ? kind : 0;
};

export const litNights = (run: RunState): number => res(run, "pgLits");
export const blackouts = (run: RunState): number => res(run, "pgBlackouts");

/** The banner on show: 0 none, 1 LIT ALL NIGHT, 2 BLACKOUT. */
export const gridBanner = (run: RunState): 0 | 1 | 2 => {
  if (run.phase !== 1 || res(run, "pgBannerLeft") <= 0) return 0;
  const kind = Math.round(res(run, "pgBanner"));
  return kind === 1 || kind === 2 ? kind : 0;
};

/** What the batteries are doing: 0 resting, 1 charging, 2 giving power. */
export function batteryFlow(run: RunState): 0 | 1 | 2 {
  if (!isGridOpen(run) || batteryCapacity(run) <= 0) return 0;
  if (isRushNow(run)) return batteryCharge(run) > 0 ? 2 : 0;
  const isFull = batteryCharge(run) >= batteryCapacity(run) - 1e-9;
  return isFull || isOverdriveOn(run) ? 0 : 1;
}

/** The sparkle after a lit night, until a blackout puts it out. */
export const isGridGlowing = (run: RunState): boolean =>
  isGridOpen(run) && lastEvening(run) === 1;

/**
 * A big moment is on in the picture, so pop-ups over the scene wait: the
 * banner, and the first few seconds of the dark (the houses snapping out).
 * Not the whole time some district is still waiting to come back.
 */
export const isGridMomentBusy = (run: RunState): boolean =>
  run.phase === 1 &&
  (gridBanner(run) > 0 ||
    (isRushNow(run) &&
      districtsDark(run) > 0 &&
      gridClock(run) < G.rushAt + G.snapSeconds));

/** Power the lit night pays: a slice of income. */
export const litBonus = (run: RunState, income: number): number =>
  G.litSeconds *
  income *
  (hasProject(run, "rush-pricing") ? TUNING.projects.rushPay : 1) *
  (hasProject(run, "lamplighters") ? TUNING.projects.lampLitPay : 1);

/**
 * What the batteries and lines would do on a full charge against a rush that
 * asks `excess` more than the plants make: the districts left dark at worst
 * (0..1 of the load) and the share of the rush met.
 */
export interface RushOutcome {
  /** The share of the load left unmet, averaged over the rush (0..1). */
  shed: number;
  /** The share of the rush's extra power the batteries cover. */
  covered: number;
  /**
   * Seconds of the whole grid's pay lost to the dark: the districts the
   * rush puts out (they stay out once out) while it lasts, and half the
   * time they take to come back.
   */
  darkSeconds: number;
  /** MW-seconds the batteries give back. */
  used: number;
  /** True when no district goes dark. */
  isLit: boolean;
}

export function rushOutcome(
  run: RunState,
  excess: number,
  charge: number
): RushOutcome {
  // Batteries keep a little back and never run to nothing.
  charge = Math.max(0, charge - G.reserveShare * batteryCapacity(run));
  const plants = supplyMW(run);
  if (plants <= 0 || excess <= 0)
    return {
      shed: 0,
      covered: 1,
      darkSeconds: 0,
      used: 0,
      isLit: true,
    };
  const need = plants * excess;
  const give = Math.min(need, rushCarry(run));
  const seconds = G.rushSeconds;
  const lastsFor = give > 0 ? Math.min(seconds, charge / give) : 0;
  const used = give * lastsFor;
  const shedWhile = (need - give) / (plants + need);
  const shedAfter = need / (plants + need);
  const shed =
    (shedWhile * lastsFor + shedAfter * (seconds - lastsFor)) / seconds;
  const isLit = give >= need - 1e-9 && lastsFor >= seconds - 1e-9;
  // The tick puts out whole districts and never lights one again mid-rush.
  const whole = (share: number): number =>
    Math.ceil(share * G.districts - 1e-9) / G.districts;
  const early = whole(shedWhile);
  const late =
    lastsFor < seconds - 1e-9 ? Math.max(early, whole(shedAfter)) : early;
  const darkSeconds = isLit
    ? 0
    : early * lastsFor +
      late * (seconds - lastsFor) +
      (late * G.recoverySeconds) / 2;
  return {
    shed,
    covered: Math.min(1, used / (need * seconds)),
    darkSeconds,
    used,
    isLit,
  };
}

/**
 * The share of a rush of this size the batteries could meet on a full day's
 * charge, with the streetlights at `lampPeak` (the usual brightness by
 * default, so a card reads the same whatever they are set to).
 */
export function rushCover(run: RunState, level: number, lampPeak = 1): number {
  const stored = Math.min(batteryCapacity(run), dailyChargeRoom(run));
  return rushOutcome(run, rushExcessAt(run, level, lampPeak), stored).covered;
}

/** What the batteries will hold when the rush begins, if they keep charging. */
export function chargeAtRush(run: RunState): number {
  const seconds = isRushNow(run) ? 0 : secondsToRush(run);
  const charging = isOverdriveOn(run)
    ? 0
    : supplyMW(run) * G.chargeShare * G.efficiency * seconds;
  return Math.min(batteryCapacity(run), batteryCharge(run) + charging);
}

/**
 * For the simulator's players (and the tests): the streetlight step that
 * earns the most over tonight's rush, counting what the step pays while the
 * rush is on, the dark districts and a lit night's bonus. The panel only
 * shows the numbers; reading them is the player's job.
 */
export function bestLampForTonight(run: RunState): number {
  const steps = TUNING.lamps.steps;
  const charge = chargeAtRush(run);
  const window = G.rushSeconds + G.lampLockSeconds + 3;
  const bonusSeconds = litBonus(run, 1);
  let best = steps.length - 1;
  let bestValue = -Infinity;
  for (let step = steps.length - 1; step >= 0; step -= 1) {
    const outcome = rushOutcome(
      run,
      rushExcessAt(run, eveningLevel(run), steps[step].peak),
      charge
    );
    // The lit night's bonus is paid at the step's own pay, like the tick does.
    const value =
      steps[step].pay *
      (window - outcome.darkSeconds + (outcome.isLit ? bonusSeconds : 0));
    if (value > bestValue + 1e-9) {
      bestValue = value;
      best = step;
    }
  }
  return best;
}

/** How many seconds of the whole grid's power the batteries hold. */
export const batterySecondsOfGrid = (run: RunState): number => {
  const plants = supplyMW(run);
  return plants > 0 ? batteryCapacity(run) / plants : 0;
};

/** The most the plants can put into the batteries in a day (MW-seconds stored). */
export const dailyChargeRoom = (run: RunState): number =>
  supplyMW(run) * G.chargeShare * G.efficiency * (G.daySeconds - G.rushSeconds);

/**
 * An average evening's effect on the cities' pay (about 1): the lit-night
 * bonus when the rush is met, the dark districts when it is not, and the
 * share charging takes. The income probes use it so a battery's worth shows
 * up as income; a real evening plays out in `tickGrid`.
 */
export function expectedEveningFactor(run: RunState): number {
  if (!isGridOpen(run)) return 1;
  const plants = supplyMW(run);
  if (plants <= 0) return 1;
  const stored = Math.min(batteryCapacity(run), dailyChargeRoom(run));
  const lamp = lampEffect(run).peak;
  let factor = 0;
  G.excess.forEach((_, level) => {
    const outcome = rushOutcome(run, rushExcessAt(run, level, lamp), stored);
    const bonus = outcome.isLit ? litBonus(run, 1) : 0;
    const dark = outcome.darkSeconds;
    const losses = (outcome.used * (1 / G.efficiency - 1)) / plants;
    factor += G.odds[level] * (1 + (bonus - dark - losses) / G.daySeconds);
  });
  return factor;
}

// ------------------------------------------------------------------ the tick

/** Draws the next evening's rush (the first few are gentle). */
function drawEvening(run: RunState): void {
  const r = run.resources;
  const days = res(run, "pgDays");
  if (days < G.gentleEvenings) {
    r.pgLevel = days;
    return;
  }
  const stream = { rng: res(run, "pgSeed") | 0 };
  const roll = nextRandom(stream);
  r.pgSeed = stream.rng;
  let cumulative = 0;
  for (let level = 0; level < G.odds.length; level += 1) {
    cumulative += G.odds[level];
    if (roll < cumulative) {
      r.pgLevel = level;
      return;
    }
  }
  r.pgLevel = G.odds.length - 1;
}

/** Starts the day clock the first time the grid is open. */
function begin(run: RunState): void {
  const r = run.resources;
  r.pgSeed = (res(run, "nightSeed") || run.rng) ^ SEED_MIX;
  r.pgClock = G.firstClock;
  r.pgDays = 0;
  r.pgStarted = 1;
  drawEvening(run);
}

/**
 * For the income probes: the same run, but an average evening instead of a
 * live clock, so a probe never reads a rush or a charge as income.
 */
export function withoutEvenings(run: RunState): RunState {
  run.resources.pgFrozen = 1;
  return run;
}

/**
 * Runs the grid for `dt` seconds and returns what the cities' pay is
 * multiplied by right now. `income` is the phase's income a second (read
 * lazily: only a lit night needs it).
 */
export function tickGrid(
  run: RunState,
  dt: number,
  income: () => number
): number {
  const r = run.resources;
  if (run.phase !== 1 || !isGridOpen(run)) return 1;
  if (res(run, "pgFrozen") > 0) return expectedEveningFactor(run);
  if (res(run, "pgStarted") <= 0) begin(run);
  r.pgBannerLeft = Math.max(0, res(run, "pgBannerLeft") - dt);
  const plants = supplyMW(run);
  const capacity = batteryCapacity(run);
  r.pgCharge = Math.min(capacity, res(run, "pgCharge"));

  const before = gridClock(run);
  let clock = before + dt;
  const isWrapping = clock >= G.daySeconds;
  if (isWrapping) clock -= G.daySeconds;
  r.pgClock = clock;
  if (isWrapping) {
    r.pgDays = res(run, "pgDays") + 1;
    drawEvening(run);
  }

  const rushEnd = G.rushAt + G.rushSeconds;
  const isRush = clock >= G.rushAt && clock < rushEnd;
  const wasRush = res(run, "pgRush") > 0;
  if (isRush && !wasRush) {
    r.pgRush = 1;
    r.pgDark = 0;
  }
  const darkShare = (): number => Math.min(1, res(run, "pgDark") / G.districts);

  if (isRush) {
    const need = plants * rushExcess(run);
    const usable = Math.max(
      0,
      res(run, "pgCharge") - G.reserveShare * capacity
    );
    const give = Math.min(need, rushCarry(run), dt > 0 ? usable / dt : 0);
    r.pgCharge = res(run, "pgCharge") - give * dt;
    const shed = need > 0 ? (need - give) / (plants + need) : 0;
    const target = Math.ceil(shed * G.districts - 1e-9);
    if (target > res(run, "pgDark")) r.pgDark = target;
    return (1 + (plants > 0 ? give / plants : 0)) * (1 - darkShare());
  }

  if (wasRush) {
    // The rush is over: a lit night pays, a dark one takes a while to mend,
    // and tonight's streetlights go back to what they were.
    r.pgRush = 0;
    returnLampsHome(run);
    if (res(run, "pgDark") <= 0) {
      const pay = litBonus(run, income());
      r.power = res(run, "power") + pay;
      r.knowhow = res(run, "knowhow") + G.litKnowhow;
      r.pgLits = litNights(run) + 1;
      r.pgLast = 1;
      r.pgBanner = 1;
      r.pgBannerLeft = G.bannerSeconds;
      r.pgLitPay = pay;
    } else {
      r.pgBlackouts = blackouts(run) + 1;
      r.pgLast = 2;
      r.pgBanner = 2;
      r.pgBannerLeft = G.bannerSeconds;
      r.pgDarkLeft = G.recoverySeconds;
      r.pgDarkFrom = res(run, "pgDark");
    }
  }

  if (res(run, "pgDarkLeft") > 0) {
    const left = Math.max(0, res(run, "pgDarkLeft") - dt);
    r.pgDarkLeft = left;
    r.pgDark = (res(run, "pgDarkFrom") * left) / G.recoverySeconds;
    if (left <= 0) r.pgDark = 0;
  }

  // Charging: spare power goes into the batteries until they are full. Hot
  // plants (overdrive) sell every megawatt, so nothing charges then.
  let charging = 0;
  if (plants > 0 && capacity > res(run, "pgCharge") && !isOverdriveOn(run)) {
    const stored = Math.min(
      capacity - res(run, "pgCharge"),
      plants * G.chargeShare * G.efficiency * dt
    );
    r.pgCharge = res(run, "pgCharge") + stored;
    charging = dt > 0 ? stored / G.efficiency / (plants * dt) : 0;
  }
  return (1 - charging) * (1 - darkShare());
}

/** Resets everything the grid keeps when the night begins. */
export function resetGrid(run: RunState): void {
  const r = run.resources;
  for (const id of [
    "pgStarted",
    "pgClock",
    "pgLevel",
    "pgSeed",
    "pgCharge",
    "pgDark",
    "pgDarkLeft",
    "pgDarkFrom",
    "pgRush",
    "pgDays",
    "pgLast",
    "pgLits",
    "pgBlackouts",
    "pgBanner",
    "pgBannerLeft",
    "pgLitPay",
    "pgFrozen",
  ])
    r[id] = 0;
}
