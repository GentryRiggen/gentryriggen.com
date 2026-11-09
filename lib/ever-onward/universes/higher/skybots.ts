import { upgradeCost } from "../../engine/engine";
import type { Strategy } from "../../engine/sim";
import type { RunState } from "../../engine/types";
import {
  NC_START_ACTION_ID,
  STRAINS,
  TIE_ACTION_ID,
  canStartNoCrane,
  ncBonusMult,
  dropInGust,
  forecastOf,
  gustFloor,
  gustPower,
  gustInExact,
  isBlowing,
  isCloudy,
  isNoCrane,
  isSkyOpen,
  riskCalm,
  sinceGust,
  skyPayAt,
  snapInGust,
  snapPerCalmSecond,
  strainActionId,
  strainStep,
  tieState,
} from "./sky";
import { tendingValue } from "./tick";
import { TUNING } from "./tuning";
import { UPGRADES } from "./upgrades";

type Actions = NonNullable<Strategy["actions"]>;

const K = TUNING.sky;

/**
 * How a bot plays the Sky's dials. `strain` is a fixed step or "reads". `tie`
 * is never, at the sure gust, at the first clouds, or "reads" (when the
 * forecast says it pays). `crane` is the no-crane climb: never, whenever it
 * can, or "reads" (a calm sky and a prize worth the slow minute).
 */
export interface SkyStyle {
  strain: number | "reads";
  tie: "never" | "gust" | "clouds" | "reads";
  crane: "never" | "always" | "reads";
}

const isWindowStart = (run: RunState, seconds: number): boolean =>
  run.time % seconds < 0.5;

const STEPS = STRAINS.map((_, i) => i);

/** What a strain pays, ignoring the tie and the fetching (the bot's yardstick). */
const pay = (run: RunState, s: number): number => skyPayAt(run, s);

/** The strain this sky is worth most at: pay, less the snaps it risks (clouds make a tight cable snap more). */
export function calmStrain(run: RunState): number {
  const calm = riskCalm(run);
  const value = (s: number): number =>
    pay(run, s) *
    (1 -
      snapPerCalmSecond(s, calm, isCloudy(run)) *
        (K.hookSeconds + K.restringSeconds));
  return STEPS.reduce(
    (best, s) => (value(s) > value(best) + 1e-9 ? s : best),
    0
  );
}

/** What riding a gust out at strain `s` loses, in seconds of the calm pay. */
function rideCost(
  run: RunState,
  s: number,
  base: number,
  power: number
): number {
  const calm = riskCalm(run);
  const snap = snapInGust(s, calm, power);
  const drop = dropInGust(s, calm, power, gustFloor(run));
  const unit = pay(run, base);
  const load = pay(run, s) * K.hookSeconds;
  const lost =
    snap * (load + K.restringSeconds * unit) +
    (1 - snap) * drop * (load + K.stallSeconds * unit);
  // Easing the cable down and back up gives up some pay.
  const ramp = Math.abs(base - s) * K.settleSeconds + K.gustSeconds;
  return (lost + Math.max(0, unit - pay(run, s)) * ramp) / Math.max(1e-9, unit);
}

/** What tying down through a gust loses, in seconds of the calm pay. */
const tieCost = (): number => K.tieSeconds + K.gustSeconds + K.untieSeconds;

/** A change of cable or a tie-down must save this many seconds of pay to be worth the clicks. */
const WORTH_A_CLICK = 10;

/** The best way through a sure gust: tie, or ride it at some strain. */
export function gustPlan(run: RunState): { tie: boolean; strain: number } {
  const base = calmStrain(run);
  const power = gustPower(run);
  let best = {
    tie: false,
    strain: base,
    cost: rideCost(run, base, base, power),
  };
  const tie = tieCost() + WORTH_A_CLICK;
  if (tie < best.cost - 1e-9) best = { tie: true, strain: base, cost: tie };
  for (const s of STEPS) {
    const cost = rideCost(run, s, base, power) + WORTH_A_CLICK;
    if (cost < best.cost - 1e-9) best = { tie: false, strain: s, cost };
  }
  return { tie: best.tie, strain: best.strain };
}

/**
 * The climb from a calm sky `since` seconds after the last gust: the chance
 * it gets through, and the seconds it lasts on average (a gust ends it).
 */
export function climbOdds(
  seconds: number,
  since: number
): { odds: number; seconds: number } {
  const steps = Math.ceil(seconds / K.stepSeconds);
  let calm = 1;
  let clouds = 0;
  let spent = 0;
  for (let i = 0; i < steps; i += 1) {
    spent +=
      (calm + clouds) * Math.min(K.stepSeconds, seconds - i * K.stepSeconds);
    const chance =
      since + i * K.stepSeconds < K.spellSeconds
        ? K.cloudChance * K.spellMult
        : K.cloudChance;
    const toClouds = calm * chance;
    calm = calm * (1 - chance) + clouds * (1 - K.gustChance);
    clouds = toClouds;
  }
  return { odds: calm + clouds, seconds: spent };
}

/** Seconds the Sky should take at today's pay (a bot's guess), never idle. */
export function skySecondsLeft(run: RunState): number {
  const end = UPGRADES.find((u) => u.id === "space-elevator");
  if (!end) return 600;
  const steady = {
    ...run,
    resources: {
      ...run.resources,
      skTie: 0,
      skStallUntil: 0,
      skRestringUntil: 0,
      skNc: 0,
    },
  };
  const need = upgradeCost(run, end) - (run.resources.beams ?? 0);
  return Math.max(30, need / Math.max(1, tendingValue(steady)));
}

/** A bot only tries the climb when it is expected to pay back this many times over. */
const CLIMB_BAR = 1.3;

/** True when the no-crane climb is worth its slow minute, by the forecast. */
function craneIsWorthIt(run: RunState): boolean {
  if (forecastOf(run) !== 0) return false;
  // The sky is clear for a while after a gust: the one time a climb has good odds.
  if (sinceGust(run) >= K.spellSeconds) return false;
  const unit = pay(run, calmStrain(run));
  const { odds, seconds } = climbOdds(K.ncSeconds, sinceGust(run));
  const cost = (seconds * (1 - K.ncPay) + (1 - odds) * K.ncFailSeconds) * unit;
  const left = skySecondsLeft(run);
  // The next badge adds `ncBonus` of what the tower paid before any badge.
  const gain =
    ((K.ncBonus * unit) / ncBonusMult(run)) * Math.max(0, left - K.ncSeconds);
  return odds * gain > CLIMB_BAR * cost;
}

/** Plays the sky's strain, tie-down and no-crane climb by a style. */
export const playsSky =
  (style: SkyStyle, window = 1): Actions =>
  (run, available) => {
    if (!isSkyOpen(run) || !isWindowStart(run, window)) return [];
    const out: string[] = [];
    const wx = forecastOf(run);
    const blowing = isBlowing(run);
    const tie = tieState(run);
    const climbing = isNoCrane(run);

    // The no-crane climb.
    if (style.crane === "always" && canStartNoCrane(run))
      out.push(NC_START_ACTION_ID);
    if (style.crane === "reads") {
      if (!climbing && canStartNoCrane(run) && craneIsWorthIt(run))
        out.push(NC_START_ACTION_ID);
    }

    // The tie-down: ready just in time for a sure gust, or at the first clouds.
    const seconds = gustInExact(run);
    const plan = wx === 2 ? gustPlan(run) : null;
    const tieNow =
      style.tie === "clouds"
        ? wx >= 1
        : style.tie === "gust"
          ? wx === 2 && seconds <= K.tieSeconds + window
          : style.tie === "reads"
            ? plan?.tie === true && seconds <= K.tieSeconds + window
            : false;
    if (tie === "free" && tieNow && !blowing && !climbing)
      out.push(TIE_ACTION_ID);
    else if (
      tie === "tied" &&
      !blowing &&
      (style.tie === "clouds" ? wx === 0 : wx !== 2)
    )
      out.push(TIE_ACTION_ID);

    // The strain (a tying or tied tower waits).
    if (tie !== "free" || blowing) return out;
    const want =
      typeof style.strain === "number"
        ? style.strain
        : wx === 2
          ? plan?.tie
            ? calmStrain(run)
            : (plan?.strain ?? 0)
          : calmStrain(run);
    const id = strainActionId(want);
    if (strainStep(run) !== want && available.includes(id)) out.push(id);
    return out;
  };
