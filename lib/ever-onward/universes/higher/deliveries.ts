import { formatNumber } from "../../engine/format";
import type { ActionDef, RunState } from "../../engine/types";
import { stepDown } from "./descent";
import { addToFooting, footingStock, gainFor, isFootingOpen } from "./footing";
import { loadForkMult } from "./forks";
import { referenceIncome } from "./income";
import { KNOWHOW, dockMult } from "./knowhow";
import { HELPER_LINES, owned, res } from "./lines";
import { MANUAL_RESOURCES } from "./resources";
import { relieveSway, swayOf } from "./sway";
import { TUNING } from "./tuning";

/**
 * Deliveries: every minute or so a load arrives at the site and waits to be
 * placed, for as long as it takes. Three loads are on offer and each says
 * exactly what it gives: stuff to spend now, a pole that steadies the tower,
 * or something that lasts (a footing stone, a set of plans). Which one is
 * best depends on how the tower is doing, and the card says which. Nothing is
 * random, and a load that is not placed is never lost.
 *
 * State is hidden resources (`dlStage`, `dlTime`, `dlCount`), so a save from
 * before deliveries existed reads as "none yet".
 */

const D = TUNING.deliveries;

export const LOAD_COUNT = 3;

export const loadActionId = (option: number): string => `load-${option}`;
export const LOAD_ACTION_IDS: readonly string[] = Array.from(
  { length: LOAD_COUNT },
  (_, i) => loadActionId(i)
);

export interface LoadDef {
  name: string;
  /** What it does, in plain words. */
  note: string;
}

/** The three loads of each part, by phase index. */
export const LOADS: readonly (readonly [LoadDef, LoadDef, LoadDef])[] = [
  [
    { name: "A box of blocks", note: "Blocks to spend right now." },
    {
      name: "A steadying pillow",
      note: "Straightens the tower and brings a few blocks.",
    },
    {
      name: "A wide base block",
      note: "Goes into the base: every payout grows.",
    },
  ],
  [
    { name: "A pallet of bricks", note: "Bricks to spend right now." },
    {
      name: "A steadying pole",
      note: "Straightens the tower and brings a few bricks.",
    },
    {
      name: "A roll of plans",
      note: "Know-how for projects and overtime.",
    },
  ],
  [
    { name: "A bundle of beams", note: "Beams to spend right now." },
    {
      name: "A steadying cable",
      note: "Straightens the tower and brings a few beams.",
    },
    {
      name: "An anchor bolt",
      note: "Goes into the anchors: every payout grows.",
    },
  ],
  [
    { name: "A few more steps", note: "Quiet to spend right now." },
    {
      name: "Watch the birds",
      note: "Pays more for every songbird you keep.",
    },
    { name: "Hum a tune", note: "Pays more for every hum you have." },
  ],
];

/** Deliveries open once the first helper line has begun. */
export const isDeliveriesOpen = (run: RunState): boolean =>
  owned(run, HELPER_LINES[run.phase][0]) >= 1;

export const isLoadHere = (run: RunState): boolean =>
  isDeliveriesOpen(run) && res(run, "dlStage") === 1;

export const loadsPlaced = (run: RunState): number => res(run, "dlCount");

/** What the load can be worth, in seconds of what the site makes. */
const loadMult = (run: RunState): number => loadForkMult(run) * dockMult(run);

/** Pays, as units of the part's own resource (or know-how, or footing). */
export function loadPays(run: RunState, option: number, value: number): number {
  const v = Math.max(1, value) * loadMult(run);
  if (run.phase === 3) {
    const level = owned(run, option === 1 ? "songbird" : "hum");
    if (option === 0) return D.materialSeconds * v;
    return (D.poleSeconds + 6 * level) * v;
  }
  if (option === 0) return D.materialSeconds * v;
  if (option === 1) return D.poleSeconds * v;
  if (run.phase === 1) return D.planKnowhow * loadMult(run);
  return D.stoneSeconds * v;
}

/** A guess at how much each load helps, in seconds of income, for the hint. */
function loadWorth(run: RunState, option: number, value: number): number {
  const v = Math.max(1, value);
  if (run.phase === 3) return loadPays(run, option, value) / v;
  if (option === 0) return D.materialSeconds * loadMult(run);
  if (option === 1)
    return (D.poleSeconds + 21 * swayOf(run)) * Math.max(1, loadMult(run));
  if (run.phase === 1) return 30 * loadMult(run);
  if (!isFootingOpen(run)) return 0;
  const stock = footingStock(run);
  const ref = Math.max(1, referenceIncome(run));
  const gain =
    gainFor(stock + loadPays(run, option, value), ref) - gainFor(stock, ref);
  return gain * 90;
}

/** The load that helps most right now (0, 1 or 2). */
export function bestLoad(run: RunState, value: number): number {
  let best = 0;
  for (let i = 1; i < LOAD_COUNT; i += 1)
    if (loadWorth(run, i, value) > loadWorth(run, best, value) + 1e-9) best = i;
  return best;
}

/** What the load gives, in words ("about +120 blocks"). */
export function loadPaysText(
  run: RunState,
  option: number,
  value: number
): string {
  const pays = formatNumber(Math.floor(loadPays(run, option, value)));
  if (run.phase === 1 && option === 2) return `+${pays} know-how`;
  if (run.phase !== 3 && option === 2)
    return `+${pays} into the ${run.phase === 0 ? "base" : "anchors"}`;
  const word = MANUAL_RESOURCES[run.phase];
  return `+${pays} ${word}${option === 1 && run.phase !== 3 ? " and a straighter tower" : ""}`;
}

/** Places the load. */
export function placeLoad(run: RunState, option: number, value: number): void {
  const pays = loadPays(run, option, value);
  if (run.phase === 3) {
    stepDown(run, pays);
  } else if (option === 2 && run.phase === 1)
    run.resources[KNOWHOW] = res(run, KNOWHOW) + pays;
  else if (option === 2) addToFooting(run, pays);
  else {
    const key = MANUAL_RESOURCES[run.phase];
    run.resources[key] = res(run, key) + pays;
    if (option === 1) relieveSway(run, TUNING.sway.poleRelief);
  }
  run.resources.dlStage = 0;
  run.resources.dlTime = 0;
  run.resources.dlCount = loadsPlaced(run) + 1;
  run.resources.dlLast = option + 1;
  run.resources.dlLastPays = pays;
}

/** Clears the clock at the start of a part. */
export function resetDeliveries(run: RunState): void {
  run.resources.dlStage = 0;
  run.resources.dlTime = 0;
}

/** Runs the clock; a load arrives and waits. */
export function tickDeliveries(run: RunState, dt: number): void {
  if (!isDeliveriesOpen(run) || res(run, "dlStage") === 1) return;
  const time = res(run, "dlTime") + dt;
  // The first load of a part comes sooner (dlLast is cleared when a part begins).
  const wait =
    res(run, "dlLast") === 0
      ? D.firstWaitSeconds
      : run.phase === 3
        ? D.topWaitSeconds
        : D.waitSeconds;
  if (time >= wait) {
    run.resources.dlStage = 1;
    run.resources.dlTime = 0;
  } else run.resources.dlTime = time;
}

/** One button per load; the deliveries panel draws them itself. */
export function loadActions(
  value: (run: RunState) => number
): readonly ActionDef[] {
  return Array.from({ length: LOAD_COUNT }, (_, option): ActionDef => ({
    id: loadActionId(option),
    isInline: true,
    visibleWhen: isDeliveriesOpen,
    describe: (run) => {
      const here = isLoadHere(run);
      const v = value(run);
      return {
        label: LOADS[run.phase][option].name,
        detail: here
          ? `${LOADS[run.phase][option].note} About ${loadPaysText(run, option, v)}.`
          : "The next load is on its way.",
        isBlocked: !here,
        hint:
          here && bestLoad(run, v) === option
            ? { text: "best right now", tone: "good" }
            : undefined,
      };
    },
    perform: (run) => placeLoad(run, option, value(run)),
  }));
}
