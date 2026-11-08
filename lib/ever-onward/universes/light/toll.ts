import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { PHASE_COAST } from "./resources";
import { TUNING } from "./tuning";

/**
 * The harbor toll: the coast's price you set. Every ship pays the toll times
 * the fare, but ships pick a harbor by its toll against the going rate: the
 * rival harbor down the coast, raised a little by your own lighthouses and
 * docks. A high toll earns more from each ship and brings fewer ships; the
 * traffic follows the toll slowly, so a change is a commitment, and the
 * sign takes a while to repaint before it can change again.
 *
 * The rival's toll is the world (it wanders on its own, drawn from its own
 * random stream, so nothing the player does moves it).
 */

const H = TUNING.coast.harbor;

export const TOLL_STEPS = H.steps;
export const tollActionId = (step: number): string => `toll-${step}`;
export const TOLL_ACTION_IDS: readonly string[] = TOLL_STEPS.map((_, i) =>
  tollActionId(i)
);

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

/** The toll step, 0 (low) to the last; a save from before it reads Usual. */
export function tollStep(run: RunState): number {
  const raw = run.resources.tollStep;
  const step =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.round(raw)
      : H.defaultStep;
  return clamp(step, 0, TOLL_STEPS.length - 1);
}

/** What every ship pays, as a multiple of the fare, at the set toll. */
export const tollPay = (run: RunState): number => TOLL_STEPS[tollStep(run)].pay;

/** The desk opens with the keepers (the coast's second dial). */
export const isTollOpen = (run: RunState): boolean =>
  run.phase === 0 && (run.owned.keeper ?? 0) >= H.opensAtKeepers;

/** Seconds until the sign can be repainted again (0 when it can). */
export const tollLockLeft = (run: RunState): number =>
  Math.max(0, res(run, "tollLock"));

/** The share of ships that choose a harbor at `pay` when the going rate is `rate`. */
export const shipShare = (pay: number, rate: number): number =>
  Math.min(1, H.eagerness / (1 + (pay / Math.max(rate, 0.05)) ** H.steepness));

/** The rival harbor's toll now (a save from before it reads the start). */
export const rivalToll = (run: RunState): number =>
  res(run, "hbRival") > 0 ? res(run, "hbRival") : H.rivalStart;

/** The share of ships that would choose you at the set toll, given a going rate. */
export const trafficTarget = (run: RunState, rate: number): number =>
  shipShare(tollPay(run), rate);

/** The traffic now (a fresh harbor has all of it). */
export const trafficShare = (run: RunState): number =>
  run.resources.hbTraffic === undefined
    ? 1
    : clamp(run.resources.hbTraffic, 0, 1);

/** Sets the toll; the sign then takes a while to repaint. */
export function setToll(run: RunState, step: number): void {
  const next = clamp(Math.round(step), 0, TOLL_STEPS.length - 1);
  if (next === tollStep(run) || tollLockLeft(run) > 0) return;
  run.resources.tollStep = next;
  run.resources.tollChanges = res(run, "tollChanges") + 1;
  run.resources.tollLock = H.changeLockSeconds;
  // A new sign puts a few ships off, whichever way it points.
  run.resources.hbTraffic = trafficShare(run) * H.changeTraffic;
}

/** One radio button per step; the harbor panel draws them itself. */
export const TOLL_ACTIONS: readonly ActionDef[] = TOLL_STEPS.map((step, i) => ({
  id: tollActionId(i),
  phases: [PHASE_COAST],
  isInline: true,
  visibleWhen: isTollOpen,
  describe: (run) => ({
    label: step.label,
    detail: `Each ship pays x${step.pay}`,
    isBlocked: tollStep(run) === i || tollLockLeft(run) > 0,
  }),
  perform: (run) => setToll(run, i),
}));

// ------------------------------------------------------------ The rival

/**
 * A stable stream start for a run's starting seed: a full-width integer hash
 * (no two seeds share a stream, unlike masking a bit), never zero.
 */
export function harborSeed(seed: number): number {
  let h = Math.imul((seed | 0) ^ 0x4a17b3, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return h === 0 ? 1 : h;
}

/** Fixes the harbor world's stream when a run begins (before the player's taps move run.rng). */
export function startHarbor(run: RunState): void {
  run.resources.hbSeed = harborSeed(run.rng);
}

/** The harbor world's own random stream (rival tolls, tanker visits). */
export function drawHarbor(run: RunState): number {
  if (!run.resources.hbSeed) run.resources.hbSeed = harborSeed(run.rng);
  const stream = { rng: run.resources.hbSeed | 0 };
  const value = nextRandom(stream);
  run.resources.hbSeed = stream.rng;
  return value;
}

/** How much your lighthouses and docks raise the going rate. */
export const growthRate = (lighthouses: number, dockTier: number): number =>
  1 + H.lighthouseRate * (lighthouses - 1) + H.dockRate * dockTier;

/** The rival's toll, drifting toward its next goal. Nothing the player does moves it. */
function moveRival(run: RunState, dt: number): void {
  const r = run.resources;
  if (!(r.hbRival > 0)) {
    r.hbRival = H.rivalStart;
    r.hbGoal = H.rivalStart;
    r.hbTimer = H.rivalGapMin;
  }
  r.hbTimer -= dt;
  if (r.hbTimer <= 0) {
    const span = H.rivalMax - H.rivalMin;
    let goal = H.rivalMin + drawHarbor(run) * span;
    // A new price should be a real change, so it is at least a third of the range away.
    if (Math.abs(goal - r.hbRival) < span / 3)
      goal =
        r.hbRival < H.rivalMin + span / 2 ? goal + span / 2 : goal - span / 2;
    r.hbGoal = clamp(goal, H.rivalMin, H.rivalMax);
    r.hbTimer = H.rivalGapMin + drawHarbor(run) * H.rivalGapSpread;
    r.hbShifts = res(run, "hbShifts") + 1;
  }
  const reach = ((H.rivalMax - H.rivalMin) / H.rivalGlideSeconds) * dt;
  r.hbRival += clamp(r.hbGoal - r.hbRival, -reach, reach);
}

/**
 * Runs the harbor for `dt` seconds: the rival's toll, the sign's lock and
 * the traffic. `rate` is the going rate the traffic is measured against and
 * `isDark` tells whether the lamp has run dry.
 */
export function tickHarbor(
  run: RunState,
  dt: number,
  growth: number,
  isStorm: boolean,
  isDark: boolean
): void {
  moveRival(run, dt);
  const r = run.resources;
  r.tollLock = Math.max(0, res(run, "tollLock") - dt);
  const rate = rivalToll(run) * growth * (isStorm ? H.stormRate : 1);
  r.hbRate = rate;
  // Until the desk opens there is no sign to change, so the traffic is not
  // allowed to drop (nobody can answer a rival they cannot see yet).
  if (!isTollOpen(run)) {
    r.hbTraffic = 1;
    return;
  }
  const want = trafficTarget(run, rate) * (isDark ? H.darkTraffic : 1);
  const seconds = isDark ? H.darkFollowSeconds : H.followSeconds;
  const now = trafficShare(run);
  r.hbTraffic = now + (want - now) * (1 - Math.exp(-dt / seconds));
}
