import {
  canPerformAction,
  manualAction,
  newRun,
  performAction,
  tick,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import {
  ACTIVITY_COUNT,
  TOGETHER_ACTION_IDS,
  activityOf,
  bondOf,
  hintOf,
  hintStage,
  isSwitching,
  isTogetherOpen,
  justLit,
  justSighed,
  needOf,
  togetherActionId,
  wearOf,
} from "../together";
import { incomePerSecond } from "../tick";
import { TUNING } from "../tuning";
import { def } from "./fixtures";

const T = TUNING.together;

const advance = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

/** A friend with a bracelet and a few helpers, the part open and ready. */
function openRun(seed = 7): RunState {
  const run = newRun(def, {}, seed);
  return tick(
    def,
    {
      ...run,
      owned: { balloon: 3, puppy: 2, bracelet: 1 },
    },
    1
  );
}

type Policy = (run: RunState) => number | null;

/** Smiles earned in `seconds` by a player who taps three times a second. */
function earned(policy: Policy, seed: number, seconds = 900): number {
  let run = openRun(seed);
  const start = run.resources.smiles;
  for (let t = 0; t < seconds; t += 1) {
    const choice = policy(run);
    if (choice !== null && canPerformAction(def, run, togetherActionId(choice)))
      run = performAction(def, run, togetherActionId(choice));
    for (let k = 0; k < 3; k += 1) run = manualAction(def, run);
    run = tick(def, run, 1);
  }
  return run.resources.smiles - start;
}

/** Looks at the face (leaning or surer) and does what it says. */
const readsFace: Policy = (run) => {
  if (isSwitching(run)) return null;
  const act = activityOf(run);
  if (hintStage(run) >= 1 && hintOf(run) !== act) return hintOf(run);
  if (wearOf(run, act) >= T.thinAt) return (act + 1) % ACTIVITY_COUNT;
  return null;
};
const always =
  (activity: number): Policy =>
  () =>
    activity;
const rotates =
  (every: number): Policy =>
  (run) =>
    Math.floor(run.time / every) % ACTIVITY_COUNT;

const SEEDS = [3, 7, 11, 19, 23, 31];
const mean = (policy: Policy): number =>
  SEEDS.reduce((sum, seed) => sum + earned(policy, seed), 0) / SEEDS.length;

describe("What you do together", () => {
  it("opens with the bracelet and not before", () => {
    const run = newRun(def);
    const plain = tick(def, { ...run, owned: { balloon: 3, puppy: 2 } }, 1);
    expect(isTogetherOpen(plain)).toBe(false);
    expect(canPerformAction(def, plain, togetherActionId(1))).toBe(false);
    expect(isTogetherOpen(openRun())).toBe(true);
    expect(TOGETHER_ACTION_IDS).toHaveLength(3);
  });

  it("makes a change take a moment, and the moment pays little", () => {
    let run = openRun();
    const before = incomePerSecond(run);
    const other = (activityOf(run) + 1) % ACTIVITY_COUNT;
    run = performAction(def, run, togetherActionId(other));
    expect(isSwitching(run)).toBe(true);
    expect(activityOf(run)).not.toBe(other);
    expect(incomePerSecond(run)).toBeLessThan(before);
    // A choice is a commitment: no changing your mind mid-way.
    const third = (other + 1) % ACTIVITY_COUNT;
    expect(canPerformAction(def, run, togetherActionId(third))).toBe(false);
    run = advance(run, T.switchSeconds + 1);
    expect(isSwitching(run)).toBe(false);
    expect(activityOf(run)).toBe(other);
  });

  it("pays smiles for jokes, some for games and none for listening, and listening builds the most bond", () => {
    const after = (activity: number) => {
      let run = openRun();
      if (activity !== 0)
        run = performAction(def, run, togetherActionId(activity));
      run = advance(run, T.switchSeconds + 40);
      return run;
    };
    const jokes = after(0);
    const games = after(1);
    const listening = after(2);
    expect(T.pay[0]).toBeGreaterThan(T.pay[1]);
    expect(T.pay[1]).toBeGreaterThan(0);
    expect(T.pay[2]).toBe(0);
    expect(incomePerSecond(listening)).toBe(0);
    expect(bondOf(listening)).toBeGreaterThan(bondOf(games));
    expect(bondOf(games)).toBeGreaterThan(bondOf(jokes));
    expect(bondOf(jokes)).toBe(0);
  });

  it("wears whatever you repeat thin, and lets it recover when you do something else", () => {
    let run = openRun();
    const first = activityOf(run);
    expect(wearOf(run, first)).toBeLessThan(0.1);
    run = advance(run, T.wearSeconds[first]);
    expect(wearOf(run, first)).toBeGreaterThan(0.9);
    const other = (first + 1) % ACTIVITY_COUNT;
    run = performAction(def, run, togetherActionId(other));
    run = advance(run, T.switchSeconds + T.recoverSeconds);
    expect(wearOf(run, first)).toBeLessThan(0.1);
  });

  it("hints at the need, firms up the longer you watch, and the need moves", () => {
    const wrong = [0, 0, 0];
    const seen = [0, 0, 0];
    const needs = new Set<number>();
    let changes = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      let run = openRun(seed);
      let lastNeed = needOf(run);
      for (let t = 0; t < 600; t += 1) {
        run = tick(def, run, 1);
        if (needOf(run) !== lastNeed) {
          changes += 1;
          lastNeed = needOf(run);
        }
        needs.add(needOf(run));
        const stage = hintStage(run);
        seen[stage] += 1;
        if (hintOf(run) !== needOf(run)) wrong[stage] += 1;
      }
    }
    expect(needs.size).toBe(ACTIVITY_COUNT);
    expect(changes).toBeGreaterThan(12 * 5);
    // The face can be wrong at every stage, and is wrong less as it firms up.
    const rate = wrong.map((n, i) => n / seen[i]);
    expect(rate[2]).toBeGreaterThan(0);
    expect(rate[0]).toBeGreaterThan(rate[1]);
    expect(rate[1]).toBeGreaterThan(rate[2]);
    expect(rate[0]).toBeGreaterThan(0.4);
    expect(rate[2]).toBeLessThan(0.15);
  });

  it("pays more for what they need than for what they do not, and sighs gently at a miss", () => {
    // Jokes, while the friend needs a laugh and while they need a game.
    const base = advance(openRun(5), 2);
    const asNeeded = (need: number): RunState => ({
      ...base,
      resources: { ...base.resources, tgAct: 0, tgSwitch: 0, tgNeed: need },
    });
    expect(incomePerSecond(asNeeded(0))).toBeGreaterThan(
      incomePerSecond(asNeeded(1)) * (T.rightMult / T.wrongMult) * 0.99
    );
    // Changing to something they do not need ends in a sigh, not a penalty.
    let missed = advance(openRun(5), 2);
    const miss = [0, 1, 2].find(
      (i) => i !== needOf(missed) && i !== activityOf(missed)
    )!;
    missed = performAction(def, missed, togetherActionId(miss));
    missed = advance(missed, T.switchSeconds + 1);
    expect(justSighed(missed)).toBe(true);
    // Changing to what they need lights them up, and pays a burst.
    let hit = advance(openRun(5), 2);
    const need = needOf(hit);
    const before = hit.resources.smiles;
    if (need !== activityOf(hit)) {
      hit = performAction(def, hit, togetherActionId(need));
      hit = advance(hit, T.switchSeconds + 1);
    }
    expect(justLit(hit)).toBe(true);
    expect(hit.resources.smiles).toBeGreaterThan(before);
  });

  describe("no single activity, and no fixed rotation, beats reading the face", () => {
    const reader = mean(readsFace);
    const fixed: [string, number][] = [
      ["jokes only", mean(always(0))],
      ["games only", mean(always(1))],
      ["listening only", mean(always(2))],
      ...[10, 20, 30, 45, 60, 90, 120].map((every): [string, number] => [
        `rotating every ${every}s`,
        mean(rotates(every)),
      ]),
    ];
    it.each(fixed)("reading the face beats %s", (_name, value) => {
      expect(reader).toBeGreaterThan(value * 1.1);
    });
  });
});
