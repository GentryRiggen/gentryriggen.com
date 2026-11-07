import { genericBots, type BotSet } from "../../engine/bots";
import { shownProjects, upgradeCost } from "../../engine/engine";
import type { Strategy } from "../../engine/sim";
import type { RunState } from "../../engine/types";
import { bestLoad, loadActionId } from "./deliveries";
import {
  footingActionId,
  footingChanges,
  footingStep,
  isFootingOpen,
} from "./footing";
import { currentFork, forkActionId, type ForkSide } from "./forks";
import { OVERTIME_ACTION_ID, knowhowOf } from "./knowhow";
import {
  BANK_ACTION_ID,
  PACES,
  TUMBLE_COST_SECONDS,
  canBank,
  isPlayroomOpen,
  isSoft,
  paceActionId,
  paceStep,
  potSeconds,
  streakOf,
  toddlerStage,
  tumbleChanceFor,
} from "./playroom";
import { STEADY_ACTION_ID, leanCalm, swayOf } from "./sway";
import { tendingValue } from "./tick";
import { TUNING } from "./tuning";
import { UPGRADES } from "./upgrades";
import { higherUniverse } from ".";

type Actions = NonNullable<Strategy["actions"]>;

/** True for the one step at the start of each window (steps are 0.5 or 1 s). */
const isWindowStart = (run: RunState, seconds: number): boolean =>
  run.time % seconds < 0.5;

/** The side an engaged bot picks in each part. */
const ENGAGED_SIDES: readonly ForkSide[] = [0, 0, 1, 0];

/**
 * Buys the given side of the current part's fork the moment it is open and
 * affordable (a bot that checks every step always gets there first).
 */
export const takesFork =
  (side?: ForkSide): Actions =>
  (run, available) => {
    const id = forkActionId(
      currentFork(run).id,
      side ?? ENGAGED_SIDES[run.phase] ?? 0
    );
    return available.includes(id) ? [id] : [];
  };

/** Presses Steady once the tower leans this far, looking every `window` seconds. */
export const steadiesAt =
  (threshold: number, window = 1): Actions =>
  (run, available) =>
    run.phase <= 2 &&
    swayOf(run) >= threshold &&
    isWindowStart(run, window) &&
    available.includes(STEADY_ACTION_ID)
      ? [STEADY_ACTION_ID]
      : [];

/**
 * How a bot plays the Playroom's dials. `pace` is a fixed step, or "reads":
 * quick when the coast is clear, careful while the toddler is on the way.
 * `bank` is a fixed streak length to bank at, "never", or "reads": bank when
 * one more block is worth less than the chance of losing the pot.
 */
export interface PlayroomStyle {
  pace: number | "reads" | "plan";
  bank: number | "never" | "reads";
}

/**
 * What a pace is worth in the long run when banking at `blocks`: pay times
 * one plus the bonus per second of building, with the tumbles priced in
 * (`stomping` triples the chance of a tumble).
 */
export function paceRate(
  run: RunState,
  step: number,
  blocks: number,
  stomping: boolean
): number {
  const P = TUNING.playroom;
  const pace = PACES[step];
  const lean = Math.min(1, pace.lean * Math.max(P.calmFloor, leanCalm(run)));
  let alive = 1;
  let seconds = 0;
  let lost = 0;
  for (let k = 0; k < blocks; k += 1) {
    const q = tumbleChanceFor(lean, k, stomping, isSoft(run));
    seconds += alive * pace.stack;
    lost += alive * q * TUMBLE_COST_SECONDS;
    alive *= 1 - q;
  }
  seconds += alive * P.bankPause;
  return pace.pay + (alive * potSeconds(blocks) - lost * pace.pay) / seconds;
}

/** The pace and streak length that earn the most right now. */
const PLANS = new Map<string, { step: number; blocks: number }>();

export function bestPlan(run: RunState): { step: number; blocks: number } {
  const key = `${toddlerStage(run) !== "away"}|${isSoft(run)}|${Math.round(leanCalm(run) * 100)}`;
  const known = PLANS.get(key);
  if (known) return known;
  const stomping = toddlerStage(run) !== "away";
  let best = { step: paceStep(run), blocks: P_BANK_MIN, rate: -Infinity };
  for (let step = 0; step < PACES.length; step += 1)
    for (let blocks = P_BANK_MIN; blocks <= 16; blocks += 1) {
      const rate = paceRate(run, step, blocks, stomping);
      if (rate > best.rate) best = { step, blocks, rate };
    }
  const plan = { step: best.step, blocks: best.blocks };
  PLANS.set(key, plan);
  return plan;
}

const P_BANK_MIN = TUNING.playroom.bankMin;

/** Sets the pace and banks the streak by a style, looking every `window` seconds. */
export const playsPlayroom =
  (style: PlayroomStyle, window = 1): Actions =>
  (run, available) => {
    if (!isPlayroomOpen(run) || !isWindowStart(run, window)) return [];
    const bankNow =
      style.bank === "never"
        ? false
        : style.bank === "reads"
          ? (canBank(run) && streakOf(run) >= bestPlan(run).blocks) ||
            (toddlerStage(run) === "coming" && canBank(run))
          : streakOf(run) >= style.bank;
    if (bankNow && available.includes(BANK_ACTION_ID)) return [BANK_ACTION_ID];
    const want =
      style.pace === "plan"
        ? bestPlan(run).step
        : style.pace === "reads"
          ? toddlerStage(run) === "away"
            ? 2
            : 0
          : style.pace;
    const id = paceActionId(Math.min(PACES.length - 1, want));
    return paceStep(run) !== want && available.includes(id) ? [id] : [];
  };

/** Places the load that helps most, looking every `window` seconds. */
export const placesLoad =
  (window = 1): Actions =>
  (run, available) => {
    if (!isWindowStart(run, window)) return [];
    const ids = [0, 1, 2].map(loadActionId);
    if (!ids.some((id) => available.includes(id))) return [];
    const id = loadActionId(bestLoad(run, tendingValue(run)));
    return available.includes(id) ? [id] : [];
  };

/** The upgrade that ends each of the first three parts. */
const END_IDS = ["treehouse", "skyscraper", "space-elevator"] as const;

/** Share of the last upgrade's price in hand at which the footing stops. */
const END_NEAR_SHARE = 0.25;

/**
 * Keeps this step of the footing while the top of the part is far off, and
 * keeps nothing once a good part of the last upgrade's price is in hand
 * (footing left when the part ends is left behind).
 */
export const footingPolicy =
  (step = 1, window = 10): Actions =>
  (run, available) => {
    if (run.phase > 2 || !isFootingOpen(run) || !isWindowStart(run, window))
      return [];
    const end = UPGRADES.find((u) => u.id === END_IDS[run.phase]);
    const resource = end?.currency ?? "";
    const isNear =
      !!end &&
      run.revealed.includes(end.id) &&
      (run.resources[resource] ?? 0) >= END_NEAR_SHARE * upgradeCost(run, end);
    // Sets the step once, then lets go for good when the top is near.
    if (!isNear && footingChanges(run) > 0) return [];
    const want = isNear ? 0 : step;
    const id = footingActionId(want);
    return footingStep(run) !== want && available.includes(id) ? [id] : [];
  };

/**
 * Calls overtime when the know-how is there and no project is close: it keeps
 * back half of the cheapest project on offer.
 */
export const holdsOvertime: Actions = (run, available) => {
  if (!available.includes(OVERTIME_ACTION_ID)) return [];
  const shown = shownProjects(higherUniverse, run);
  const reserve = shown.length
    ? 0.5 * Math.min(...shown.map((p) => p.costs[0].amount))
    : 0;
  return knowhowOf(run) >= TUNING.knowhow.overtimeCost + reserve
    ? [OVERTIME_ACTION_ID]
    : [];
};

/** Runs several choices at once, so a bot can pick and steady in one step. */
export const together =
  (...parts: Actions[]): Actions =>
  (run, available) =>
    parts.flatMap((part) => part(run, available));

/** A strategy that builds the given way. */
const site = (base: Strategy, actions: Actions): Strategy => ({
  ...base,
  actions,
});

/** A player who builds quickly and banks when one more block risks more than it adds. */
const READS: PlayroomStyle = { pace: 2, bank: "reads" };

/** A player who never touches the dials. */
const IGNORES: PlayroomStyle = { pace: 1, bank: "never" };

/** A player who rushes and banks on a hunch rather than by the odds. */
const GREEDY: PlayroomStyle = { pace: 3, bank: 3 };

/** The scorecard's player personalities for Build It Higher. */
export function higherBots(): BotSet {
  const base = genericBots(higherUniverse);
  const hands = (
    steady: number,
    window: number,
    load: number,
    dials: PlayroomStyle = READS
  ): Actions =>
    together(
      takesFork(),
      steadiesAt(steady, window),
      playsPlayroom(dials, window),
      placesLoad(load),
      footingPolicy(1, Math.max(window, 10)),
      holdsOvertime
    );
  const tapper = site(base.tapper, hands(0.8, 1, 1));
  return {
    tapper,
    realistic: site(base.realistic, hands(0.75, 5, 15)),
    idle: {
      ...base.idle,
      projects: "best",
      actions: takesFork(1),
      greetAfter: Infinity,
    },
    dawdler: site(base.dawdler, hands(0.9, 60, 60)),
    skill: Object.fromEntries(
      [0, 1, 2].map((phase) => [
        phase,
        {
          naive: site(base.tapper, hands(0.97, 1, 1, GREEDY)),
          careful: site(base.tapper, hands(0.7, 1, 1)),
        },
      ])
    ),
    claim: Object.fromEntries(
      [0, 1, 2].map((phase) => [
        phase,
        {
          ignores: site(
            base.tapper,
            together(
              takesFork(),
              steadiesAt(0.8),
              playsPlayroom(IGNORES),
              footingPolicy(1, 10)
            )
          ),
          claims: tapper,
        },
      ])
    ),
    naiveOil: site(base.tapper, hands(0.97, 1, 1, GREEDY)),
    cheapskateOil: tapper,
  };
}
