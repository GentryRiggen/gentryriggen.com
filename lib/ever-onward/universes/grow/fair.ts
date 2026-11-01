import { formatNumber } from "../../engine/format";
import { nextRandom } from "../../engine/rng";
import type { RunState } from "../../engine/types";
import { MANUAL_RESOURCES } from "./resources";
import { TUNING } from "./tuning";

/**
 * The county fair: a side machine on the farm. Every couple of minutes three
 * pumpkins stand ready to enter. Each shows its size and its shine, and the
 * chance of every ribbon it would win, in plain percentages, before you
 * choose. Entering costs nothing and every pumpkin comes home with a ribbon
 * (blue, red or a green garden ribbon) that pays something, so there is
 * nothing to lose: a better pumpkin simply has better chances of the bigger
 * ribbons. A fair waits as long as it takes and the next one only starts
 * after it has been judged. The fair helper enters the likeliest pumpkin for
 * you when a fair has waited a while, at a lower payout, so it only ever adds
 * to hand play.
 *
 * The fairs come from a random stream of their own (`run.rng` is never
 * touched). All state lives in hidden `run.resources` and one flag, so a save
 * without them simply reads as "not opened yet".
 */

const F = TUNING.fair;

export const FAIR_OPEN_FLAG = "fair-open";
/** The purchase that opens the fair: the first tractor to haul pumpkins. */
export const FAIR_OPEN_UPGRADE = "tractor";
export const FAIR_HAND_ID = "fair-hand";

/** How many pumpkins stand ready. */
export const PUMPKIN_COUNT = 3;

export const enterActionId = (pick: number): string => `fair-enter-${pick}`;
export const FAIR_ACTION_IDS: readonly string[] = Array.from(
  { length: PUMPKIN_COUNT },
  (_, i) => enterActionId(i)
);

/** The ribbons, best first. Every entry wins one. */
export const RIBBONS = ["blue", "red", "green"] as const;
export type Ribbon = (typeof RIBBONS)[number];
export const RIBBON_LABELS: Readonly<Record<Ribbon, string>> = {
  blue: "Blue ribbon",
  red: "Red ribbon",
  green: "Garden ribbon",
};

/** Mixed into the run's seed so the fairs have a stream of their own. */
const SEED_MIX = 0xfa17;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

export type FairStage = "waiting" | "open" | "judging";

export const isFairOpen = (run: RunState): boolean =>
  run.phase === 1 && run.flags[FAIR_OPEN_FLAG] === true;

export const hasFairHand = (run: RunState): boolean =>
  owned(run, FAIR_HAND_ID) > 0;

export function fairStage(run: RunState): FairStage {
  const s = res(run, "frStage");
  return s === 1 ? "open" : s === 2 ? "judging" : "waiting";
}

/** True while a fair has pumpkins waiting for the player. */
export const isFairOn = (run: RunState): boolean =>
  isFairOpen(run) && fairStage(run) === "open";

/** Fairs judged so far. */
export const fairsSoFar = (run: RunState): number => res(run, "frFairs");

const waitTotal = (run: RunState): number =>
  res(run, "frShown") === 0 ? F.firstWaitSeconds : F.waitSeconds;

/** Seconds until the next fair (while waiting). */
export const secondsToFair = (run: RunState): number =>
  fairStage(run) === "waiting"
    ? Math.max(0, waitTotal(run) - res(run, "frTime"))
    : 0;

export interface Pumpkin {
  /** 0 (a small one) to 1 (a giant). */
  size: number;
  /** 0 (dull) to 1 (gleaming). */
  shine: number;
}

/** The pumpkins standing ready (or just judged). */
export const pumpkinsOnOffer = (run: RunState): readonly Pumpkin[] =>
  Array.from({ length: PUMPKIN_COUNT }, (_, i) => ({
    size: res(run, `frSize${i}`),
    shine: res(run, `frShine${i}`),
  }));

/** How good a pumpkin is, 0 to 1. */
export const quality = (p: Pumpkin): number =>
  F.sizeWeight * p.size + (1 - F.sizeWeight) * p.shine;

/**
 * The chance of each ribbon (blue, red, garden) for entering `pick`. They
 * add up to 1. These are the real odds the judges draw from.
 */
export function placeChances(run: RunState, pick: number): readonly number[] {
  const p = pumpkinsOnOffer(run)[pick];
  const q = p ? quality(p) : 0;
  const blue = Math.min(0.95, F.blueBase + F.blueSlope * q);
  const red = (1 - blue) * F.redShare;
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

/** Seconds of farm income each ribbon pays. */
export const ribbonSeconds = (ribbon: number): number =>
  F.placeSeconds[Math.min(F.placeSeconds.length - 1, Math.max(0, ribbon))];

/** What entering `pick` pays on average, in seconds of income. */
export const expectedSeconds = (run: RunState, pick: number): number =>
  placeChances(run, pick).reduce(
    (sum, chance, ribbon) => sum + chance * ribbonSeconds(ribbon),
    0
  );

/** The pumpkin with the best expected payout (the likeliest to do well). */
export function likeliestPumpkin(run: RunState): number {
  let best = 0;
  for (let i = 1; i < PUMPKIN_COUNT; i += 1)
    if (expectedSeconds(run, i) > expectedSeconds(run, best)) best = i;
  return best;
}

/** What a ribbon pays right now, given the farm's pace. */
export const ribbonPays = (ribbon: number, income: number): number =>
  ribbonSeconds(ribbon) * Math.max(1, income);

/** What the fair helper's entry would pay on average. */
export const handPaysOn = (run: RunState, income: number): number =>
  expectedSeconds(run, likeliestPumpkin(run)) *
  Math.max(1, income) *
  F.handShare;

/** The fair helper turns up once the first fair has been judged. */
export const handShown = (run: RunState): boolean =>
  run.flags[FAIR_OPEN_FLAG] === true && fairsSoFar(run) >= F.handAfterFairs;

export interface EntryResult {
  pick: number;
  ribbon: number;
  payout: number;
  byHand: boolean;
}

export const lastEntry = (run: RunState): EntryResult => ({
  pick: res(run, "frPicked"),
  ribbon: res(run, "frPlace"),
  payout: res(run, "frLastPays"),
  byHand: res(run, "frBy") === 1,
});

/** The little result line under the pumpkins, or null before the first fair. */
export function fairResultLine(run: RunState): string | null {
  if (fairsSoFar(run) <= 0) return null;
  const { ribbon, payout, byHand } = lastEntry(run);
  const harvest = `+${formatNumber(Math.floor(payout))} harvest`;
  const who = byHand ? "The fair helper entered a pumpkin. " : "";
  const tail = byHand ? " (Enter one yourself for even more.)" : "";
  if (ribbon === 0)
    return `${who}A blue ribbon! The judges loved that pumpkin: ${harvest}!${tail}`;
  if (ribbon === 1)
    return `${who}A red ribbon, and a big cheer from the crowd: ${harvest}.${tail}`;
  return `${who}A green garden ribbon, and the judges said it smelled wonderful: ${harvest}.${tail}`;
}

/** The payout flows in over a few seconds, not as one lump. */
function addSurge(run: RunState, harvest: number): void {
  const r = run.resources;
  r.frPending = res(run, "frPending") + harvest;
  r.frSurgeRate = r.frPending / F.surgeSeconds;
}

/**
 * Moves the payout that is still flowing into the harvest. Once the farm has
 * ended, whatever is left is settled at the farm-gate rate into the new
 * phase's own currency (as leftover seeds are when the farm opens).
 */
function flowSurge(run: RunState, dt: number): void {
  const r = run.resources;
  const pending = res(run, "frPending");
  if (pending <= 0) return;
  if (run.phase !== 1) {
    const id = MANUAL_RESOURCES[run.phase];
    r[id] = res(run, id) + pending * TUNING.farm.seedsToHarvest;
    r.frPending = 0;
    return;
  }
  const flow = Math.min(pending, res(run, "frSurgeRate") * dt);
  r.frPending = pending - flow;
  r.harvest = res(run, "harvest") + flow;
}

/** Sends a pumpkin to the judges. A hand entry pays in full. */
function enter(run: RunState, pick: number, byHand: boolean): void {
  if (!isFairOn(run) || pick < 0 || pick >= PUMPKIN_COUNT) return;
  const r = run.resources;
  r.frPicked = pick;
  r.frBy = byHand ? 1 : 0;
  r.frStage = 2;
  r.frJudge = F.judgeSeconds;
  r.frTime = 0;
}

/** Enters a pumpkin by hand (the panel's buttons call this). */
export const enterPumpkin = (run: RunState, pick: number): void =>
  enter(run, pick, false);

/** Three new pumpkins come to the fair, from the fair's own stream. */
function setOut(run: RunState): void {
  const r = run.resources;
  const stream = { rng: res(run, "frRng") | 0 };
  const roll = () => Math.round((0.1 + 0.85 * nextRandom(stream)) * 100) / 100;
  for (let i = 0; i < PUMPKIN_COUNT; i += 1) {
    r[`frSize${i}`] = roll();
    r[`frShine${i}`] = roll();
  }
  r.frRng = stream.rng;
  r.frStage = 1;
  r.frTime = 0;
  r.frShown = res(run, "frShown") + 1;
}

/** The judges decide: one draw from the odds the player was shown. */
function judge(run: RunState, income: number): void {
  const r = run.resources;
  const pick = res(run, "frPicked");
  const stream = { rng: res(run, "frRng") | 0 };
  const ribbon = ribbonFor(placeChances(run, pick), nextRandom(stream));
  r.frRng = stream.rng;
  const byHand = res(run, "frBy") === 1;
  const pays = ribbonPays(ribbon, income) * (byHand ? F.handShare : 1);
  r.frPlace = ribbon;
  r.frLastPays = pays;
  r.frEarned = res(run, "frEarned") + pays;
  r.frFairs = fairsSoFar(run) + 1;
  r.frStage = 0;
  r.frTime = 0;
  addSurge(run, pays);
}

/**
 * Opens the fair (the first tractor calls this; the tick is the fallback for
 * old saves). The first fair comes after a short wait.
 */
export function openFair(run: RunState): void {
  if (run.flags[FAIR_OPEN_FLAG] === true) return;
  run.flags[FAIR_OPEN_FLAG] = true;
  run.resources.frRng = (run.rng ^ SEED_MIX) | 0;
  run.resources.frStage = 0;
  run.resources.frTime = 0;
}

/**
 * Runs the fair for `dt` seconds. `income` is the farm's harvest per second
 * (read lazily: only a judging needs it). A pumpkin already with the judges,
 * and a payout still flowing, finish after the farm ends.
 */
export function tickFair(
  run: RunState,
  dt: number,
  income: () => number
): void {
  const r = run.resources;
  if (run.flags[FAIR_OPEN_FLAG] !== true) {
    if (run.phase === 1 && owned(run, FAIR_OPEN_UPGRADE) > 0) openFair(run);
    return;
  }
  flowSurge(run, dt);
  if (r.frPaused === 1) return;
  if (fairStage(run) === "judging") {
    r.frJudge = res(run, "frJudge") - dt;
    if (r.frJudge <= 0) {
      judge(run, income());
      if (run.phase !== 1) flowSurge(run, 0);
    }
    return;
  }
  if (run.phase !== 1) return;
  r.frTime = res(run, "frTime") + dt;
  if (fairStage(run) === "waiting") {
    if (r.frTime >= waitTotal(run)) setOut(run);
    return;
  }
  if (hasFairHand(run) && r.frTime >= F.handDelay)
    enter(run, likeliestPumpkin(run), true);
}

/**
 * For the simulator's income probes: nothing is pending, so a fair payout is
 * not read as income.
 */
export function withoutFair(run: RunState): RunState {
  run.resources.frPending = 0;
  run.resources.frPaused = 1;
  return run;
}
