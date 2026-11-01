import { formatNumber } from "../../engine/format";
import type { RunState } from "../../engine/types";
import { TUNING } from "./tuning";

/**
 * The Tide Clock: a side machine on the coast. The sea rises and falls by
 * itself in one slow wave. The player may set the nets any time; at high
 * tide the nets fill, and hauling them in pays a catch of coins. Nets set
 * early (a full rising tide) catch more than nets set late. A full net waits
 * as long as it takes and never spoils, ignoring the clock costs nothing, and
 * the tide mill only ever adds to what hand-tending pays.
 *
 * The tide is a plain wave of the engine's `dt`, so it needs no random
 * numbers at all (and never touches the run's own stream). All state lives in
 * `run.resources` (hidden numbers) and one flag, so a save without them
 * simply reads as "not opened yet".
 */

const T = TUNING.tide;

export const TIDE_OPEN_FLAG = "tide-open";
export const BIGGER_NETS_ID = "nets-1";
export const TIDE_MILL_ID = "tide-mill";
/** The purchase that opens the clock: the fish market on the quay. */
export const TIDE_OPEN_UPGRADE = "dock-1";

export const SET_NETS_ACTION = "tide-set";
export const HAUL_ACTION = "tide-haul";
export const TIDE_ACTION_IDS: readonly string[] = [
  SET_NETS_ACTION,
  HAUL_ACTION,
];

export type NetState = "empty" | "set" | "full";
const NET_STATES: readonly NetState[] = ["empty", "set", "full"];

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const HALF = T.cycleSeconds / 2;

export const isTideOpen = (run: RunState): boolean =>
  run.phase === 0 && run.flags[TIDE_OPEN_FLAG] === true;

export const hasBiggerNets = (run: RunState): boolean =>
  owned(run, BIGGER_NETS_ID) > 0;

export const hasTideMill = (run: RunState): boolean =>
  owned(run, TIDE_MILL_ID) > 0;

/** Where we are in the wave, in seconds since the last low tide. */
const clockOf = (run: RunState): number => {
  const t = res(run, "tdTime");
  return ((t % T.cycleSeconds) + T.cycleSeconds) % T.cycleSeconds;
};

/** The water, 0 (lowest) to 1 (highest): a smooth wave, high at mid-cycle. */
export const tideLevel = (run: RunState): number =>
  0.5 - 0.5 * Math.cos((2 * Math.PI * clockOf(run)) / T.cycleSeconds);

/** True while the water is coming in (before the next high tide). */
export const isRising = (run: RunState): boolean => clockOf(run) < HALF;

/** Seconds until the next high tide (a full cycle right after one). */
export function secondsToHighTide(run: RunState): number {
  const t = clockOf(run);
  return t < HALF ? HALF - t : T.cycleSeconds + HALF - t;
}

export const netState = (run: RunState): NetState =>
  isTideOpen(run) ? (NET_STATES[res(run, "tdNets")] ?? "empty") : "empty";

/** The nets as a number for the scene: 0 empty, 1 set, 2 full. */
export const netStateIndex = (run: RunState): number =>
  NET_STATES.indexOf(netState(run));

/** How much of a full rising tide the nets were out for, 0..1. */
export const netEarliness = (run: RunState): number => res(run, "tdEarly");

/** The earliness nets set right now would get: 1 for a full rising tide. */
export const earlinessIfSetNow = (run: RunState): number =>
  clamp01(secondsToHighTide(run) / HALF);

/** Seconds of income a catch is worth, for nets out for `earliness`. */
export function catchSeconds(run: RunState, earliness: number): number {
  const base =
    T.catchMinSeconds +
    (T.catchMaxSeconds - T.catchMinSeconds) * clamp01(earliness);
  return base * (hasBiggerNets(run) ? T.biggerNetsFactor : 1);
}

/** What the nets would pay if hauled now (full nets) or if set right now. */
export const catchCoins = (run: RunState, income: number): number =>
  catchSeconds(run, netEarliness(run)) * income;

/** The best a set of nets can catch, for the shop's preview. */
export const bestCatchCoins = (run: RunState, income: number): number =>
  catchSeconds(run, 1) * income;

/** What the tide mill adds by itself at each high tide. */
export const millCoins = (income: number): number => T.millSeconds * income;

/** High tides that have come and gone since the clock opened. */
export const highTidesSoFar = (run: RunState): number => res(run, "tdHighs");

/** Nets hauled in so far. */
export const haulsSoFar = (run: RunState): number => res(run, "tdHauls");

export interface HaulResult {
  payout: number;
  earliness: number;
}

export function lastHaul(run: RunState): HaulResult {
  return {
    payout: res(run, "tdLastPayout"),
    earliness: res(run, "tdLastEarly"),
  };
}

/** The little result line under the gauge, or null before the first haul. */
export function haulResultLine(run: RunState): string | null {
  if (haulsSoFar(run) <= 0) return null;
  const { payout, earliness } = lastHaul(run);
  const coins = `+${formatNumber(Math.floor(payout))} coins`;
  if (earliness >= 0.85) return `Nets full! You set them early: ${coins}!`;
  if (earliness >= 0.4) return `A good catch: ${coins}.`;
  return `A catch of ${coins}! (Nets set early, well before high tide, catch even more.)`;
}

/** Puts the nets out. Nets already out (or full) are left alone. */
export function setNets(run: RunState): void {
  if (!isTideOpen(run) || netState(run) !== "empty") return;
  run.resources.tdNets = NET_STATES.indexOf("set");
  run.resources.tdEarly = earlinessIfSetNow(run);
}

/** Hauls full nets in: the catch flows in as a short surge of coins. */
export function haulIn(run: RunState, income: number): void {
  if (!isTideOpen(run) || netState(run) !== "full") return;
  const r = run.resources;
  const payout = catchCoins(run, income);
  r.tdLastPayout = payout;
  r.tdLastEarly = netEarliness(run);
  r.tdNets = NET_STATES.indexOf("empty");
  r.tdHauls = haulsSoFar(run) + 1;
  r.tdEarned = res(run, "tdEarned") + payout;
  addSurge(run, payout);
}

/** The catch flows in over a few seconds, not as one lump (see `flowSurge`). */
function addSurge(run: RunState, coins: number): void {
  const r = run.resources;
  r.tdPending = res(run, "tdPending") + coins;
  r.tdSurgeRate = r.tdPending / T.surgeSeconds;
}

/** Moves the catch that is still flowing in to the purse. */
function flowSurge(run: RunState, dt: number): void {
  const r = run.resources;
  const pending = res(run, "tdPending");
  if (pending <= 0) return;
  const flow = Math.min(pending, res(run, "tdSurgeRate") * dt);
  r.tdPending = pending - flow;
  r.coins = res(run, "coins") + flow;
}

/**
 * Opens the clock (the milestone's purchase calls this, so its story line
 * lands with the purchase; the tick is the fallback for old saves). The sea
 * starts at low tide, so the first rise is a whole one.
 */
export function openTide(run: RunState): void {
  if (run.flags[TIDE_OPEN_FLAG] === true) return;
  run.flags[TIDE_OPEN_FLAG] = true;
  run.resources.tdTime = 0;
}

/**
 * Runs the clock for `dt` seconds. `income` is the coast's income per second
 * (read lazily: only the mill needs it).
 */
export function tickTide(
  run: RunState,
  dt: number,
  income: () => number
): void {
  if (run.phase !== 0) {
    // A catch still flowing when the coast ends finishes paying out, so the
    // tally the player saw is what they got.
    flowSurge(run, dt);
    return;
  }
  if (!isTideOpen(run)) {
    if (owned(run, TIDE_OPEN_UPGRADE) > 0) openTide(run);
    return;
  }
  flowSurge(run, dt);
  const r = run.resources;
  if (r.tdPaused === 1) return;
  const before = res(run, "tdTime");
  const crossed =
    Math.floor((before + dt) / T.cycleSeconds + 0.5) -
    Math.floor(before / T.cycleSeconds + 0.5);
  r.tdTime = clockOfValue(before + dt);
  if (crossed <= 0) return;
  r.tdHighs = highTidesSoFar(run) + crossed;
  if (netState(run) === "set") r.tdNets = NET_STATES.indexOf("full");
  if (hasTideMill(run)) {
    const coins = millCoins(income()) * crossed;
    addSurge(run, coins);
    r.tdMilled = res(run, "tdMilled") + coins;
  }
}

const clockOfValue = (t: number): number =>
  ((t % T.cycleSeconds) + T.cycleSeconds) % T.cycleSeconds;

/**
 * For the simulator's income probes: the same run, but the clock stands
 * still and nothing is pending, so a catch is not read as income.
 */
export function withoutTide(run: RunState): RunState {
  run.resources.tdPending = 0;
  run.resources.tdPaused = 1;
  return run;
}
