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
import { STEADY_ACTION_ID, swayOf } from "./sway";
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

/** The scorecard's player personalities for Build It Higher. */
export function higherBots(): BotSet {
  const base = genericBots(higherUniverse);
  const hands = (steady: number, window: number, load: number): Actions =>
    together(
      takesFork(),
      steadiesAt(steady, window),
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
          naive: site(base.tapper, hands(0.97, 1, 1)),
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
            together(takesFork(), steadiesAt(0.8), footingPolicy(1, 10))
          ),
          claims: tapper,
        },
      ])
    ),
    naiveOil: site(base.tapper, hands(0.97, 1, 1)),
    cheapskateOil: tapper,
  };
}
