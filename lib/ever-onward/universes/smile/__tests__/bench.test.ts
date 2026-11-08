import {
  canPerformAction,
  manualAction,
  performAction,
  tick,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { readsBench, scootsAsFastAsAllowed } from "../bots";
import {
  BACK_ACTION_ID,
  CLOSER_ACTION_ID,
  QUIET_ACTION_IDS,
  closeMult,
  isAway,
  isMoving,
  landCount,
  openness,
  pullCount,
  seatOf,
  tellOf,
  trustFraction,
} from "../quiet";
import { sceneInfo } from "../scene";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart } from "./fixtures";

const Q = TUNING.quiet;

type Policy = (run: RunState, available: string[]) => string[];

const available = (run: RunState): string[] =>
  QUIET_ACTION_IDS.filter((id) => canPerformAction(def, run, id));

/** The quiet, open, with `trust` percent of trust and its own random streams. */
let base: RunState;
function openRun(seed: number, trust = 0): RunState {
  // A quiet with its helpers up, so trust moves in minutes (about 0.04 a
  // second at the far end).
  base ??= {
    ...runAtPhaseStart(3),
  };
  base = {
    ...base,
    owned: { ...base.owned, tea: 10, blanket: 4, rain: 2, "long-silence": 2 },
  };
  return {
    ...base,
    resources: {
      ...base.resources,
      trust,
      // Every smile kept: the bench is at its warmest.
      wsKept: 1,
      qbSeat: 0,
      qbMove: 0,
      qbAway: 0,
      qbRng: seed * 7919,
      qbPhase: (seed % 6) + 0.5,
    },
  };
}

const advance = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

/** Trust built in `seconds` by someone who taps three times a second. */
function builds(
  policy: Policy,
  seed: number,
  trust: number,
  seconds = 180
): { gained: number; pulls: number } {
  let run = openRun(seed, trust);
  const start = run.resources.trust;
  for (let t = 0; t < seconds; t += 1) {
    for (const id of policy(run, available(run))) {
      if (canPerformAction(def, run, id)) run = performAction(def, run, id);
    }
    for (let k = 0; k < 3; k += 1) run = manualAction(def, run);
    run = tick(def, run, 1);
  }
  return { gained: run.resources.trust - start, pulls: pullCount(run) };
}

const SEEDS = [3, 7, 11, 19, 23, 31, 41, 53];
const mean = (policy: Policy, trust: number): number =>
  SEEDS.reduce((sum, seed) => sum + builds(policy, seed, trust).gained, 0) /
  SEEDS.length;

/** Looks every 4 seconds, the way a player glances at the bench. */
const reads: Policy = readsBench(4);
const neverMoves: Policy = () => [];
const alwaysCloser: Policy = scootsAsFastAsAllowed;

describe("The bench", () => {
  it("scoots one seat at a time, and the move takes a moment", () => {
    let run = openRun(3, 90);
    expect(seatOf(run)).toBe(0);
    expect(canPerformAction(def, run, BACK_ACTION_ID)).toBe(false);
    run = performAction(def, run, CLOSER_ACTION_ID);
    expect(isMoving(run)).toBe(true);
    // A choice is a commitment: no changing your mind mid-way.
    expect(canPerformAction(def, run, CLOSER_ACTION_ID)).toBe(false);
    expect(canPerformAction(def, run, BACK_ACTION_ID)).toBe(false);
    expect(sceneInfo(run).scoot).toBe(1);
    run = advance(run, Q.stepSeconds + 1);
    expect(isMoving(run)).toBe(false);
    expect(seatOf(run)).toBe(1);
    expect(landCount(run)).toBe(1);
    expect(sceneInfo(run).landKey).toBe(1);
  });

  it("builds trust faster the closer you sit", () => {
    const run = openRun(3, 90);
    const near = { ...run, resources: { ...run.resources, qbSeat: Q.seats } };
    expect(closeMult(near)).toBeCloseTo(1 + Q.closeGain);
    expect(closeMult(run)).toBe(1);
    const gain = (r: RunState): number => {
      let next = r;
      for (let i = 0; i < 30; i += 1) next = manualAction(def, next);
      return next.resources.trust - r.resources.trust;
    };
    expect(gain(near)).toBeGreaterThan(gain(run) * 1.3);
  });

  it("pulls away when it is too soon: a little trust lost, the far end, a pause", () => {
    // No trust and a calm moment: the second seat is not comfortable.
    let run = openRun(3, 10);
    // (No helpers, so the only thing that moves trust is the pull.)
    run = {
      ...run,
      owned: {},
      resources: { ...run.resources, qbSeat: 1, qbEv: 0, qbNext: 999 },
    };
    expect(openness(run)).toBeLessThan(Q.comfort[2]);
    const before = run.resources.trust;
    run = performAction(def, run, CLOSER_ACTION_ID);
    run = advance(run, Q.stepSeconds + 1);
    expect(pullCount(run)).toBe(1);
    expect(seatOf(run)).toBe(0);
    expect(isAway(run)).toBe(true);
    expect(run.resources.trust).toBeLessThan(before);
    expect(run.resources.trust).toBeGreaterThanOrEqual(0);
    expect(sceneInfo(run)).toMatchObject({ away: true, pullKey: 1 });
    // Nothing is lost for good: they come back, and you can try again.
    expect(canPerformAction(def, run, CLOSER_ACTION_ID)).toBe(false);
    run = advance(run, Q.awaySeconds + 1);
    expect(isAway(run)).toBe(false);
    expect(canPerformAction(def, run, CLOSER_ACTION_ID)).toBe(true);
  });

  it("pulls away if the mood turns while you stay, but not if you scoot back in time", () => {
    const truck = (run: RunState): RunState => ({
      ...run,
      resources: {
        ...run.resources,
        qbSeat: 3,
        qbEv: 3,
        qbEvT: 0,
        qbNext: 999,
      },
    });
    // At 55% trust the third seat (a truck drops them a long way) is comfortable until the truck drops it.
    let stays = truck(openRun(5, 55));
    expect(tellOf(stays)).not.toBe(0);
    stays = advance(stays, 16);
    expect(pullCount(stays)).toBe(1);
    // Scooting back at the warning keeps them comfortable.
    let leaves = truck(openRun(5, 55));
    leaves = performAction(def, leaves, BACK_ACTION_ID);
    leaves = advance(leaves, Q.stepSeconds + 0.5);
    leaves = performAction(def, leaves, BACK_ACTION_ID);
    leaves = advance(leaves, 16);
    expect(pullCount(leaves)).toBe(0);
    expect(seatOf(leaves)).toBe(1);
  });

  it("shows readiness only as body language that follows the real readiness", () => {
    const seen = new Set<number>();
    for (const seed of SEEDS) {
      let run = openRun(seed, 30);
      for (let t = 0; t < 400; t += 1) {
        run = tick(def, run, 1);
        if (!isAway(run) && seatOf(run) === 0) {
          const tell = tellOf(run);
          seen.add(tell);
          const margin = openness(run) - Q.comfort[1];
          if (tell === 3) expect(margin).toBeGreaterThanOrEqual(Q.readyMargin);
          if (tell === 1) expect(margin).toBeLessThan(-Q.farMargin);
        }
      }
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("moves the right moment: birds, snacks and trucks come and go", () => {
    const seen = new Set<string>();
    let readyFlips = 0;
    for (const seed of SEEDS) {
      let run = openRun(seed, 20);
      let was = tellOf(run) === 3;
      for (let t = 0; t < 600; t += 1) {
        run = tick(def, run, 1);
        seen.add(sceneInfo(run).happening);
        const is = tellOf(run) === 3;
        if (is !== was) readyFlips += 1;
        was = is;
      }
    }
    expect(seen).toEqual(new Set(["", "bird", "snack", "warn", "truck"]));
    expect(readyFlips).toBeGreaterThan(SEEDS.length * 8);
  });

  describe("reading the body beats both easy ways to play", () => {
    // With no trust at all there is little room to move, so the win is small.
    for (const [trust, margin] of [
      [0, 1.15],
      [20, 1.5],
      [40, 1.5],
    ] as const) {
      it(`at ${trust}% trust, reading beats always scooting closer and never moving`, () => {
        const read = mean(reads, trust);
        const greedy = mean(alwaysCloser, trust);
        const still = mean(neverMoves, trust);
        if (process.env.BENCH_LOG) console.log(trust, { read, greedy, still });
        expect(read).toBeGreaterThan(greedy * 1.1);
        expect(read).toBeGreaterThan(still * margin);
      });
    }

    it("always scooting closer keeps getting pulled away, and reading seldom does", () => {
      let greedyPulls = 0;
      let readPulls = 0;
      for (const seed of SEEDS) {
        greedyPulls += builds(alwaysCloser, seed, 20).pulls;
        readPulls += builds(reads, seed, 20).pulls;
      }
      expect(greedyPulls).toBeGreaterThan(readPulls * 2);
    });
  });

  it("is over at a real smile", () => {
    const run = openRun(3, 99.9);
    expect(trustFraction(run)).toBeLessThan(1);
    expect(
      trustFraction(advance({ ...run, owned: { ...run.owned } }, 1))
    ).toBeLessThanOrEqual(1);
  });
});
