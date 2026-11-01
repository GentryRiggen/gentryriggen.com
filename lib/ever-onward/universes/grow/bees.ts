import { formatNumber } from "../../engine/format";
import { nextRandom } from "../../engine/rng";
import type { RunState } from "../../engine/types";
import { TUNING } from "./tuning";

/**
 * The bee dances: a side machine in the backyard. A bee comes home from the
 * flowers and waggles a little figure of eight. Its angle points at a patch
 * and its length says how far away that is. The patches are drawn on a
 * compass, so reading the dance is a look, never a guess. Following the dance
 * to the patch it points at pays the most; any other patch still pays a
 * little. A dance waits as long as it takes, and the next one only starts
 * after it has been followed, so nothing is ever missed. The bee keeper
 * follows a dance that has waited a while, at a lower payout, and so only
 * ever adds to hand play.
 *
 * The dances come from a random stream of their own (`run.rng` is never
 * touched). All state lives in hidden `run.resources` and one flag, so a save
 * without them simply reads as "not opened yet".
 */

const B = TUNING.bees;

export const BEES_OPEN_FLAG = "bees-open";
/** The purchase that opens the dances: the first hive in the garden. */
export const BEES_OPEN_UPGRADE = "bee-hive";
export const BEE_KEEPER_ID = "bee-keeper";

export interface Patch {
  name: string;
  /** Direction from the hive in degrees (0 is up, clockwise). */
  angle: number;
  /** How far away, 0 (by the hive) to 1 (the far fence). */
  length: number;
  blurb: string;
}

export const PATCHES: readonly Patch[] = [
  { name: "Clover Corner", angle: 40, length: 0.3, blurb: "soft and low" },
  { name: "Lavender Row", angle: 130, length: 0.8, blurb: "purple and far" },
  { name: "Apple Blossom", angle: 220, length: 0.5, blurb: "pink and sweet" },
  { name: "Wild Meadow", angle: 310, length: 0.95, blurb: "daisies galore" },
];

export const followActionId = (patch: number): string => `bees-follow-${patch}`;
export const BEE_ACTION_IDS: readonly string[] = PATCHES.map((_, i) =>
  followActionId(i)
);

export type BeeStage = "foraging" | "dancing";

/** Mixed into the run's seed so the dances have a stream of their own. */
const SEED_MIX = 0xbee5;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export const isBeesOpen = (run: RunState): boolean =>
  run.phase === 0 && run.flags[BEES_OPEN_FLAG] === true;

export const hasBeeKeeper = (run: RunState): boolean =>
  owned(run, BEE_KEEPER_ID) > 0;

export const beeStage = (run: RunState): BeeStage =>
  res(run, "beStage") === 1 ? "dancing" : "foraging";

export const isDancing = (run: RunState): boolean =>
  isBeesOpen(run) && beeStage(run) === "dancing";

/** Dances the bees have danced so far. */
export const dancesSoFar = (run: RunState): number => res(run, "beDances");

/** Dances that were followed (by hand or by the keeper). */
export const followsSoFar = (run: RunState): number => res(run, "beFollows");

/** The dance on show: direction in degrees and length 0..1. */
export const danceAngle = (run: RunState): number => res(run, "beAngle");
export const danceLength = (run: RunState): number => res(run, "beLen");

/** Seconds until the next dance (while foraging). */
export const secondsToDance = (run: RunState): number => {
  if (beeStage(run) !== "foraging") return 0;
  const total = dancesSoFar(run) === 0 ? B.firstForageSeconds : B.forageSeconds;
  return Math.max(0, total - res(run, "beTime"));
};

/** Smallest turn between two directions, in degrees (0..180). */
const turn = (a: number, b: number): number => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
};

/**
 * The patch the dance points at, read from its angle and its length: the
 * closest patch on the compass. Always shown to the player, never a coin flip.
 */
export function danceHint(run: RunState): number {
  const angle = danceAngle(run);
  const length = danceLength(run);
  let best = 0;
  let bestGap = Infinity;
  PATCHES.forEach((patch, i) => {
    const gap =
      turn(patch.angle, angle) / 180 + Math.abs(patch.length - length);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  });
  return best;
}

/** Seconds of ripening a follow is worth: the best patch, or a lesser one. */
export const patchSeconds = (run: RunState, patch: number): number =>
  B.bestSeconds * (patch === danceHint(run) ? 1 : B.otherShare);

/** What following `patch` would pay right now, given the garden's pace. */
export const patchPays = (
  run: RunState,
  patch: number,
  income: number
): number => patchSeconds(run, patch) * income;

/** What the keeper's follow pays now. */
export const keeperPays = (run: RunState, income: number): number =>
  B.keeperShare * patchSeconds(run, danceHint(run)) * income;

/** The keeper turns up once the bees have danced twice. */
export const keeperShown = (run: RunState): boolean =>
  run.flags[BEES_OPEN_FLAG] === true && dancesSoFar(run) >= B.keeperAfterDances;

export interface FollowResult {
  patch: number;
  hinted: number;
  payout: number;
  byKeeper: boolean;
}

export function lastFollow(run: RunState): FollowResult {
  return {
    patch: res(run, "bePicked"),
    hinted: res(run, "beHinted"),
    payout: res(run, "beLastPays"),
    byKeeper: res(run, "beBy") === 1,
  };
}

/** The little result line under the compass, or null before the first follow. */
export function beeResultLine(run: RunState): string | null {
  if (followsSoFar(run) <= 0) return null;
  const { patch, hinted, payout, byKeeper } = lastFollow(run);
  const name = PATCHES[patch]?.name ?? "the flowers";
  const seeds = `+${formatNumber(Math.floor(payout))} seeds`;
  if (byKeeper)
    return `The bee keeper followed the dance to ${name}: ${seeds}. (Follow it yourself for even more.)`;
  if (patch === hinted)
    return `The bees were right! ${name} is blooming: ${seeds}!`;
  return `${name} gave a sweet little harvest: ${seeds}. (The dance pointed to ${PATCHES[hinted]?.name ?? "another patch"}, which pays even more.)`;
}

/** The pollination flows in over a few seconds, not as one lump. */
function addSurge(run: RunState, seeds: number): void {
  const r = run.resources;
  r.bePending = res(run, "bePending") + seeds;
  r.beSurgeRate = r.bePending / B.surgeSeconds;
}

/** Moves the pollination that is still flowing to the seeds. */
function flowSurge(run: RunState, dt: number): void {
  const r = run.resources;
  const pending = res(run, "bePending");
  if (pending <= 0) return;
  const flow = Math.min(pending, res(run, "beSurgeRate") * dt);
  r.bePending = pending - flow;
  r.seeds = res(run, "seeds") + flow;
}

/** Follows the dance to `patch`. Hand follows pay in full. */
function follow(
  run: RunState,
  patch: number,
  income: number,
  byKeeper: boolean
): void {
  if (!isDancing(run) || patch < 0 || patch >= PATCHES.length) return;
  const r = run.resources;
  const hinted = danceHint(run);
  const pays = byKeeper
    ? keeperPays(run, income)
    : patchPays(run, patch, income);
  r.bePicked = patch;
  r.beHinted = hinted;
  r.beLastPays = pays;
  r.beBy = byKeeper ? 1 : 0;
  r.beFollows = followsSoFar(run) + 1;
  r.beEarned = res(run, "beEarned") + pays;
  r.beStage = 0;
  r.beTime = 0;
  addSurge(run, pays);
}

/** Follows a patch by hand (the panel's buttons call this). */
export const followDance = (
  run: RunState,
  patch: number,
  income: number
): void => follow(run, patch, income, false);

/** The bees get home and start to dance, from the bees' own stream. */
function startDance(run: RunState): void {
  const r = run.resources;
  const stream = { rng: res(run, "beRng") | 0 };
  const which = Math.floor(nextRandom(stream) * PATCHES.length);
  const patch = PATCHES[Math.min(PATCHES.length - 1, which)];
  const wobbleA = (nextRandom(stream) - 0.5) * 2 * B.angleJitter;
  const wobbleL = (nextRandom(stream) - 0.5) * 2 * B.lengthJitter;
  r.beRng = stream.rng;
  r.beAngle = (patch.angle + wobbleA + 360) % 360;
  r.beLen = clamp01(patch.length + wobbleL);
  r.beStage = 1;
  r.beTime = 0;
  r.beDances = dancesSoFar(run) + 1;
}

/**
 * Opens the dances (the first hive calls this; the tick is the fallback for
 * old saves). The first dance comes after a short forage.
 */
export function openBees(run: RunState): void {
  if (run.flags[BEES_OPEN_FLAG] === true) return;
  run.flags[BEES_OPEN_FLAG] = true;
  run.resources.beRng = (run.rng ^ SEED_MIX) | 0;
  run.resources.beStage = 0;
  run.resources.beTime = 0;
}

/**
 * Runs the bees for `dt` seconds. `income` is the garden's ripening per
 * second (read lazily: only a follow needs it).
 */
export function tickBees(
  run: RunState,
  dt: number,
  income: () => number
): void {
  if (run.phase !== 0) {
    // A pollination still flowing when the yard ends finishes paying out.
    flowSurge(run, dt);
    return;
  }
  if (run.flags[BEES_OPEN_FLAG] !== true) {
    if (owned(run, BEES_OPEN_UPGRADE) > 0) openBees(run);
    return;
  }
  flowSurge(run, dt);
  const r = run.resources;
  if (r.bePaused === 1) return;
  r.beTime = res(run, "beTime") + dt;
  if (beeStage(run) === "foraging") {
    if (r.beTime >= secondsToDanceTotal(run)) startDance(run);
    return;
  }
  if (hasBeeKeeper(run) && r.beTime >= B.keeperDelay)
    follow(run, danceHint(run), income(), true);
}

const secondsToDanceTotal = (run: RunState): number =>
  dancesSoFar(run) === 0 ? B.firstForageSeconds : B.forageSeconds;

/**
 * For the simulator's income probes: nothing is pending, so a pollination is
 * not read as income.
 */
export function withoutBees(run: RunState): RunState {
  run.resources.bePending = 0;
  run.resources.bePaused = 1;
  return run;
}
