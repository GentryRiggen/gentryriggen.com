import type { Strategy } from "../../engine/sim";
import type { RunState } from "../../engine/types";
import { FULL_DESCENT } from "./resources";
import { res } from "./lines";
import {
  PACK_SIZE,
  keepActionId,
  leaveActionId,
  isPackDue,
  keepsakeShare,
  keepsakeState,
  loadEase,
  loadOf,
  onTheStairs,
  walkMult,
  warmthOf,
  weightOf,
} from "./keepsakes";
import { tendingValue } from "./tick";
import { TUNING } from "./tuning";

type Actions = NonNullable<Strategy["actions"]>;

const K = TUNING.top.keepsakes;

/**
 * How a bot packs for the way down: nothing, everything that fits (the
 * order they come), the warmest pack whatever it costs, only what is near
 * the bottom (little carrying), or "reads" it (a warm ending is worth some
 * seconds, and each keepsake costs the seconds it slows the steps).
 */
export type PackStyle = "none" | "all" | "warmest" | "late" | "reads";

/** What one point of a warm ending is worth to a bot, in seconds. */
const WARMTH_SECONDS = 60;

/**
 * The way down speeds up (quiet piles on quiet), so the seconds a slow pack
 * really costs are about this share of the straight-line guess.
 */
const SPEED_UP = 0.25;

/** Seconds left on the way down at today's pace (a bot's guess, never growing). */
export function secondsToGround(run: RunState): number {
  const perQuiet = TUNING.top.descentPerQuiet;
  const rate =
    tendingValue(run) *
    perQuiet *
    (1 + TUNING.top.lanternBoost * (run.owned["block-lantern"] ?? 0)) *
    walkMult(run);
  return Math.max(
    10,
    (FULL_DESCENT - res(run, "descent")) / Math.max(1e-9, rate)
  );
}

/** The indexes still on the stairs, ahead of the robot, in order. */
const ahead = (run: RunState): number[] =>
  onTheStairs(run).filter((i) =>
    ["open", "marked"].includes(keepsakeState(run, i))
  );

/** Every subset of what is ahead that fits in what is left of the pack. */
function* packs(items: readonly number[], room: number): Generator<number[]> {
  const n = items.length;
  for (let mask = 0; mask < 1 << n; mask += 1) {
    const pick = items.filter((_, k) => mask & (1 << k));
    if (pick.reduce((sum, i) => sum + weightOf(i), 0) <= room) yield pick;
  }
}

/** The set a style wants to bring from here. */
export function wanted(run: RunState, style: PackStyle): number[] {
  if (style === "none") return [];
  const room = PACK_SIZE - loadOf(run);
  const items = ahead(run);
  if (style === "all") {
    const out: number[] = [];
    let weight = 0;
    for (const i of items)
      if (weight + weightOf(i) <= room) {
        out.push(i);
        weight += weightOf(i);
      }
    return out;
  }
  if (style === "late") {
    // The last few on the way down, whatever they are.
    const out: number[] = [];
    let weight = 0;
    for (const i of [...items].reverse())
      if (weight + weightOf(i) <= room) {
        out.unshift(i);
        weight += weightOf(i);
      }
    return out;
  }
  const here = res(run, "descent") / FULL_DESCENT;
  const total = secondsToGround(run);
  const cost = (i: number): number =>
    style === "warmest"
      ? 0
      : SPEED_UP *
        weightOf(i) *
        K.slowPerWeight *
        loadEase(run) *
        ((total * (1 - keepsakeShare(i))) / Math.max(0.05, 1 - here));
  let best: number[] = [];
  let bestValue = 0;
  for (const pick of packs(items, room)) {
    const value = pick.reduce(
      (sum, i) => sum + warmthOf(run, i) * WARMTH_SECONDS - cost(i),
      0
    );
    if (value > bestValue + 1e-9) {
      best = pick;
      bestValue = value;
    }
  }
  return best;
}

/** Marks what the style wants, and unmarks what it no longer does. */
export const packsFor =
  (style: PackStyle, window = 5): Actions =>
  (run, available) => {
    if (run.phase !== 3 || run.time % window >= 0.5) return [];
    // A player thinks about the next keepsake once the last one is behind, not all at once.
    const next = ahead(run)[0];
    if (next === undefined) return [];
    const state = keepsakeState(run, next);
    if (state === "open" && !isPackDue(run)) return [];
    const want = wanted(run, style).includes(next);
    const bring = keepActionId(next);
    const leave = leaveActionId(next);
    if (want)
      return state === "open" && available.includes(bring) ? [bring] : [];
    if (state === "marked" && available.includes(bring)) return [bring];
    return available.includes(leave) ? [leave] : [];
  };
