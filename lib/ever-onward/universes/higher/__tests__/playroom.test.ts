import { newRun, performAction, tick } from "../../../engine/engine";
import { simulate, type Strategy } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import {
  footingPolicy,
  holdsOvertime,
  placesLoad,
  playsPlayroom,
  takesFork,
  together,
  type PlayroomStyle,
} from "../bots";
import {
  BANK_ACTION_ID,
  PACES,
  banksSoFar,
  canBank,
  isRebuilding,
  paceActionId,
  paceMult,
  paceNow,
  paceStep,
  playroomLean,
  potSeconds,
  streakOf,
  toddlerStage,
  tumbleChance,
  tumblesSoFar,
} from "../playroom";
import { tendingValue } from "../tick";
import { TUNING } from "../tuning";
import { genericBots } from "../../../engine/bots";
import { def } from "./fixtures";

const P = TUNING.playroom;

/** A playroom with a crew in, a tap just made, ready to stack. */
function crewed(extra: Record<string, number> = {}): RunState {
  const run = newRun(def);
  return {
    ...run,
    owned: { ...run.owned, bear: 3 },
    resources: { ...run.resources, ...extra },
  };
}

/** Taps once a second so the tower stays awake, and ticks `seconds`. */
function build(start: RunState, seconds: number, stopAt?: number): RunState {
  let run = start;
  for (let t = 0; t < seconds; t += 1) {
    if (stopAt !== undefined && streakOf(run) >= stopAt) break;
    run = tick(def, run, 1);
    run.resources.pcArmed = run.time + P.armSeconds;
  }
  return run;
}

describe("the pace dial", () => {
  it("has four paces, each paying and leaning differently, careful to rush", () => {
    expect(PACES.map((p) => p.name)).toEqual([
      "Careful",
      "Easy",
      "Quick",
      "Rush",
    ]);
    for (let i = 1; i < PACES.length; i += 1) {
      expect(PACES[i].pay).toBeGreaterThan(PACES[i - 1].pay);
      expect(PACES[i].lean).toBeGreaterThan(PACES[i - 1].lean);
      expect(PACES[i].stack).toBeLessThan(PACES[i - 1].stack);
    }
  });

  it("starts at an even pace and takes a moment to change", () => {
    const run = crewed();
    expect(paceStep(run)).toBe(P.startPace);
    expect(paceMult(run)).toBe(1);
    let moved = performAction(def, run, paceActionId(3));
    expect(paceStep(moved)).toBe(3);
    expect(paceNow(moved)).toBe(P.startPace);
    expect(paceMult(moved)).toBe(1);
    moved = tick(def, moved, 1);
    expect(paceNow(moved)).toBeGreaterThan(P.startPace);
    expect(paceNow(moved)).toBeLessThan(3);
    for (let t = 0; t < 10; t += 1) moved = tick(def, moved, 1);
    expect(paceNow(moved)).toBe(3);
    expect(paceMult(moved)).toBeCloseTo(PACES[3].pay, 6);
  });

  it("makes a rushing tower lean more than a careful one", () => {
    const lean = (step: number): number => {
      let run = performAction(def, crewed(), paceActionId(step));
      for (let t = 0; t < 60; t += 1) run = tick(def, run, 1);
      return playroomLean(run);
    };
    expect(lean(3)).toBeGreaterThan(lean(0) * 5);
    expect(lean(3)).toBeGreaterThan(lean(1));
  });

  it("leans less with braces and a good base, but never none at all", () => {
    const lean = (owned: Record<string, number>): number => {
      let run: RunState = {
        ...performAction(def, crewed(), paceActionId(3)),
      };
      run = { ...run, owned: { ...run.owned, ...owned } };
      for (let t = 0; t < 60; t += 1) run = tick(def, run, 1);
      return playroomLean(run);
    };
    const plain = lean({});
    const braced = lean({ "rug-corners": 3, "cushion-fort": 1 });
    expect(braced).toBeLessThan(plain);
    expect(braced).toBeGreaterThan(plain * P.calmFloor - 0.05);
  });
});

describe("the streak", () => {
  it("grows one block at a time while the tower is being tapped", () => {
    const run = build(crewed(), 12);
    expect(streakOf(run) + tumblesSoFar(run)).toBeGreaterThan(0);
  });

  it("never runs, and so never tumbles, when nobody taps", () => {
    let run = crewed();
    for (let t = 0; t < 300; t += 1) run = tick(def, run, 1);
    expect(streakOf(run)).toBe(0);
    expect(tumblesSoFar(run)).toBe(0);
  });

  it("raises the tumble chance with the streak, the lean and the toddler's stomp", () => {
    const base = crewed();
    const longer = { ...base, resources: { ...base.resources, pcStreak: 10 } };
    expect(tumbleChance(longer)).toBeGreaterThan(tumbleChance(base));
    const leaning = {
      ...base,
      resources: { ...base.resources, pcLean: 0.8 },
    };
    expect(tumbleChance(leaning)).toBeGreaterThan(tumbleChance(base) * 5);
    const stomp = {
      ...base,
      time: 100,
      resources: { ...base.resources, pcTodNext: 95 },
    };
    expect(toddlerStage(stomp)).toBe("stomping");
    expect(tumbleChance(stomp)).toBeCloseTo(
      tumbleChance(base) * P.toddlerMult,
      6
    );
  });

  it("pays more than in proportion for a longer streak", () => {
    expect(potSeconds(10) / 10).toBeGreaterThan(potSeconds(5) / 5);
    expect(potSeconds(0)).toBe(0);
  });

  it("banks the streak for blocks, then pauses for a moment", () => {
    const run = crewed({ pcStreak: 8, blocks: 0 });
    expect(canBank(run)).toBe(true);
    const banked = performAction(def, run, BANK_ACTION_ID);
    expect(streakOf(banked)).toBe(0);
    expect(banksSoFar(banked)).toBe(1);
    expect(banked.resources.blocks).toBeCloseTo(
      potSeconds(8) * tendingValue(run),
      4
    );
    // A short streak cannot be banked.
    expect(canBank(crewed({ pcStreak: P.bankMin - 1 }))).toBe(false);
    const paused = build({ ...banked }, 2);
    expect(streakOf(paused)).toBe(0);
  });

  it("loses the streak in a tumble, slows the crew for a moment, and recovers", () => {
    // Every roll tumbles at this chance cap, so one is certain within a minute.
    let run = performAction(def, crewed(), paceActionId(3));
    run.resources.pcStreak = 30;
    for (let t = 0; t < 120 && tumblesSoFar(run) === 0; t += 1) {
      run = tick(def, run, 1);
      run.resources.pcArmed = run.time + P.armSeconds;
    }
    expect(tumblesSoFar(run)).toBeGreaterThan(0);
    expect(isRebuilding(run)).toBe(true);
    expect(paceMult(run)).toBeLessThan(PACES[3].pay);
    expect(run.resources.blocks).toBeGreaterThanOrEqual(0);
    for (let t = 0; t < P.rebuildSeconds + 2; t += 1) run = tick(def, run, 1);
    expect(isRebuilding(run)).toBe(false);
  });

  it("sends the toddler on a schedule of its own that warns before it stomps", () => {
    let run = crewed();
    const stages = new Set<string>();
    for (let t = 0; t < 400; t += 1) {
      run = tick(def, run, 1);
      stages.add(toddlerStage(run));
    }
    expect([...stages].sort()).toEqual(["away", "coming", "stomping"]);
    expect(run.rng).toBe(newRun(def).rng);
  });
});

describe("no one setting wins (Build pace and the streak, played by the simulator)", () => {
  jest.setTimeout(240_000);
  const base = genericBots(def).realistic;
  const seeds = [1, 2, 3];

  /** Minutes the realistic player takes to finish the playroom with this style. */
  function minutes(style: PlayroomStyle): number {
    const strategy: Strategy = {
      ...base,
      actions: together(
        takesFork(),
        placesLoad(15),
        footingPolicy(1, 20),
        holdsOvertime,
        playsPlayroom(style, 1)
      ),
    };
    const times = seeds.map(
      (seed) =>
        simulate(def, {
          maxSeconds: 3 * 3600,
          step: 1,
          seed,
          stopWhen: (run) => run.phase > 0,
          strategy,
        }).endTime / 60
    );
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  const adjusts = minutes({ pace: "plan", bank: "reads" });
  const bestFixed = Math.min(
    ...[0, 1, 2, 3].map((pace) => minutes({ pace, bank: "reads" }))
  );

  it("beats always careful and always rush, even with sensible banking", () => {
    expect(minutes({ pace: 0, bank: "reads" })).toBeGreaterThan(adjusts * 1.05);
    expect(minutes({ pace: 3, bank: "reads" })).toBeGreaterThan(adjusts * 1.03);
  });

  it("beats banking too early and never banking", () => {
    expect(minutes({ pace: 2, bank: 3 })).toBeGreaterThan(adjusts * 1.03);
    expect(minutes({ pace: 2, bank: "never" })).toBeGreaterThan(adjusts * 1.2);
  });

  it("beats pushing the streak on and on", () => {
    expect(minutes({ pace: 2, bank: 20 })).toBeGreaterThan(adjusts * 1.05);
  });

  it("is not beaten by any one fixed pace by more than a hair", () => {
    expect(bestFixed).toBeGreaterThan(adjusts * 0.97);
  });
});
