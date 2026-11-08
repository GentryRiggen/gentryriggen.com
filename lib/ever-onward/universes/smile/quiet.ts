import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { forkCloseMult } from "./forks";
import { FULL_TRUST, PHASE_QUIET } from "./resources";
import { carryRealSmiles } from "./world";
import { TUNING } from "./tuning";

/**
 * The quiet bench: the last part, and its one dial.
 *
 * Sit closer. Patience builds trust, and the closer you sit the faster it
 * builds. But the friend is only ready for a seat closer some of the time:
 *  - how open they are follows how much they trust you, plus the mood of the
 *    moment (a bird lands, they share a snack, a noisy truck goes by);
 *  - moving one seat takes a moment, and they are checked when you arrive:
 *    if it is too soon they pull away (a little trust lost, and they scoot to
 *    the far end of the bench for a while);
 *  - if the mood drops while you sit close, and you stay, they pull away too.
 * Their face and body say how ready they are (arms folded and looking away,
 * glancing over, leaning in), never a number.
 *
 * Random numbers (what happens on the bench, and when) come from a stream of
 * their own (`run.rng` is never touched). All state lives in hidden
 * `run.resources`, so a save without them reads as "far end, nothing yet".
 */

const Q = TUNING.quiet;

export const BENCH_ID = "room-on-bench";
export const CLOSER_ACTION_ID = "bench-closer";
export const BACK_ACTION_ID = "bench-back";
export const QUIET_ACTION_IDS: readonly string[] = [
  CLOSER_ACTION_ID,
  BACK_ACTION_ID,
];

const SEED_MIX = 0x6265;

export const EV_NONE = 0;
export const EV_BIRD = 1;
export const EV_SNACK = 2;
export const EV_TRUCK = 3;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export const isQuietOpen = (run: RunState): boolean => run.phase === 3;

// ------------------------------------------------------------------ trust

/** How much of the one friendship is grown, 0 to 1. */
export const trustFraction = (run: RunState): number =>
  clamp01(res(run, "trust") / FULL_TRUST);

export type TrustStage = "frown" | "flicker" | "warm" | "smile";
export const TRUST_STAGES: readonly TrustStage[] = [
  "frown",
  "flicker",
  "warm",
  "smile",
];

export function trustStage(run: RunState): TrustStage {
  const g = trustFraction(run);
  if (g >= 1) return "smile";
  if (g >= 0.6) return "warm";
  if (g >= 0.015) return "flicker";
  return "frown";
}

/** True once the friend has smiled, really. */
export const isRealSmile = (run: RunState): boolean => trustFraction(run) >= 1;

// ------------------------------------------------------------- the bench

/** The seat you sit at: 0 the far end, up to `seats` side by side. */
export const seatOf = (run: RunState): number =>
  Math.min(Q.seats, Math.max(0, Math.round(res(run, "qbSeat"))));

/** True while you are scooting along the bench. */
export const isMoving = (run: RunState): boolean =>
  isQuietOpen(run) && res(run, "qbMove") > 0;

/** The seat you are scooting to (the one you are at when still). */
export const movingTo = (run: RunState): number =>
  isMoving(run)
    ? Math.min(Q.seats, Math.max(0, Math.round(res(run, "qbTo"))))
    : seatOf(run);

/** True while they sit at the far end after pulling away. */
export const isAway = (run: RunState): boolean =>
  isQuietOpen(run) && res(run, "qbAway") > 0;

export const awayLeft = (run: RunState): number => res(run, "qbAway");

/** How close you sit, 0 to 1. */
export const closeness = (run: RunState): number => seatOf(run) / Q.seats;

/** What sitting where you are does to trust per patience. */
export const closeMultAt = (run: RunState, seat: number): number =>
  1 + Q.closeGain * forkCloseMult(run) * (seat / Q.seats);

export const closeMult = (run: RunState): number =>
  closeMultAt(run, seatOf(run));

/** The bench: how much trust each bit of patience builds. */
export const trustMult = (run: RunState): number =>
  1 + Q.benchBoost * Math.min(1, owned(run, BENCH_ID));

/** What trust a bit of patience builds right now, all in. */
export const trustPerPatience = (run: RunState): number =>
  Q.growthPerPatience * trustMult(run) * closeMult(run);

/** Patience adds up, and the same patience builds trust. */
export function addPatience(run: RunState, amount: number): void {
  if (amount <= 0) return;
  run.resources.patience = res(run, "patience") + amount;
  run.resources.trust = Math.min(
    FULL_TRUST,
    res(run, "trust") + amount * trustPerPatience(run)
  );
}

// ---------------------------------------------------- how open they are

/** What is happening on the bench: 0 nothing, 1 a bird, 2 a snack, 3 a truck. */
export const eventOf = (run: RunState): number =>
  Math.min(3, Math.max(0, Math.round(res(run, "qbEv"))));

const eventAge = (run: RunState): number => res(run, "qbEvT");

/** What the thing that happened adds to (or takes from) how open they are. */
export function eventLift(run: RunState): number {
  const t = eventAge(run);
  switch (eventOf(run)) {
    case EV_BIRD:
      return Q.bird.lift * Math.exp(-t / Q.bird.settle);
    case EV_SNACK:
      return (
        Q.snack.lift * Math.min(1, t / 2) * Math.max(0, 1 - t / Q.snack.seconds)
      );
    case EV_TRUCK: {
      const { warn, drop, hold, fade } = Q.truck;
      if (t < warn) return 0;
      return -drop * clamp01(1 - (t - warn - hold) / fade);
    }
    default:
      return 0;
  }
}

/** The slow wander of their mood, from the clock (never random). */
export function wander(run: RunState): number {
  const phase = res(run, "qbPhase");
  return (
    (Q.wander / 2) *
    (Math.sin(run.time / 9 + phase) + Math.sin(run.time / 23 + phase * 2.3))
  );
}

/**
 * How open they are to company, around 0 to 1: trust, plus the mood of the
 * moment. This is the truth; the player only sees it as body language.
 */
export const openness = (run: RunState): number =>
  Q.openBase +
  Q.openFromTrust * trustFraction(run) +
  eventLift(run) +
  wander(run);

/** What the bench shows of the thing going on, as a flat word. */
export function eventLook(
  run: RunState
): "" | "bird" | "snack" | "warn" | "truck" {
  const t = eventAge(run);
  switch (eventOf(run)) {
    case EV_BIRD:
      return t < 14 ? "bird" : "";
    case EV_SNACK:
      return t < 12 ? "snack" : "";
    case EV_TRUCK:
      if (t < Q.truck.warn) return "warn";
      return t < Q.truck.warn + Q.truck.hold + 2 ? "truck" : "";
    default:
      return "";
  }
}

/** True while a truck is on its way (the warning) or passing. */
export const isTruckNear = (run: RunState): boolean => {
  const look = eventLook(run);
  return look === "warn" || look === "truck";
};

/** Whether they would be comfortable at `seat` right now. */
export const isComfortable = (run: RunState, seat: number): boolean =>
  openness(run) >= Q.comfort[Math.min(Q.seats, Math.max(0, seat))];

export type Tell = 0 | 1 | 2 | 3;

/**
 * Their body language, from how open they are against the seat you are at and
 * the next one. 0 pulling away (crowded where you are, or at the far end after
 * a pull), 1 arms folded and looking away, 2 glancing over with shoulders
 * loosening, 3 leaning in with relaxed shoulders.
 */
export function tellOf(run: RunState): Tell {
  if (!isQuietOpen(run)) return 1;
  if (isAway(run)) return 0;
  const seat = seatOf(run);
  if (seat > 0 && !isComfortable(run, seat)) return 0;
  if (seat >= Q.seats) return 3;
  const margin = openness(run) - Q.comfort[seat + 1];
  return margin < -Q.farMargin ? 1 : margin < Q.readyMargin ? 2 : 3;
}

export const TELL_WORDS: readonly string[] = [
  "They pull their coat in tight and turn away.",
  "Arms folded, eyes on the far end of the street.",
  "They glance over, and their shoulders loosen a little.",
  "Shoulders low, leaning your way, glad of the company.",
];

export const SEAT_WORDS: readonly string[] = [
  "at the far end of the bench",
  "a long way along the bench",
  "halfway along the bench",
  "one seat away",
  "side by side",
];

// ----------------------------------------------------- the big moments

export const landCount = (run: RunState): number => res(run, "qbLands");
export const pullCount = (run: RunState): number => res(run, "qbPulls");

/** True for a few seconds after a step landed. */
export const justLanded = (run: RunState): boolean =>
  res(run, "qbLandAt") > 0 && run.time - res(run, "qbLandAt") < Q.showSeconds;

/** True for a few seconds after they pulled away. */
export const justPulled = (run: RunState): boolean =>
  res(run, "qbPullAt") > 0 && run.time - res(run, "qbPullAt") < Q.showSeconds;

/** Why they last pulled away: 0 you came too soon, 1 you stayed when it turned. */
export const pullWhy = (run: RunState): number => res(run, "qbPullWhy");

// -------------------------------------------------------------- the tick

function pullAway(run: RunState, why: 0 | 1): void {
  const r = run.resources;
  r.qbSeat = 0;
  r.qbMove = 0;
  r.qbCrowd = 0;
  r.qbAway = Q.awaySeconds;
  r.qbPullAt = run.time;
  r.qbPullWhy = why;
  r.qbPulls = pullCount(run) + 1;
  const trust = res(run, "trust");
  r.trust = Math.max(0, trust - Math.max(Q.pullFloor, Q.pullShare * trust));
}

function arrive(run: RunState): void {
  const r = run.resources;
  const to = Math.min(Q.seats, Math.max(0, Math.round(res(run, "qbTo"))));
  const isForward = to > seatOf(run);
  if (isForward && !isComfortable(run, to)) {
    pullAway(run, 0);
    return;
  }
  r.qbSeat = to;
  r.qbCrowd = 0;
  if (isForward) {
    r.qbLandAt = run.time;
    r.qbLands = landCount(run) + 1;
  }
}

/** Picks what happens on the bench next, and when after that. */
function nextEvent(run: RunState): void {
  const r = run.resources;
  const stream = { rng: res(run, "qbRng") | 0 };
  const roll = nextRandom(stream);
  r.qbEv = roll < 0.36 ? EV_BIRD : roll < 0.64 ? EV_SNACK : EV_TRUCK;
  r.qbEvT = 0;
  const [lo, hi] = Q.eventGap;
  r.qbNext = lo + nextRandom(stream) * (hi - lo);
  r.qbRng = stream.rng;
}

/** Opens the bench: the friend is at the far end and nothing has happened yet. */
export function openQuiet(run: RunState): void {
  // The real smiles the world kept are trust already, from the first minute.
  run.resources.trust = Math.max(
    res(run, "trust"),
    carryRealSmiles(run) * FULL_TRUST
  );
  run.resources.qbRng = (run.rng ^ SEED_MIX) | 0;
  run.resources.qbPhase = ((run.rng >>> 3) % 628) / 100;
  run.resources.qbSeat = 0;
  run.resources.qbMove = 0;
  run.resources.qbAway = 0;
  run.resources.qbEv = EV_NONE;
  run.resources.qbEvT = 0;
  run.resources.qbNext = Q.eventGap[0] * 0.5;
}

/** Runs the bench for `dt` seconds. */
export function tickQuiet(run: RunState, dt: number): void {
  if (!isQuietOpen(run)) return;
  const r = run.resources;
  r.qbEvT = eventAge(run) + dt;
  r.qbNext = res(run, "qbNext") - dt;
  if (res(run, "qbNext") <= 0) nextEvent(run);
  if (res(run, "qbAway") > 0) r.qbAway = Math.max(0, res(run, "qbAway") - dt);
  if (res(run, "qbMove") > 0) {
    r.qbMove = Math.max(0, res(run, "qbMove") - dt);
    if (res(run, "qbMove") === 0) arrive(run);
    return;
  }
  const seat = seatOf(run);
  if (seat > 0 && !isComfortable(run, seat)) {
    r.qbCrowd = res(run, "qbCrowd") + dt;
    if (res(run, "qbCrowd") >= Q.crowdSeconds) pullAway(run, 1);
  } else {
    r.qbCrowd = Math.max(0, res(run, "qbCrowd") - 2 * dt);
  }
}

// ----------------------------------------------------------- the actions

/** You can scoot closer when still, not at the closest and not pulled away. */
export const canScootCloser = (run: RunState): boolean =>
  isQuietOpen(run) && !isMoving(run) && !isAway(run) && seatOf(run) < Q.seats;

/** You can scoot back when still and not at the far end. */
export const canScootBack = (run: RunState): boolean =>
  isQuietOpen(run) && !isMoving(run) && seatOf(run) > 0;

function startMove(run: RunState, to: number): void {
  run.resources.qbTo = to;
  run.resources.qbMove = Q.stepSeconds;
}

export function scootCloser(run: RunState): void {
  if (canScootCloser(run)) startMove(run, seatOf(run) + 1);
}

export function scootBack(run: RunState): void {
  if (canScootBack(run)) startMove(run, seatOf(run) - 1);
}

// ------------------------------------------------------------- the words

/** The latest big moment in plain words (the panel's message and the log). */
export function benchLine(run: RunState): string | null {
  const landAt = res(run, "qbLandAt");
  const pullAt = res(run, "qbPullAt");
  if (landAt <= 0 && pullAt <= 0) return null;
  if (landAt > pullAt)
    return "You shuffled closer and they let you. They shared a small smile.";
  return pullWhy(run) === 1
    ? "The mood turned and you stayed. They moved to the far end of the bench. That is all right, they will come back."
    : "That was a little too soon. They moved to the far end of the bench. That is all right, they will come back.";
}

/** The friend's body language, and where you are, in plain words. */
export function benchStatus(run: RunState): string {
  if (isMoving(run)) return "Scooting along the bench";
  if (isAway(run)) return "They are at the far end";
  return `Sitting ${SEAT_WORDS[seatOf(run)]}`;
}

/** The two choices the bench offers; the panel draws them itself. */
export const QUIET_ACTIONS: readonly ActionDef[] = [
  {
    id: CLOSER_ACTION_ID,
    phases: [PHASE_QUIET],
    isInline: true,
    visibleWhen: isQuietOpen,
    describe: (run) => ({
      label: "Scoot closer",
      detail: `Trust builds ${Number(
        closeMultAt(run, Math.min(Q.seats, seatOf(run) + 1)).toFixed(2)
      )}x as fast. If it is too soon, they pull away.`,
      isBlocked: !canScootCloser(run),
    }),
    perform: scootCloser,
  },
  {
    id: BACK_ACTION_ID,
    phases: [PHASE_QUIET],
    isInline: true,
    visibleWhen: isQuietOpen,
    describe: (run) => ({
      label: "Scoot back",
      detail: "Gives them room. Trust builds slower.",
      isBlocked: !canScootBack(run),
    }),
    perform: scootBack,
  },
];
