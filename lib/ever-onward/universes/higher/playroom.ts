import { nextRandom } from "../../engine/rng";
import type { ActionDef, ConsumableDef, RunState } from "../../engine/types";
import { formatNumber } from "../../engine/format";
import { leanCalm } from "./sway";
import { helperLevels, res } from "./lines";
import { PHASE_PLAYROOM } from "./resources";
import { TUNING } from "./tuning";

/**
 * The Playroom's two dials.
 *
 * Build pace: from careful to rush. Rushing pays more and stacks blocks
 * faster, but the tower leans more; careful is slow and straight. The dial
 * moves a step every couple of seconds, so a change is a commitment.
 *
 * The streak: while you build, every block that goes up without a wobble
 * raises a pot. Bank the pot any time for a bonus, or push on. Every block
 * can be the one where the top tumbles: the pot is lost and the crew spends a
 * few seconds picking blocks up at a lower rate. A leaning tower tumbles sooner, so the two dials work together.
 * The toddler's stomping, on the rug every little while, makes tumbles far
 * more likely, so the best moment to bank (or to slow down) keeps moving.
 *
 * Nothing here runs unless a tap has just stacked a block, so a tower left
 * alone never tumbles. State is hidden resources (`pc*`), so a save from
 * before reads as "easy pace, no streak, toddler not seen yet".
 */

const P = TUNING.playroom;

export const PACES = P.paces;
export const paceActionId = (step: number): string => `pace-${step}`;
export const PACE_ACTION_IDS: readonly string[] = PACES.map((_, i) =>
  paceActionId(i)
);
export const BANK_ACTION_ID = "bank-streak";

/** Mixed into the run's seed so the toddler and the tumbles have a stream of their own. */
const SEED_MIX = 0x70dd1e;

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const stored = (run: RunState, id: string, fallback: number): number =>
  run.resources[id] ?? fallback;

/** The dials open once the first crew is in (the old Steady button's moment). */
export const isPlayroomOpen = (run: RunState): boolean =>
  run.phase === 0 && !run.complete && helperLevels(run) >= 2;

// -------------------------------------------------------------------- pace

/** The pace that is set (the one you chose). */
export const paceStep = (run: RunState): number =>
  Math.min(
    PACES.length - 1,
    Math.max(0, Math.round(stored(run, "pcPace", P.startPace)))
  );

/** The pace the tower is actually working at: it moves toward the set pace. */
export const paceNow = (run: RunState): number =>
  Math.min(PACES.length - 1, Math.max(0, stored(run, "pcEff", paceStep(run))));

/** True while the dial is still moving to the pace you set. */
export const isSettling = (run: RunState): boolean =>
  Math.abs(paceNow(run) - paceStep(run)) > 0.01;

/** A pace's value between two steps, by how far the dial has moved. */
function blend(run: RunState, pick: (i: number) => number): number {
  const at = paceNow(run);
  const lo = Math.floor(at);
  const hi = Math.min(PACES.length - 1, lo + 1);
  return pick(lo) + (pick(hi) - pick(lo)) * (at - lo);
}

/** How much the pace changes every payout (1 = as usual). */
export const paceMult = (run: RunState): number =>
  run.phase === 0
    ? blend(run, (i) => PACES[i].pay) * (isRebuilding(run) ? P.rebuildPay : 1)
    : 1;

/** Seconds between blocks at the current pace. */
export const stackSeconds = (run: RunState): number =>
  blend(run, (i) => PACES[i].stack);

/** How far the tower leans, 0 (upright) to 1. */
export const playroomLean = (run: RunState): number =>
  run.phase === 0 ? clamp01(res(run, "pcLean")) : 0;

/** Where the lean is heading: the pace's lean, less braces and a good footing. */
export const leanTarget = (run: RunState): number =>
  clamp01(
    blend(run, (i) => PACES[i].lean) * Math.max(P.calmFloor, leanCalm(run))
  );

// ------------------------------------------------------------------ toddler

export type ToddlerStage = "away" | "coming" | "stomping";

/** When the toddler next reaches the rug (a time on the run's clock). */
const toddlerArrives = (run: RunState): number => res(run, "pcTodNext");

export function toddlerStage(run: RunState): ToddlerStage {
  const at = toddlerArrives(run);
  if (at <= 0 || run.phase !== 0) return "away";
  if (run.time < at - P.toddlerWarn) return "away";
  if (run.time < at) return "coming";
  return run.time < at + P.toddlerStomp ? "stomping" : "away";
}

/** Whole seconds until the toddler arrives (while coming) or leaves (stomping). */
export function toddlerSeconds(run: RunState): number {
  const at = toddlerArrives(run);
  const stage = toddlerStage(run);
  if (stage === "coming") return Math.ceil(at - run.time);
  if (stage === "stomping") return Math.ceil(at + P.toddlerStomp - run.time);
  return 0;
}

// ------------------------------------------------------------------- streak

/** Blocks stacked in a row without a wobble. */
export const streakOf = (run: RunState): number =>
  run.phase === 0 ? Math.floor(res(run, "pcStreak")) : 0;

/** True while a pillow from a delivery is softening the tumbles. */
export const isSoft = (run: RunState): boolean =>
  res(run, "pcSoftUntil") > run.time;

/** True while the crew picks up the blocks a tumble sent everywhere. */
export const isRebuilding = (run: RunState): boolean =>
  run.phase === 0 && res(run, "pcRebuildUntil") > run.time;

/** What a tumble costs, in seconds of building. */
export const TUMBLE_COST_SECONDS = P.rebuildSeconds * (1 - P.rebuildPay);

/** The chance the next block is the one where the top tumbles. */
export function tumbleChance(run: RunState): number {
  const base =
    P.tumbleBase +
    P.tumbleLean * playroomLean(run) +
    P.tumbleStreak * streakOf(run);
  const stomp = toddlerStage(run) === "stomping" ? P.toddlerMult : 1;
  const soft = isSoft(run) ? 0.5 : 1;
  return Math.min(P.tumbleMax, base * stomp * soft);
}

/** What banking `blocks` in a row is worth, in seconds of building. */
export const potSeconds = (blocks: number): number =>
  blocks <= 0 ? 0 : P.pot * blocks ** P.potPower;

/** What banking now pays, in blocks, given what one second of building makes. */
export const potPays = (run: RunState, perSecond: number): number =>
  potSeconds(streakOf(run)) * Math.max(0, perSecond);

export const canBank = (run: RunState): boolean =>
  isPlayroomOpen(run) && streakOf(run) >= P.bankMin;

export const tumblesSoFar = (run: RunState): number => res(run, "pcTumbles");
export const banksSoFar = (run: RunState): number => res(run, "pcBanks");

/** True for a few seconds after the top tumbled (the scene shows it). */
export const justTumbled = (run: RunState): boolean =>
  res(run, "pcTumbleAt") > 0 &&
  run.time - res(run, "pcTumbleAt") < P.showSeconds;

/** True for a few seconds after a streak was banked. */
export const justBanked = (run: RunState): boolean =>
  res(run, "pcBankAt") > 0 && run.time - res(run, "pcBankAt") < P.showSeconds;

/** How big the last bank was, 1 to 3, for the scene's fanfare. */
export const bankTier = (run: RunState): number => {
  const n = res(run, "pcBankN");
  return n >= 16 ? 3 : n >= 9 ? 2 : 1;
};

// ------------------------------------------------------------------ actions

export function setPace(run: RunState, step: number): void {
  const r = run.resources;
  // The dial starts from where it is now, whatever the old setting was.
  const now = paceNow(run);
  r.pcPace = Math.min(PACES.length - 1, Math.max(0, Math.round(step)));
  r.pcEff = now;
  r.pcChanges = res(run, "pcChanges") + 1;
}

export const paceChanges = (run: RunState): number => res(run, "pcChanges");

/** Banks the streak for its pot of blocks. */
export function bankStreak(run: RunState, perSecond: number): void {
  if (!canBank(run)) return;
  const r = run.resources;
  const pays = potPays(run, perSecond);
  r.blocks = res(run, "blocks") + pays;
  r.pcBankN = streakOf(run);
  r.pcBankPays = pays;
  r.pcBankAt = run.time;
  r.pcPauseUntil = run.time + P.bankPause;
  r.pcBanks = banksSoFar(run) + 1;
  r.pcStreak = 0;
  r.pcAcc = 0;
}

/** A pillow from a delivery makes tumbles half as likely for a minute. */
export function softenTumbles(run: RunState): void {
  run.resources.pcSoftUntil = run.time + P.softSeconds;
}

// --------------------------------------------------------------------- tick

function roll(run: RunState): number {
  const r = run.resources;
  if (!r.pcRng) r.pcRng = (run.rng ^ SEED_MIX) | 0 || 1;
  const stream = { rng: r.pcRng | 0 };
  const value = nextRandom(stream);
  r.pcRng = stream.rng;
  return value;
}

function scheduleToddler(run: RunState): void {
  const [lo, hi] = P.toddlerGap;
  run.resources.pcTodNext =
    run.time + P.toddlerWarn + lo + roll(run) * (hi - lo);
}

function tumble(run: RunState): void {
  const r = run.resources;
  r.pcLostN = streakOf(run);
  r.pcStreak = 0;
  r.pcAcc = 0;
  r.pcTumbleAt = run.time;
  r.pcRebuildUntil = run.time + P.rebuildSeconds;
  r.pcTumbles = tumblesSoFar(run) + 1;
}

/** Tapping stacks a block by hand, and wakes the tower for a few seconds. */
export function wakeTower(run: RunState): void {
  if (!isPlayroomOpen(run)) return;
  run.resources.pcArmed = run.time + P.armSeconds;
}

/** Runs the playroom for `dt` seconds. */
export function tickPlayroom(run: RunState, dt: number): void {
  if (run.phase !== 0) return;
  const r = run.resources;
  // The dial and the lean ease toward where they are going.
  const set = paceStep(run);
  const now = paceNow(run);
  const move = dt / P.settleSeconds;
  r.pcEff = now < set ? Math.min(set, now + move) : Math.max(set, now - move);
  const lean = playroomLean(run);
  const target = leanTarget(run);
  r.pcLean = lean + (target - lean) * Math.min(1, dt / P.leanSeconds);
  if (!isPlayroomOpen(run)) return;
  if (!r.pcTodNext) scheduleToddler(run);
  else if (run.time >= r.pcTodNext + P.toddlerStomp) scheduleToddler(run);
  if (res(run, "pcArmed") <= run.time || res(run, "pcPauseUntil") > run.time)
    return;
  r.pcAcc = res(run, "pcAcc") + dt;
  const gap = stackSeconds(run);
  while (r.pcAcc >= gap) {
    r.pcAcc -= gap;
    if (roll(run) < tumbleChance(run)) {
      tumble(run);
      return;
    }
    r.pcStreak = Math.min(P.streakMax, res(run, "pcStreak") + 1);
  }
}

// ------------------------------------------------------------ words and ids

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** What each pace gives and costs, in plain words. */
export const PACE_NOTES: readonly string[] = [
  "Slow and straight. Pays a little less, and the tower hardly leans.",
  "A steady rhythm. Pays as usual, and the tower leans a little.",
  "Hurry a bit. Pays more and stacks faster, but the tower leans.",
  "Go go go! Pays the most and stacks fastest, but the tower leans a lot.",
];

export const paceActionPlus = (step: number): string =>
  `${PACES[step].pay >= 1 ? "+" : "-"}${pct(Math.abs(PACES[step].pay - 1))} pay`;

/** The panel's lines for one pace. */
export const paceDetail = (step: number): string =>
  `${PACE_NOTES[step]} A block every ${PACES[step].stack} sec.`;

/** One radio button per pace; the playroom panel draws them itself. */
export const PACE_ACTIONS: readonly ActionDef[] = PACES.map((pace, i) => ({
  id: paceActionId(i),
  phases: [PHASE_PLAYROOM],
  isInline: true,
  visibleWhen: isPlayroomOpen,
  describe: (run) => ({
    label: pace.name,
    detail: paceDetail(i),
    isBlocked: paceStep(run) === i,
  }),
  perform: (run) => setPace(run, i),
}));

/** Bank the streak; the engine reads the price of a second of building for us. */
export const bankAction = (
  perSecond: (run: RunState) => number
): ActionDef => ({
  id: BANK_ACTION_ID,
  phases: [PHASE_PLAYROOM],
  isInline: true,
  visibleWhen: isPlayroomOpen,
  describe: (run) => {
    const n = streakOf(run);
    return {
      label: n >= P.bankMin ? "Bank the streak" : "Build a streak",
      detail:
        n >= P.bankMin
          ? `Bank ${n} blocks in a row for +${formatNumber(Math.floor(potPays(run, perSecond(run))))} blocks.`
          : `Stack ${P.bankMin} blocks in a row without a wobble, then you can bank them.`,
      isBlocked: n < P.bankMin,
    };
  },
  perform: (run) => bankStreak(run, perSecond(run)),
});

// ---------------------------------------------------------------- the log

/** Count of things that go in the log (tumbles and banks). */
export const playroomEvents = (run: RunState): number =>
  tumblesSoFar(run) + banksSoFar(run);

/** The latest tumble or bank, in a line for the panel and the log. */
export function playroomResultLine(run: RunState): string | null {
  const tumbleAt = res(run, "pcTumbleAt");
  const bankAt = res(run, "pcBankAt");
  if (tumbleAt <= 0 && bankAt <= 0) return null;
  if (bankAt >= tumbleAt)
    return `Banked! ${res(run, "pcBankN")} blocks in a row paid +${formatNumber(Math.floor(res(run, "pcBankPays")))} blocks.`;
  return `Tumble! The top fell off and a ${res(run, "pcLostN")}-block streak was lost. The crew is picking up the blocks, so pay is down for a moment.`;
}

/**
 * The watched number: how safe the next block is (1 minus one and a half
 * times the tumble chance). It drops with a long streak, a leaning tower and a stomping toddler.
 */
export const PLAYROOM_CONSUMABLE: ConsumableDef = {
  id: "safe-stack",
  label: "Safe stacking",
  level: (run) =>
    isPlayroomOpen(run) ? Math.max(0, 1 - 1.5 * tumbleChance(run)) : null,
  lowZone: { lo: 0.02, hi: 0.7 },
};
