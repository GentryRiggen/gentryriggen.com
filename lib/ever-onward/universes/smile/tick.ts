import { visitorHereFlag } from "../../engine/engine";
import type { RunState } from "../../engine/types";
import { forkHelperMult, forkTapMult } from "./forks";
import { phaseBoost, tickKnowhow } from "./knowhow";
import { heatByTap, tickMeter, tiredMult } from "./meter";
import { addPatience, isQuietOpen, tickQuiet } from "./quiet";
import { MANUAL_RESOURCES } from "./resources";
import { tickTown } from "./town";
import { TUNING } from "./tuning";
import { bondGain, tickTogether, togetherPay } from "./together";
import { RETURN_VISITOR_ID } from "./visitors";

/** The three helper lines of each phase, by phase index. */
export const HELPER_IDS: readonly (readonly string[])[] = [
  ["balloon", "puppy", "lemonade", "magic-hat"],
  ["clown", "band", "smile-factory", "fireworks"],
  ["poster", "loudspeaker", "cheer-tower", "cheer-blimp"],
  ["tea", "blanket", "rain", "candle"],
];
/** The scaling upgrade of each phase. */
export const SCALE_IDS = [
  "joke-book",
  "bunting",
  "bigger-brush",
  "long-silence",
];

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const speed = (run: RunState): number => run.mods.speed ?? 1;
const tapMult = (run: RunState): number => run.mods.tapMult ?? 1;

/**
 * What a line of helpers makes at `level`: every level multiplies the line by
 * `TUNING.stackGrowth`, so each purchase is a visible jump, not one more
 * identical helper. Level 0 is nothing.
 */
export const stacked = (level: number): number =>
  level <= 0 ? 0 : TUNING.stackGrowth ** level;

/** Scaling upgrades multiply too: each level makes taps and helpers pay more. */
const scaleMult = (run: RunState): number =>
  (1 + TUNING.phases[run.phase].scalePer) ** owned(run, SCALE_IDS[run.phase]);

/** The world's sign: no bad days, and every grin pays more (1 otherwise). */
export const NO_BAD_DAYS = "no-bad-days";
export const NO_BAD_DAYS_MULT = 1.6;
const signMult = (run: RunState): number =>
  run.phase === 2 && owned(run, NO_BAD_DAYS) > 0 ? NO_BAD_DAYS_MULT : 1;

/**
 * In the town and the world a tap reaches every helper at once, so it pays
 * more the more of them there are (a quarter more for every level owned).
 */
export const TAP_REACH = 0.25;
export function tapReach(run: RunState): number {
  if (run.phase !== 1 && run.phase !== 2) return 1;
  const levels = HELPER_IDS[run.phase].reduce(
    (sum, id) => sum + owned(run, id),
    0
  );
  return 1 + TAP_REACH * levels;
}

/** What the phase's helpers make a second, before any bonus. */
function helperSum(run: RunState): number {
  const lines = TUNING.phases[run.phase].lines;
  return HELPER_IDS[run.phase].reduce(
    (sum, id, i) => sum + stacked(owned(run, id)) * lines[i],
    0
  );
}

/** Taps and income of the first part before what you do together pays. */
function friendGrossTap(run: RunState): number {
  return (
    TUNING.phases[0].tap *
    scaleMult(run) *
    tapMult(run) *
    forkTapMult(run) *
    (1 + bondGain(run))
  );
}

function friendGrossIncome(run: RunState): number {
  return (
    helperSum(run) *
    scaleMult(run) *
    forkHelperMult(run) *
    speed(run) *
    (1 + bondGain(run))
  );
}

/** What one tap earns right now. */
export function manualPerTap(run: RunState): number {
  // Taps stay the same whatever you do together: only the helpers and the
  // bond follow it, so a tap always works.
  if (run.phase === 0) return friendGrossTap(run);
  const base = TUNING.phases[run.phase].tap * scaleMult(run) * tapMult(run);
  if (run.phase === 3) return base;
  return (
    base *
    tapReach(run) *
    forkTapMult(run) *
    phaseBoost(run) *
    tiredMult(run) *
    signMult(run)
  );
}

/** The phase's manual resource per second from helpers alone. */
export function incomePerSecond(run: RunState): number {
  if (run.phase === 0) return friendGrossIncome(run) * togetherPay(run);
  const base =
    helperSum(run) * scaleMult(run) * forkHelperMult(run) * speed(run);
  if (run.phase === 3) return base;
  return base * phaseBoost(run) * tiredMult(run) * signMult(run);
}

/** What a second of tending is worth: the helpers plus one tap. */
export const tendingValue = (run: RunState): number =>
  incomePerSecond(run) + manualPerTap(run);

/** Earned patience also builds trust, which is all the last part asks for. */
function earn(run: RunState, amount: number): void {
  if (run.phase === 3) {
    addPatience(run, amount);
    return;
  }
  run.resources[MANUAL_RESOURCES[run.phase]] += amount;
}

export function tickSmile(run: RunState, dt: number): void {
  earn(run, incomePerSecond(run) * dt);
  tickTogether(run, dt, () => friendGrossIncome(run) + friendGrossTap(run));
  tickKnowhow(run, dt);
  tickTown(run, dt);
  tickMeter(run, dt);
  if (isQuietOpen(run)) tickQuiet(run, dt, () => tendingValue(run));
}

export function manualSmile(run: RunState): void {
  earn(run, manualPerTap(run));
  heatByTap(run);
}

export const isSmileComplete = (run: RunState): boolean =>
  run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true;
