import { projectDoneFlag } from "../../engine/engine";
import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { forkHealRate, forkPaintMult } from "./forks";
import { PHASE_WORLD } from "./resources";
import { TUNING } from "./tuning";

/**
 * The world's dial: real smiles and painted smiles.
 *
 * The loudspeakers have five levels. A louder one pays more grins and paints
 * real smiles over faster; a quieter one pays less and lets real smiles come
 * back. Some projects are cheap in grins and cost real smiles (HypnoDrones
 * most of all); some are slow and protect or restore them. How many real
 * smiles are left when the world ends shapes how The Quiet opens.
 *
 * Days move the best level: a festival welcomes noise, a gloomy week paints
 * faster, and crowds that have had enough of noise pay less for loud.
 * Retuning takes a moment, so a level is a commitment.
 *
 * Random numbers (the days) come from a stream of their own. All state is
 * hidden `run.resources` plus one flag, so a save without them reads as "not
 * opened yet": every smile real.
 */

const W = TUNING.world;

export const WORLD_OPEN_FLAG = "world-open";
const SEED_MIX = 0x776f;

export const LEVEL_COUNT = W.pay.length;
export const LEVEL_LABELS: readonly string[] = [
  "Hushed",
  "Soft",
  "Loud",
  "Louder",
  "Loudest",
];

export const levelActionId = (level: number): string => `ws-${level}`;
export const LEVEL_ACTION_IDS: readonly string[] = LEVEL_LABELS.map((_, i) =>
  levelActionId(i)
);

export const DAY_NONE = 0;
export const DAY_FESTIVAL = 1;
export const DAY_GLOOM = 2;
export const DAY_WEARY = 3;
export type WorldDay = 0 | 1 | 2 | 3;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));
export const isDone = (run: RunState, id: string): boolean =>
  run.flags[projectDoneFlag(id)] === true;

/** The first loudspeaker opens the dial. */
export const isWorldUnlocked = (run: RunState): boolean =>
  run.phase === 2 && owned(run, "loudspeaker") >= 1;
export const isWorldOpen = (run: RunState): boolean =>
  run.phase === 2 && run.flags[WORLD_OPEN_FLAG] === true;

// ----------------------------------------------------------- the real share

/** The share of smiles that are real, 0.03 to 1 (all real until the dial opens). */
export const realOf = (run: RunState): number =>
  isWorldOpen(run) || run.phase > 2 ? clamp(res(run, "wsReal"), W.floor, 1) : 1;

/** Whole quarters of real smiles left (0 to 3 bands, 3 = at least 75%). */
export const bandOf = (real: number): number =>
  Math.min(3, Math.floor(real * 4));

// ----------------------------------------------------------------- the dial

export const levelOf = (run: RunState): number =>
  clamp(Math.round(run.resources.wsLoud ?? W.startLevel), 0, LEVEL_COUNT - 1);
export const isRetuning = (run: RunState): boolean =>
  isWorldOpen(run) && res(run, "wsTune") > 0;
export const tuningTo = (run: RunState): number =>
  clamp(Math.round(res(run, "wsNext")), 0, LEVEL_COUNT - 1);
export const tuneLeft = (run: RunState): number => res(run, "wsTune");
export const changesSoFar = (run: RunState): number => res(run, "wsChanges");

// ----------------------------------------------------------------- the days

export const dayKind = (run: RunState): WorldDay =>
  (isWorldOpen(run) && res(run, "wsDayLeft") > 0
    ? Math.round(res(run, "wsDay"))
    : DAY_NONE) as WorldDay;
export const dayLeft = (run: RunState): number => res(run, "wsDayLeft");
export const daysSoFar = (run: RunState): number => res(run, "wsDays");

const isLoud = (level: number): boolean => level >= W.loudFrom;

// ------------------------------------------------------------ pay and paint

/** What a level pays today, as a multiple of plain pay (projects included). */
export function payAt(run: RunState, level: number): number {
  const kind = dayKind(run);
  let pay = W.pay[level] * (1 + W.maskPay * owned(run, "mask-booth"));
  if (kind === DAY_FESTIVAL && isLoud(level)) pay *= W.festivalPay;
  if (kind === DAY_WEARY && isLoud(level)) pay *= W.wearyPay;
  if (isDone(run, "quiet-hours")) pay *= W.quietHoursPay;
  if (isDone(run, "smile-filters")) pay *= W.filtersPay;
  if (isDone(run, "hypno-drones")) pay *= W.dronesPay;
  if (isDone(run, "listening-benches")) pay *= W.benchesPay;
  return pay;
}

/** What the world pays right now (1 outside the world). */
export function worldPay(run: RunState): number {
  if (!isWorldOpen(run)) return 1;
  return payAt(run, levelOf(run)) * (isRetuning(run) ? W.retunePay : 1);
}

/** How much faster the faces get painted over today (1 is usual). */
function paintMult(run: RunState, isBroadcast: boolean): number {
  const kind = dayKind(run);
  return (
    (kind === DAY_FESTIVAL
      ? W.festivalPaint
      : kind === DAY_GLOOM
        ? W.gloomPaint
        : 1) *
    (isDone(run, "quiet-hours") ? W.quietHoursPaint : 1) *
    (1 + W.maskPaint * owned(run, "mask-booth")) *
    forkPaintMult(run) *
    (isBroadcast ? W.broadcastPaint : 1)
  );
}

/** Painting a second whatever the level (the cheap-grin projects). */
const driftOf = (run: RunState): number =>
  (isDone(run, "smile-filters") ? W.filtersDrift : 0) +
  (isDone(run, "hypno-drones") ? W.dronesDrift : 0);

/** Real smiles painted over a second at a level (a share of the crowd). */
export const paintAt = (
  run: RunState,
  level: number,
  isBroadcast = false
): number => W.pressure[level] * paintMult(run, isBroadcast) + driftOf(run);

/** Real smiles that come back a second at a level. */
export const healAt = (run: RunState, level: number): number =>
  W.heal[level] +
  (isDone(run, "listening-benches") ? W.benchesHeal : 0) +
  forkHealRate(run);

/** The net change in real smiles a second at a level (below 0 is losing them). */
export const netAt = (
  run: RunState,
  level: number,
  isBroadcast = false
): number => healAt(run, level) - paintAt(run, level, isBroadcast);

/** For the simulator's income probes: a plain day, not today's weather. */
export function withoutWorldDay(run: RunState): RunState {
  return { ...run, resources: { ...run.resources, wsDayLeft: 0 } };
}

// ----------------------------------------------------------- big moments

const shows = (run: RunState, id: string): boolean =>
  res(run, id) > 0 && run.time - res(run, id) < W.showSeconds;
export const justLost = (run: RunState): boolean => shows(run, "wsLostAt");
export const justHealed = (run: RunState): boolean => shows(run, "wsHealAt");
export const justDroned = (run: RunState): boolean => shows(run, "wsDroneAt");
export const lostCount = (run: RunState): number => res(run, "wsLosses");
export const healCount = (run: RunState): number => res(run, "wsHeals");
export const droneCount = (run: RunState): number => res(run, "wsDrones");

function mark(run: RunState, at: string, count: string): void {
  run.resources[at] = run.time;
  run.resources[count] = res(run, count) + 1;
}

/** Moves the real share, and notes a big moment when a quarter is crossed. */
export function moveReal(run: RunState, delta: number): void {
  const before = realOf(run);
  const after = clamp(before + delta, W.floor, 1);
  run.resources.wsReal = after;
  const idle = (id: string): boolean =>
    !(res(run, id) > 0 && run.time - res(run, id) < W.momentGap);
  if (bandOf(after) < bandOf(before) && idle("wsLostAt"))
    mark(run, "wsLostAt", "wsLosses");
  if (bandOf(after) > bandOf(before) && idle("wsHealAt"))
    mark(run, "wsHealAt", "wsHeals");
}

// ----------------------------------------------------------------- the tick

function newDay(run: RunState): void {
  const r = run.resources;
  const stream = { rng: res(run, "wsRng") | 0 };
  const roll = () => nextRandom(stream);
  const pick = roll();
  r.wsDay =
    pick < W.dayKinds[0]
      ? DAY_FESTIVAL
      : pick < W.dayKinds[1]
        ? DAY_GLOOM
        : DAY_WEARY;
  r.wsDayLeft = W.daySeconds[0] + roll() * (W.daySeconds[1] - W.daySeconds[0]);
  r.wsDays = daysSoFar(run) + 1;
  r.wsRng = stream.rng;
}

function scheduleCalm(run: RunState): void {
  const stream = { rng: res(run, "wsRng") | 0 };
  run.resources.wsCalm =
    W.calmSeconds[0] +
    nextRandom(stream) * (W.calmSeconds[1] - W.calmSeconds[0]);
  run.resources.wsRng = stream.rng;
}

function openWorld(run: RunState): void {
  if (run.flags[WORLD_OPEN_FLAG] === true) return;
  run.flags[WORLD_OPEN_FLAG] = true;
  run.resources.wsRng = (run.rng ^ SEED_MIX) | 0;
  run.resources.wsReal = 1;
  run.resources.wsLoud = W.startLevel;
  run.resources.wsCalm = W.firstDay;
}

export function tickWorld(
  run: RunState,
  dt: number,
  isBroadcast: boolean
): void {
  if (run.phase !== 2) return;
  if (run.flags[WORLD_OPEN_FLAG] !== true) {
    if (isWorldUnlocked(run)) openWorld(run);
    return;
  }
  const r = run.resources;
  if (res(run, "wsTune") > 0) {
    r.wsTune = Math.max(0, res(run, "wsTune") - dt);
    if (r.wsTune === 0) r.wsLoud = tuningTo(run);
  }
  if (res(run, "wsDayLeft") > 0) {
    r.wsDayLeft = Math.max(0, res(run, "wsDayLeft") - dt);
    if (r.wsDayLeft === 0) scheduleCalm(run);
  } else {
    r.wsCalm = res(run, "wsCalm") - dt;
    if (r.wsCalm <= 0) newDay(run);
  }
  moveReal(run, netAt(run, levelOf(run), isBroadcast) * dt);
}

export function setLevel(run: RunState, level: number): void {
  if (!isWorldOpen(run) || isRetuning(run) || level === levelOf(run)) return;
  run.resources.wsNext = level;
  run.resources.wsTune = W.retuneSeconds;
  run.resources.wsChanges = changesSoFar(run) + 1;
}

/** A project that paints some smiles over at once (and says so on the card). */
export function paintOver(run: RunState, share: number): void {
  if (!isWorldOpen(run)) openWorld(run);
  moveReal(run, -share);
}

/** HypnoDrones take off: a big moment, and a lot of faces change at once. */
export function launchDrones(run: RunState): void {
  if (!isWorldOpen(run)) openWorld(run);
  mark(run, "wsDroneAt", "wsDrones");
  run.resources.wsLostAt = run.time;
  moveReal(run, -W.dronesLoss);
}

/** The benches: some real smiles come back at once, and the colour floods in. */
export function restoreSmiles(run: RunState): void {
  if (!isWorldOpen(run)) openWorld(run);
  run.resources.wsHealAt = run.time;
  run.resources.wsHeals = healCount(run) + 1;
  const real = realOf(run);
  run.resources.wsReal = clamp(real + W.benchesGain, W.floor, 1);
}

// --------------------------------------------------------- the Quiet's hook

/** True once the dial has been open this run (an older save has no real share). */
export const hasKept = (run: RunState): boolean =>
  run.flags[WORLD_OPEN_FLAG] === true;

/** What the world ended with (the Quiet reads it; 1 when the dial never opened). */
export const keptOf = (run: RunState): number =>
  hasKept(run) && run.resources.wsKept !== undefined
    ? clamp(run.resources.wsKept, 0, 1)
    : realOf(run);

/** Called as the Quiet opens: the real smiles kept become a head start on trust. */
export function carryRealSmiles(run: RunState): number {
  const kept = hasKept(run) ? clamp(res(run, "wsReal"), W.floor, 1) : 1;
  run.resources.wsKept = kept;
  return kept * W.quietHeadStart;
}

// ------------------------------------------------------------ the words

const pct = (n: number): string => `${Math.round(n * 100)}%`;
const perMinute = (n: number): string => {
  const v = Number((Math.abs(n) * 6000).toFixed(1));
  return `${v}%`;
};

export function dayLine(run: RunState): string {
  const left = Math.ceil(dayLeft(run));
  switch (dayKind(run)) {
    case DAY_FESTIVAL:
      return `A festival! The crowds love noise, so loud pays more and paints more slowly. ${left}s left.`;
    case DAY_GLOOM:
      return `A gloomy week. Everyone is low, and the paint goes on twice as fast. ${left}s left.`;
    case DAY_WEARY:
      return `The crowds have had enough noise. Loud pays much less. ${left}s left.`;
    default:
      return "A plain day. Nothing special is happening.";
  }
}

/** The latest day, for the log. */
export function dayLogLine(run: RunState): string {
  switch (Math.round(res(run, "wsDay"))) {
    case DAY_FESTIVAL:
      return "A festival! Banners go up and everybody wants it loud.";
    case DAY_GLOOM:
      return "A gloomy week. The posters look brighter than anyone.";
    default:
      return "The crowds have had enough noise. Hands go up to ears.";
  }
}

/** One line on what the faces look like now. */
export function realLine(run: RunState): string {
  const real = realOf(run);
  if (real >= 0.9) return "Nearly every smile is a real one.";
  if (real >= 0.6)
    return `${pct(real)} of the smiles are real. The rest are painted.`;
  if (real >= 0.3)
    return `Only ${pct(real)} of the smiles are real. Many faces have a painted grin.`;
  return `Just ${pct(real)} of the smiles are real. Most faces wear a painted grin.`;
}

export interface LevelDef {
  label: string;
  plus: string;
  minus: string;
}

/** The two lines on a level's card, read from the world as it is today. */
export function levelCard(run: RunState, level: number): LevelDef {
  const pay = payAt(run, level);
  const net = netAt(run, level);
  const payWord = `Grins ×${Number(pay.toFixed(2))}`;
  const smileWord =
    net >= 0
      ? `Real smiles +${perMinute(net)} a minute`
      : `Real smiles −${perMinute(net)} a minute`;
  return {
    label: LEVEL_LABELS[level],
    plus: net >= 0 ? smileWord : payWord,
    minus: net >= 0 ? payWord : smileWord,
  };
}

export const LEVEL_ACTIONS: readonly ActionDef[] = LEVEL_LABELS.map(
  (label, level): ActionDef => ({
    id: levelActionId(level),
    phases: [PHASE_WORLD],
    isInline: true,
    visibleWhen: isWorldOpen,
    describe: (run) => {
      const card = levelCard(run, level);
      return {
        label: `Loudspeakers: ${label}`,
        detail: `${card.plus}. ${card.minus}. Retuning takes ${W.retuneSeconds} seconds.`,
        isBlocked: levelOf(run) === level || isRetuning(run),
      };
    },
    perform: (run) => setLevel(run, level),
  })
);

/** What the world left the Quiet with, in plain words (empty if it never ran). */
export function quietOpeningLine(run: RunState): string {
  if (!hasKept(run)) return "";
  const kept = keptOf(run);
  const start = Math.round(kept * W.quietHeadStart * 100);
  if (kept >= 0.6)
    return `${pct(kept)} of the world's smiles were still real, so the friend trusted you ${start}% from the start.`;
  if (kept >= 0.25)
    return `${pct(kept)} of the world's smiles were still real, so the friend trusted you ${start}% from the start. The rest was a long way to come back from.`;
  return `Only ${pct(kept)} of the world's smiles were still real. The friend started with ${start}% trust, and a long bench to sit on.`;
}
