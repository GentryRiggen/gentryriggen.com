import { formatNumber } from "../../engine/format";
import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { fairForkMult, isFairScared } from "./forks";
import { harvestDays } from "./market";
import { PHASE_FARM } from "./resources";
import { addSurge, flowSurge } from "./surge";
import { TUNING } from "./tuning";

/**
 * The prize pumpkin: one pumpkin, a bet that grows.
 *
 * On every harvest day the pumpkin can be fed or entered at the county fair,
 * not both. Feeding costs harvest (more each time) and makes it a step
 * bigger, which improves the chance of every ribbon, but a fed pumpkin may
 * SPLIT, and a split pumpkin is gone along with everything fed to it: the
 * chance is shown before every feeding and grows with the size. Enter it now
 * and the judges give it a ribbon (blue, red or a green garden ribbon, never
 * nothing); wait another day and it can grow, or split.
 *
 * Splits and ribbons come from a random stream of the pumpkin's own
 * (`run.rng` is never touched). State is hidden `run.resources` plus one
 * flag, so a save without it reads as "not opened yet".
 */

const P = TUNING.pumpkin;

export const PUMPKIN_OPEN_FLAG = "fair-open";
/** The purchase that opens the fair: the first tractor to haul pumpkins. */
export const PUMPKIN_OPEN_UPGRADE = "tractor";
export const PUMPKIN_HAND_ID = "fair-hand";
export const FEED_ACTION_ID = "pumpkin-feed";
export const ENTER_ACTION_ID = "pumpkin-enter";
export const PUMPKIN_ACTION_IDS: readonly string[] = [
  FEED_ACTION_ID,
  ENTER_ACTION_ID,
];

/** The ribbons, best first. Every entry wins one. */
export const RIBBONS = ["blue", "red", "green"] as const;
export type Ribbon = (typeof RIBBONS)[number];
export const RIBBON_LABELS: Readonly<Record<Ribbon, string>> = {
  blue: "Blue ribbon",
  red: "Red ribbon",
  green: "Garden ribbon",
};

/** Names for the sizes, seedling first. */
export const SIZE_NAMES: readonly string[] = [
  "A seedling",
  "A baby pumpkin",
  "A round one",
  "A big one",
  "A huge one",
  "A giant",
];

/** Mixed into the run's seed so the pumpkin has a stream of its own. */
const SEED_MIX = 0x9a3f;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

export const isPumpkinOpen = (run: RunState): boolean =>
  run.phase === 1 &&
  run.flags[PUMPKIN_OPEN_FLAG] === true &&
  !isFairScared(run);

export const hasPumpkinHand = (run: RunState): boolean =>
  owned(run, PUMPKIN_HAND_ID) > 0;

/** The pumpkin's size, 0 (a seedling) to `steps` (a giant). */
export const pumpkinStep = (run: RunState): number =>
  clamp(Math.round(res(run, "pkStep")), 0, P.steps);

export const isGiant = (run: RunState): boolean => pumpkinStep(run) >= P.steps;

/** True while the judges are walking the row. */
export const isJudging = (run: RunState): boolean => res(run, "pkStage") === 2;

/** True when today's feeding or entry is still unused (once per harvest day). */
export const isDayFree = (run: RunState): boolean =>
  isPumpkinOpen(run) &&
  !isJudging(run) &&
  harvestDays(run) > res(run, "pkUsed");

/** Harvest days entered or fed so far (the tally). */
export const entriesSoFar = (run: RunState): number => res(run, "pkEntries");
export const splitsSoFar = (run: RunState): number => res(run, "pkSplits");

/** What one second of the farm pays, with a few taps (set by the caller). */
export type FarmPay = number;

/** The chance it splits if fed now (0 for a giant: it cannot be fed). */
export const splitChanceNow = (run: RunState): number =>
  isGiant(run) ? 0 : P.splitChance[pumpkinStep(run)];

/** Harvest it costs to feed it now, in harvest. */
export const feedCost = (run: RunState, farmPay: FarmPay): number =>
  isGiant(run)
    ? 0
    : Math.ceil(P.feedSeconds[pumpkinStep(run)] * Math.max(1, farmPay));

/** The chances of each ribbon (blue, red, garden) for a size. They add up to 1. */
export function chancesAt(step: number): readonly number[] {
  const blue = P.blueChance[clamp(step, 0, P.steps)];
  const red = (1 - blue) * P.redShare;
  return [blue, red, 1 - blue - red];
}

/** The ribbon a draw `u` (0 to 1) gives, from the shown chances. */
export function ribbonFor(chances: readonly number[], u: number): number {
  let total = 0;
  for (let i = 0; i < chances.length - 1; i += 1) {
    total += chances[i];
    if (u < total) return i;
  }
  return chances.length - 1;
}

/** Seconds of farm pay a ribbon is worth for a pumpkin of this size. */
export const ribbonSeconds = (ribbon: number, step: number): number =>
  P.ribbonSeconds[clamp(Math.round(ribbon), 0, P.ribbonSeconds.length - 1)] *
  P.sizePay[clamp(Math.round(step), 0, P.steps)];

/** What entering a size pays on average, in seconds of farm pay. */
export const expectedSeconds = (step: number): number =>
  chancesAt(step).reduce(
    (sum, chance, ribbon) => sum + chance * ribbonSeconds(ribbon, step),
    0
  );

/** What a ribbon pays right now, given the farm's pace. */
export const ribbonPays = (
  ribbon: number,
  step: number,
  farmPay: FarmPay
): number => ribbonSeconds(ribbon, step) * Math.max(1, farmPay);

/** What the pumpkin helper's entry would pay on average. */
export const handPaysOn = (run: RunState, farmPay: FarmPay): number =>
  expectedSeconds(pumpkinStep(run)) * Math.max(1, farmPay) * P.handShare;

/** The pumpkin helper turns up after some harvest days (or the first glasshouse). */
export const handShown = (run: RunState): boolean =>
  run.flags[PUMPKIN_OPEN_FLAG] === true &&
  !isFairScared(run) &&
  (harvestDays(run) >= P.handAfterDays || owned(run, "glasshouse") > 0);

/** What happened to the pumpkin last. */
export type PumpkinOutcome = "none" | "blue" | "red" | "green" | "split";
const OUTCOMES: readonly PumpkinOutcome[] = [
  "none",
  "blue",
  "red",
  "green",
  "split",
];

export interface PumpkinResult {
  outcome: PumpkinOutcome;
  /** The size it was when it won a ribbon or split. */
  step: number;
  pays: number;
  byHand: boolean;
}

export const lastPumpkin = (run: RunState): PumpkinResult => ({
  outcome:
    OUTCOMES[clamp(Math.round(res(run, "pkOutcome")), 0, OUTCOMES.length - 1)],
  step: clamp(Math.round(res(run, "pkOutStep")), 0, P.steps),
  pays: res(run, "pkLastPays"),
  byHand: res(run, "pkBy") === 1,
});

/** True for a few seconds after a ribbon or a split (the scene shows it). */
export const isOutcomeShowing = (run: RunState): boolean =>
  res(run, "pkOutAt") > 0 && run.time - res(run, "pkOutAt") < P.showSeconds;

/** Ribbons and splits so far (changes whenever the scene should re-fire). */
export const pumpkinEvents = (run: RunState): number =>
  entriesSoFar(run) + splitsSoFar(run);

/** The little result line under the pumpkin, or null before it did anything. */
export function pumpkinResultLine(run: RunState): string | null {
  if (pumpkinEvents(run) <= 0) return null;
  const { outcome, step, pays, byHand } = lastPumpkin(run);
  const who = byHand ? "The helper entered the pumpkin. " : "";
  const harvest = `+${formatNumber(Math.floor(pays))} harvest`;
  if (outcome === "split")
    return `SPLAT! ${SIZE_NAMES[step]} split in the sun and everything fed to it is gone. A new seedling is up.`;
  if (outcome === "blue")
    return `${who}A blue ribbon! The judges loved ${SIZE_NAMES[step].toLowerCase()}: ${harvest}!`;
  if (outcome === "red")
    return `${who}A red ribbon, and a big cheer from the crowd: ${harvest}.`;
  return `${who}A green garden ribbon, and the judges said it smelled wonderful: ${harvest}.`;
}

/** Opens the fair (the first tractor calls this; the tick is the fallback). */
export function openPumpkin(run: RunState): void {
  if (run.flags[PUMPKIN_OPEN_FLAG] === true) return;
  run.flags[PUMPKIN_OPEN_FLAG] = true;
  run.resources.pkRng = (run.rng ^ SEED_MIX) | 0;
  run.resources.pkStep = 0;
  run.resources.pkStage = 0;
}

/** Feeds the pumpkin a step, unless it splits. */
function feed(run: RunState): void {
  const r = run.resources;
  const stream = { rng: res(run, "pkRng") | 0 };
  const roll = nextRandom(stream);
  r.pkRng = stream.rng;
  r.pkUsed = harvestDays(run);
  r.pkFed = res(run, "pkFed") + 1;
  if (roll < splitChanceNow(run)) {
    r.pkOutcome = OUTCOMES.indexOf("split");
    r.pkOutStep = pumpkinStep(run);
    r.pkOutAt = run.time;
    r.pkLastPays = 0;
    r.pkBy = 0;
    r.pkSplits = splitsSoFar(run) + 1;
    r.pkStep = 0;
    return;
  }
  r.pkStep = pumpkinStep(run) + 1;
}

/** Sends the pumpkin to the judges (a hand entry pays less). */
function enter(run: RunState, byHand: boolean, farmPay: FarmPay): void {
  const r = run.resources;
  r.pkUsed = harvestDays(run);
  r.pkBy = byHand ? 1 : 0;
  // The farm's pace now: the judges still pay by it after the farm ends.
  r.pkIncome = farmPay;
  r.pkEnterStep = pumpkinStep(run);
  r.pkStage = 2;
  r.pkJudge = P.judgeSeconds;
}

/** The judges decide: one draw from the odds the player was shown. */
function judge(run: RunState): void {
  const r = run.resources;
  const step = clamp(Math.round(res(run, "pkEnterStep")), 0, P.steps);
  const stream = { rng: res(run, "pkRng") | 0 };
  const ribbon = ribbonFor(chancesAt(step), nextRandom(stream));
  r.pkRng = stream.rng;
  const byHand = res(run, "pkBy") === 1;
  const pays =
    ribbonPays(ribbon, step, res(run, "pkIncome")) *
    (byHand ? P.handShare : 1) *
    fairForkMult(run);
  r.pkOutcome = ribbon + 1;
  r.pkOutStep = step;
  r.pkOutAt = run.time;
  r.pkLastPays = pays;
  r.pkEarned = res(run, "pkEarned") + pays;
  r.pkEntries = entriesSoFar(run) + 1;
  r.pkStage = 0;
  r.pkStep = 0;
  addSurge(run, "pk", pays, P.surgeSeconds);
}

/**
 * Runs the pumpkin for `dt` seconds. `farmPay` is the farm's pay per second
 * with a few taps (read lazily: only a feeding or an entry needs it). A
 * pumpkin already with the judges, and a payout still flowing, finish after
 * the farm ends. The pumpkin helper enters it a while into a day nobody used.
 */
export function tickPumpkin(
  run: RunState,
  dt: number,
  farmPay: () => FarmPay,
  daySeconds: number
): void {
  const r = run.resources;
  if (run.flags[PUMPKIN_OPEN_FLAG] !== true) {
    if (run.phase === 1 && owned(run, PUMPKIN_OPEN_UPGRADE) > 0)
      openPumpkin(run);
    return;
  }
  flowSurge(run, "pk", dt);
  if (r.pkPaused === 1) return;
  if (isJudging(run)) {
    r.pkJudge = res(run, "pkJudge") - dt;
    if (r.pkJudge <= 0) judge(run);
    return;
  }
  if (
    run.phase === 1 &&
    hasPumpkinHand(run) &&
    isDayFree(run) &&
    pumpkinStep(run) >= 1 &&
    daySeconds >= P.handDelay
  )
    enter(run, true, farmPay());
}

/** Enters the pumpkin by hand (the panel's button calls this). */
export function enterPumpkin(run: RunState, farmPay: FarmPay): void {
  if (!isDayFree(run)) return;
  enter(run, false, farmPay);
}

/** Feeds the pumpkin by hand (the panel's button calls this). */
export function feedPumpkin(run: RunState): void {
  if (!isDayFree(run) || isGiant(run)) return;
  feed(run);
}

/**
 * For the simulator's income probes: nothing is pending, so a ribbon's pay is
 * not read as income.
 */
export function withoutPumpkin(run: RunState): RunState {
  run.resources.pkPending = 0;
  run.resources.pkPaused = 1;
  return run;
}

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** The feed and enter buttons; the pumpkin panel draws them itself. */
export function pumpkinActions(
  farmPayOf: (run: RunState) => number
): readonly ActionDef[] {
  return [
    {
      id: FEED_ACTION_ID,
      phases: [PHASE_FARM],
      isInline: true,
      visibleWhen: isPumpkinOpen,
      describe: (run) => {
        const free = isDayFree(run);
        const giant = isGiant(run);
        const cost = feedCost(run, farmPayOf(run));
        const next = chancesAt(pumpkinStep(run) + 1);
        return {
          label: giant ? "It cannot grow any bigger" : "Feed the pumpkin",
          detail: giant
            ? "It is a giant."
            : `It grows a step. Chance it splits: ${pct(splitChanceNow(run))}. If it holds, blue ribbon chance ${pct(next[0])}.`,
          cost: giant ? undefined : { resource: "harvest", amount: cost },
          isBlocked: !free || giant,
        };
      },
      perform: (run) => feedPumpkin(run),
    },
    {
      id: ENTER_ACTION_ID,
      phases: [PHASE_FARM],
      isInline: true,
      visibleWhen: isPumpkinOpen,
      describe: (run) => {
        const free = isDayFree(run);
        const chances = chancesAt(pumpkinStep(run));
        return {
          label: "Enter it at the fair",
          detail: `Blue ${pct(chances[0])}, red ${pct(chances[1])}, garden ${pct(chances[2])}. About +${formatNumber(
            Math.floor(
              expectedSeconds(pumpkinStep(run)) * Math.max(1, farmPayOf(run))
            )
          )} harvest.`,
          isBlocked: !free,
        };
      },
      perform: (run) => enterPumpkin(run, farmPayOf(run)),
    },
  ];
}
