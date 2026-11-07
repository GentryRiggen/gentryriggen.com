import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { forkBondMult } from "./forks";
import { PHASE_FRIEND } from "./resources";
import { TUNING } from "./tuning";

/**
 * What you do together: the first part's two dials.
 *
 * Wears thin. Once the friend has a bracelet you choose what to do together:
 *  - jokes pay smiles now, and nothing else;
 *  - games (the puppy's fetch, hide and seek) pay some smiles and build a
 *    little bond;
 *  - listening pays no smiles at all, but builds a big bond, and the bond makes
 *    every laugh bigger.
 * Anything you keep doing wears thin: it pays less the longer you repeat it,
 * and recovers while you do something else. Changing what you do takes a
 * moment, and the moment pays little.
 *
 * Forecast you bet on. The friend needs one of the three at a time, and what
 * they need shifts every minute or so. Their face hints at the next need, but
 * only hints: early on the hint is often wrong, and it firms up the longer you
 * watch. Doing what they need pays extra (and lights them up); doing the wrong
 * thing pays less (and earns a gentle sigh).
 *
 * Random numbers (the needs and the hints) come from a stream of their own
 * (`run.rng` is never touched). All state is hidden `run.resources` plus one
 * flag, so a save without them reads as "not opened yet".
 */

const T = TUNING.together;

export const TOGETHER_OPEN_FLAG = "together-open";
const SEED_MIX = 0x7061;

export type Activity = 0 | 1 | 2;

export interface ActivityDef {
  id: "jokes" | "games" | "listening";
  label: string;
  /** What it gives, in plain words (the + line). */
  plus: string;
  /** What it costs, in plain words (the - line). */
  minus: string;
  /** What the friend looks like when they need it. */
  need: string;
  /** What the face looks like when it hints at it. */
  looks: string;
}

export const ACTIVITIES: readonly ActivityDef[] = [
  {
    id: "jokes",
    label: "Tell jokes",
    plus: "Smiles right now",
    minus: "No bond. Wears thin fast",
    need: "a good laugh",
    looks: "a laugh",
  },
  {
    id: "games",
    label: "Play games",
    plus: "Some smiles and a little bond",
    minus: "Neither is a big one",
    need: "a game of fetch",
    looks: "a game",
  },
  {
    id: "listening",
    label: "Just listen",
    plus: "A big bond: every laugh grows",
    minus: "No smiles while you do it",
    need: "someone to listen",
    looks: "a listening ear",
  },
];

export const ACTIVITY_COUNT = ACTIVITIES.length;

export const togetherActionId = (activity: number): string => `tg-${activity}`;
export const TOGETHER_ACTION_IDS: readonly string[] = ACTIVITIES.map((_, i) =>
  togetherActionId(i)
);

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** The bracelet opens it. */
export const isTogetherUnlocked = (run: RunState): boolean =>
  run.phase === 0 && owned(run, "bracelet") >= 1;

/** Open once the first tick after the bracelet has set it up. */
export const isTogetherOpen = (run: RunState): boolean =>
  run.phase === 0 && run.flags[TOGETHER_OPEN_FLAG] === true;

export const togetherChanges = (run: RunState): number => res(run, "tgChanges");

// ------------------------------------------------------- what you are doing

/** What you are doing together (jokes until you choose something else). */
export const activityOf = (run: RunState): Activity =>
  Math.min(2, Math.max(0, Math.round(res(run, "tgAct")))) as Activity;

/** True while the change takes its moment. */
export const isSwitching = (run: RunState): boolean =>
  isTogetherOpen(run) && res(run, "tgSwitch") > 0;

export const switchingTo = (run: RunState): Activity =>
  Math.min(2, Math.max(0, Math.round(res(run, "tgNext")))) as Activity;

export const switchLeft = (run: RunState): number => res(run, "tgSwitch");

/** How worn thin an activity is, 0 (fresh) to 1 (worn right down). */
export const wearOf = (run: RunState, activity: number): number =>
  clamp01(res(run, `tgWear${activity}`));

/** What an activity pays right now of its full pay: wear takes some. */
export const freshness = (run: RunState, activity: number): number =>
  1 - T.wearDepth * wearOf(run, activity);

/** Smiles an activity pays now, as a multiple of a plain friend (no need). */
export const payNow = (run: RunState, activity: number): number =>
  T.pay[activity] * freshness(run, activity);

/** How far along the bond is, 0 to 1. */
export const bondOf = (run: RunState): number => clamp01(res(run, "tgBond"));

/** How much bigger the bond makes every laugh (0 outside the first part). */
export function bondGain(run: RunState): number {
  if (run.phase !== 0) return 0;
  return T.maxGain * bondOf(run) * forkBondMult(run);
}

/** What bond a long stretch of one activity settles at (a card's promise). */
export const settledBond = (activity: number): number =>
  T.bondRate[activity] / (T.bondRate[activity] + T.fadePerSecond);

// ------------------------------------------------------- what they need

/** What the friend needs right now (the truth, never shown). */
export const needOf = (run: RunState): Activity =>
  Math.min(2, Math.max(0, Math.round(res(run, "tgNeed")))) as Activity;

export const needSince = (run: RunState): number => res(run, "tgSince");

/** The face's stage: 0 a hunch, 1 leaning, 2 pretty sure. */
export function hintStage(run: RunState): 0 | 1 | 2 {
  const since = needSince(run);
  return since >= T.firmAt[2] ? 2 : since >= T.firmAt[1] ? 1 : 0;
}

/** What the face hints at right now. It can be wrong. */
export const hintOf = (run: RunState): Activity =>
  Math.min(
    2,
    Math.max(0, Math.round(res(run, `tgH${hintStage(run)}`)))
  ) as Activity;

export const STAGE_WORDS: readonly string[] = [
  "just a hunch",
  "leaning that way",
  "pretty sure",
];

/** True while what you do matches what they need. */
export const isRight = (run: RunState): boolean =>
  isTogetherOpen(run) && !isSwitching(run) && activityOf(run) === needOf(run);

/** What matching or missing the need does to pay and bond. */
export const needMult = (run: RunState): number =>
  isRight(run) ? T.rightMult : T.wrongMult;

/** What a plain friend's pay is multiplied by right now (1 when closed). */
export function togetherPay(run: RunState): number {
  if (!isTogetherOpen(run) || res(run, "tgPaused") === 1) return 1;
  if (isSwitching(run)) return T.switchPay;
  return payNow(run, activityOf(run)) * needMult(run);
}

/** True for a few seconds after they lit up. */
export const justLit = (run: RunState): boolean =>
  res(run, "tgLitAt") > 0 && run.time - res(run, "tgLitAt") < T.showSeconds;

/** True for a few seconds after a sigh. */
export const justSighed = (run: RunState): boolean =>
  res(run, "tgSighAt") > 0 && run.time - res(run, "tgSighAt") < T.showSeconds;

export const litCount = (run: RunState): number => res(run, "tgLits");
export const sighCount = (run: RunState): number => res(run, "tgSighs");

// ------------------------------------------------------------- the tick

/** Picks the friend's next need and the three hints about it. */
function newNeed(run: RunState, previous: number): void {
  const r = run.resources;
  const stream = { rng: res(run, "tgRng") | 0 };
  const roll = () => nextRandom(stream);
  const need =
    previous < 0
      ? Math.floor(roll() * ACTIVITY_COUNT)
      : (previous + 1 + (roll() < 0.5 ? 0 : 1)) % ACTIVITY_COUNT;
  r.tgNeed = need;
  r.tgSince = 0;
  r.tgLeft = T.dwell[0] + roll() * (T.dwell[1] - T.dwell[0]);
  for (let stage = 0; stage < T.hintRight.length; stage += 1) {
    const isTrue = roll() < T.hintRight[stage];
    r[`tgH${stage}`] = isTrue
      ? need
      : (need + 1 + (roll() < 0.5 ? 0 : 1)) % ACTIVITY_COUNT;
  }
  r.tgRng = stream.rng;
}

export function openTogether(run: RunState): void {
  if (run.flags[TOGETHER_OPEN_FLAG] === true) return;
  run.flags[TOGETHER_OPEN_FLAG] = true;
  run.resources.tgRng = (run.rng ^ SEED_MIX) | 0;
  newNeed(run, -1);
}

function lightUp(run: RunState, value: number): void {
  const r = run.resources;
  r.tgLitAt = run.time;
  r.tgLits = litCount(run) + 1;
  r.smiles = res(run, "smiles") + T.burstSeconds * value;
}

function sigh(run: RunState, why: 0 | 1): void {
  const r = run.resources;
  r.tgSighAt = run.time;
  r.tgSighWhy = why;
  r.tgSighs = sighCount(run) + 1;
}

/**
 * Runs the part for `dt` seconds. `value` is what a second of the friend is
 * worth (helpers plus a tap, bond included) (read lazily: only a light-up needs it).
 */
export function tickTogether(
  run: RunState,
  dt: number,
  value: () => number
): void {
  if (run.phase !== 0) return;
  if (run.flags[TOGETHER_OPEN_FLAG] !== true) {
    if (isTogetherUnlocked(run)) openTogether(run);
    return;
  }
  if (res(run, "tgPaused") === 1) return;
  const r = run.resources;
  const wasRight = isRight(run);
  let arrived = false;

  if (res(run, "tgSwitch") > 0) {
    r.tgSwitch = Math.max(0, res(run, "tgSwitch") - dt);
    if (r.tgSwitch === 0) {
      r.tgAct = switchingTo(run);
      arrived = true;
    }
  }

  const act = activityOf(run);
  const working = res(run, "tgSwitch") <= 0;
  const bondBefore = bondOf(run);
  r.tgBond = clamp01(
    bondBefore +
      (working
        ? T.bondRate[act] *
          freshness(run, act) *
          needMult(run) *
          (1 - bondBefore) *
          dt
        : 0) -
      bondBefore * T.fadePerSecond * dt
  );

  for (let i = 0; i < ACTIVITY_COUNT; i += 1) {
    const before = wearOf(run, i);
    const next =
      working && i === act
        ? before + dt / T.wearSeconds[i]
        : before - dt / T.recoverSeconds;
    r[`tgWear${i}`] = clamp01(next);
    if (i === act && working && before < T.thinAt && next >= T.thinAt)
      sigh(run, 0);
  }

  r.tgSince = needSince(run) + dt;
  r.tgLeft = res(run, "tgLeft") - dt;
  if (r.tgLeft <= 0) newNeed(run, needOf(run));

  if (arrived && !isRight(run)) sigh(run, 1);
  if (!wasRight && isRight(run)) lightUp(run, value());
}

export function setActivity(run: RunState, activity: number): void {
  if (!isTogetherOpen(run) || isSwitching(run)) return;
  if (activity === activityOf(run)) return;
  run.resources.tgNext = activity;
  run.resources.tgSwitch = T.switchSeconds;
  run.resources.tgChanges = togetherChanges(run) + 1;
}

/** For the simulator's income probes: no light-ups, and pay is plain. */
export function withoutTogether(run: RunState): RunState {
  return {
    ...run,
    resources: { ...run.resources, tgPaused: 1 },
  };
}

// ------------------------------------------------------------- the words

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** The face, in plain words. */
export function faceLine(run: RunState): string {
  const hint = ACTIVITIES[hintOf(run)];
  return `Their face looks like it wants ${hint.looks}. ${STAGE_WORDS[hintStage(run)]}.`;
}

/** How worn an activity is, in plain words. */
export function wearLine(run: RunState, activity: number): string {
  const w = wearOf(run, activity);
  if (w < 0.1) return "Fresh";
  if (w < T.thinAt)
    return `Wearing thin: pays ${pct(freshness(run, activity))}`;
  return `Worn thin: pays ${pct(freshness(run, activity))}`;
}

/** The latest big moment in plain words (the panel's message and the log). */
export function togetherLine(run: RunState): string | null {
  const litAt = res(run, "tgLitAt");
  const sighAt = res(run, "tgSighAt");
  if (litAt <= 0 && sighAt <= 0) return null;
  if (litAt >= sighAt)
    return "They lit up! That was just what they needed, and it paid a burst of smiles.";
  return res(run, "tgSighWhy") === 1
    ? "A little sigh. That was not quite what they needed. They are not cross."
    : "A little sigh. That has worn thin. Try something else for a while and it will come back.";
}

export const TOGETHER_ACTIONS: readonly ActionDef[] = ACTIVITIES.map(
  (activity, i) => ({
    id: togetherActionId(i),
    phases: [PHASE_FRIEND],
    isInline: true,
    visibleWhen: isTogetherOpen,
    describe: (run) => ({
      label: activity.label,
      detail: `${activity.plus}. ${activity.minus}. ${wearLine(run, i)}.`,
      isBlocked: activityOf(run) === i || isSwitching(run),
    }),
    perform: (run) => setActivity(run, i),
  })
);
