import { genericBots } from "../../../engine/bots";
import {
  canPerformAction,
  manualAction,
  performAction,
  tick,
  visibleActions,
} from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { projectDoneFlag } from "../../../engine/engine";
import { sceneInfo } from "../scene";
import { takesFork, together } from "../bots";
import { loadActionId } from "../deliveries";
import { packsFor, type PackStyle } from "../keepbots";
import {
  KEEPSAKES,
  bring,
  canBring,
  unmark,
  PACK_SIZE,
  carriedIndexes,
  endingWarmth,
  isSettingDown,
  leftBehind,
  keepActionId,
  keepsakeState,
  loadOf,
  onTheStairs,
  walkMult,
  warmestPossible,
} from "../keepsakes";
import { descentShare } from "../descent";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart, withResources } from "./fixtures";

jest.setTimeout(600_000);

const K = TUNING.top.keepsakes;
const ALL = {
  pcBanks: 12,
  tfSwaps: 7,
  twFlips: 10,
  skGusts: 14,
  skSnaps: 7,
  skNcWins: 3,
  otCount: 4,
  projects: 3,
};

/** The top, with the run's history set (what is on the stairs) and the stairs fork chosen. */
/** The run with its history: counters, and this many lasting projects done. */
function withHistory(run: RunState, history: Record<string, number>): RunState {
  const { projects = 0, ...counters } = history;
  const flags = { ...run.flags };
  for (const [n, id] of [
    "hard-hats",
    "ready-mix",
    "prefab-floors",
    "wind-tunnel",
    "loading-dock",
    "carbon-cable",
  ].entries())
    flags[projectDoneFlag(id)] = n < projects;
  return { ...withResources(run, counters), flags };
}

function top(history: Record<string, number> = ALL, extra = {}): RunState {
  const base = runAtPhaseStart(3);
  return withResources(withHistory(base, history), { quiet: 1e6, ...extra });
}

const act = (run: RunState, i: number): RunState =>
  performAction(def, run, keepActionId(i));

/** Marks a keepsake to bring, whether or not its card is up yet (a plan made early). */
const mark = (run: RunState, i: number): RunState => {
  const next = { ...run, resources: { ...run.resources } };
  bring(next, i);
  return next;
};

/** Walks the robot down to `share` (0 to 1) by setting the descent. */
const walkTo = (run: RunState, share: number): RunState =>
  tick(def, withResources(run, { descent: share * 100 }), 0.1);

const unmarkIt = (run: RunState, i: number): RunState => {
  const next = { ...run, resources: { ...run.resources } };
  unmark(next, i);
  return next;
};

const idx = (id: string): number => KEEPSAKES.findIndex((k) => k.id === id);

describe("what is on the stairs depends on the run", () => {
  it("always has the little things, and the rest only if it happened", () => {
    const bare = top({
      pcBanks: 0,
      otCount: 0,
      tfSwaps: 0,
      twFlips: 0,
      skGusts: 0,
      skSnaps: 0,
      skNcWins: 0,
    });
    expect(onTheStairs(bare).map((i) => KEEPSAKES[i].id)).toEqual([
      "marble",
      "key",
      "daisy",
    ]);
    expect(onTheStairs(top()).length).toBe(KEEPSAKES.length);
    const snappy = top({ skSnaps: 2 });
    expect(onTheStairs(snappy).map((i) => KEEPSAKES[i].id)).toContain("bolt");
    expect(onTheStairs(snappy).map((i) => KEEPSAKES[i].id)).not.toContain(
      "star"
    );
  });

  it("is warmer for something that mattered more in this run", () => {
    const few = top({ skSnaps: 1 });
    const many = top({ skSnaps: 8 });
    const i = idx("bolt");
    expect(warmestPossible(many)).toBeGreaterThan(warmestPossible(few));
    expect(KEEPSAKES[i].warmAt[2]).toBeGreaterThan(KEEPSAKES[i].warmAt[0]);
  });
});

describe("choosing what to bring", () => {
  it("marks a keepsake, takes the mark back, and refuses what will not fit", () => {
    let run = top();
    const bolt = idx("bolt");
    const blueprint = idx("blueprint");
    run = mark(run, bolt);
    expect(keepsakeState(run, bolt)).toBe("marked");
    run = mark(run, idx("marble"));
    run = mark(run, idx("feather"));
    expect(canBring(run, blueprint)).toBe(false);
    const daisy = idx("daisy");
    run = act(run, daisy);
    expect(keepsakeState(run, daisy)).toBe("open");
    run = unmarkIt(run, bolt);
    expect(keepsakeState(run, bolt)).toBe("open");
    expect(canBring(run, blueprint)).toBe(true);
  });

  it("shows the next few cards, with a plus and a minus and no verdict, and more as the robot goes", () => {
    const keepIds = (r: RunState): string[] =>
      visibleActions(def, r)
        .map((a) => a.id)
        .filter((id) => id.startsWith("keep-"));
    expect(keepIds(top())).toHaveLength(3);
    for (const k of KEEPSAKES) {
      const text = JSON.stringify(k).toLowerCase();
      expect(text).not.toMatch(/best|recommend|should|worth it/);
    }
    const later = walkTo(top(), 0.003);
    expect(keepIds(later).length).toBeGreaterThanOrEqual(3);
    expect(keepIds(later)).not.toContain(keepActionId(idx("marble")));
  });

  it("picks up what was marked when the robot reaches it, and leaves the rest", () => {
    let run = top();
    const feather = idx("feather");
    const bolt = idx("bolt");
    run = mark(run, feather);
    run = walkTo(run, K.items[bolt].share + 0.01);
    expect(keepsakeState(run, feather)).toBe("carried");
    expect(keepsakeState(run, bolt)).toBe("left");
    expect(carriedIndexes(run)).toEqual([feather]);
    expect(sceneInfo(run).carry[feather]).toBe("2");
    expect(sceneInfo(run).carry[bolt]).toBe("3");
    expect(sceneInfo(run).load).toBe(1);
  });

  it("cannot take one back once the robot has passed it", () => {
    const run = walkTo(top(), 0.2);
    const feather = idx("feather");
    expect(keepsakeState(run, feather)).toBe("left");
    expect(canPerformAction(def, run, keepActionId(feather))).toBe(false);
  });
});

describe("a save that opens part-way down", () => {
  it("leaves what is already behind quietly, with no goodbye", () => {
    const run = walkTo(top(), 0.3);
    expect(keepsakeState(run, idx("marble"))).toBe("left");
    expect(keepsakeState(run, idx("bulb"))).toBe("left");
    expect(keepsakeState(run, idx("star"))).toBe("open");
    expect(leftBehind(run)).toBe(0);
    expect(sceneInfo(run).parted).toBe(false);
    expect(sceneInfo(run).lastKeep).toBe(-1);
  });

  it("says goodbye as usual to what the robot walks past after that", () => {
    let run = walkTo(top(), 0.0001);
    run = walkTo(run, 0.01);
    expect(keepsakeState(run, idx("feather"))).toBe("left");
    expect(sceneInfo(run).parted).toBe(true);
    expect(sceneInfo(run).lastKeep).toBe(idx("bolt"));
  });
});

describe("what it costs", () => {
  it("slows every step by the weight carried, and less in the old lift", () => {
    const bolt = idx("bolt");
    let run = top();
    run = mark(run, bolt);
    run = walkTo(run, K.items[bolt].share + 0.01);
    expect(loadOf(run)).toBe(2);
    expect(walkMult(run)).toBeCloseTo(1 / (1 + K.slowPerWeight * 2), 5);
    const lift = withResources(run, { fkTop: 2 });
    expect(walkMult(lift)).toBeGreaterThan(walkMult(run));
    expect(walkMult(lift)).toBeLessThan(1);
  });

  it("brings the ground nearer more slowly for the same steps", () => {
    const bolt = idx("bolt");
    const light = walkTo(top(), 0.6);
    const heavy = walkTo(mark(top(), bolt), 0.6);
    const gain = (run: RunState): number => {
      let next = run;
      for (let n = 0; n < 40; n += 1) next = manualAction(def, next);
      return descentShare(next) - descentShare(run);
    };
    expect(loadOf(heavy)).toBe(2);
    expect(gain(heavy)).toBeGreaterThan(0);
    expect(gain(light)).toBeGreaterThan(gain(heavy) * 1.3);
  });

  it("stops the robot for a moment to set one down, and the pack is lighter after", () => {
    const crayon = idx("bulb");
    const star = idx("star");
    let run = top();
    run = mark(run, star);
    run = mark(run, crayon);
    run = walkTo(run, 0.9);
    expect(loadOf(run)).toBe(2);
    const at = descentShare(run);
    run = act(run, star);
    expect(keepsakeState(run, star)).toBe("left");
    expect(isSettingDown(run)).toBe(true);
    expect(loadOf(run)).toBe(1);
    expect(sceneInfo(run).setting).toBe(true);
    const wait = (r: RunState, seconds: number): RunState => {
      let next = r;
      for (let n = 0; n < seconds; n += 1) next = tick(def, next, 1);
      return next;
    };
    const still = wait(run, 2);
    expect(descentShare(still)).toBeCloseTo(at, 6);
    expect(descentShare(manualAction(def, still))).toBeCloseTo(at, 6);
    const later = wait(still, K.setDownSeconds);
    expect(isSettingDown(later)).toBe(false);
    expect(descentShare(manualAction(def, later))).toBeGreaterThan(at);
  });
});

describe("the last picture", () => {
  it("has a warmth that is the sum of what was carried", () => {
    let run = top();
    for (const id of ["feather", "key"]) run = mark(run, idx(id));
    run = walkTo(run, 0.99);
    expect(carriedIndexes(run).length).toBe(2);
    expect(endingWarmth(run)).toBeGreaterThanOrEqual(2);
    expect(sceneInfo(run).warmth).toBe(endingWarmth(run));
  });

  it("keeps the pack small: no more than the pack holds is ever carried", () => {
    let run = top();
    for (let i = 0; i < KEEPSAKES.length; i += 1)
      if (canBring(run, i)) run = mark(run, i);
    run = walkTo(run, 0.99);
    expect(loadOf(run)).toBeLessThanOrEqual(PACK_SIZE);
  });
});

describe("the top has no deliveries any more", () => {
  it("brings no load and shows no card", () => {
    let run = top();
    for (let n = 0; n < 600; n += 1) run = tick(def, run, 1);
    expect(run.resources.dlStage ?? 0).toBe(0);
    for (let n = 0; n < 3; n += 1)
      expect(canPerformAction(def, run, loadActionId(n))).toBe(false);
  });
});

describe("no pack is best: a light pack is quicker, a full one is warmer", () => {
  const base = runAtPhaseStart(3);
  const HISTORIES: Record<string, Record<string, number>> = {
    everything: ALL,
    "sky heavy": {
      pcBanks: 0,
      otCount: 0,
      tfSwaps: 0,
      twFlips: 0,
      skGusts: 14,
      skSnaps: 7,
      skNcWins: 3,
    },
    "town and rug": {
      pcBanks: 12,
      tfSwaps: 7,
      twFlips: 10,
      skGusts: 0,
      skSnaps: 0,
      skNcWins: 0,
    },
  };
  const STYLES: PackStyle[] = ["none", "late", "reads", "all", "warmest"];

  function play(
    history: Record<string, number>,
    style: PackStyle,
    side: 0 | 1
  ): { seconds: number; warmth: number } {
    const start = withHistory(base, history);
    const bots = genericBots(def);
    const result = simulate(def, {
      maxSeconds: 6 * 3600,
      step: 1,
      startRun: start,
      strategy: {
        ...bots.tapper,
        actions: together(takesFork(side), packsFor(style, 1)),
      },
      stopWhen: (run) => (run.owned["set-down"] ?? 0) >= 1,
    });
    return {
      seconds: result.finalRun.time - start.time,
      warmth: endingWarmth(result.finalRun),
    };
  }

  for (const [name, history] of Object.entries(HISTORIES)) {
    for (const side of [0, 1] as const) {
      describe(`${name}, ${side === 0 ? "stairs" : "lift"}`, () => {
        const results = Object.fromEntries(
          STYLES.map((s) => [s, play(history, s, side)])
        ) as Record<PackStyle, { seconds: number; warmth: number }>;

        it("an empty pack is the quickest and the plainest", () => {
          for (const s of STYLES.filter((x) => x !== "none")) {
            expect(results[s].seconds).toBeGreaterThanOrEqual(
              results.none.seconds
            );
            expect(results[s].warmth).toBeGreaterThanOrEqual(
              results.none.warmth
            );
          }
          expect(results.none.warmth).toBe(0);
        });

        it("a full pack is slower and warmer than a pack that reads the stairs", () => {
          expect(results.warmest.warmth).toBeGreaterThanOrEqual(
            results.reads.warmth
          );
          expect(results.warmest.seconds).toBeGreaterThanOrEqual(
            results.reads.seconds
          );
        });

        it("no pack is both the quickest and the warmest, and three are worth choosing between", () => {
          // The old lift carries half the weight, so a pack costs half as much there.
          const margin = side === 1 ? 1.02 : 1.05;
          const quicker = (a: PackStyle, b: PackStyle): boolean =>
            results[a].seconds < results[b].seconds / margin;
          const warmer = (a: PackStyle, b: PackStyle): boolean =>
            results[a].warmth > results[b].warmth;
          // A pack is beaten when another is quicker and at least as warm, or warmer and no slower.
          const isBeaten = (b: PackStyle): boolean =>
            STYLES.some(
              (a) =>
                a !== b &&
                ((quicker(a, b) && results[a].warmth >= results[b].warmth) ||
                  (warmer(a, b) && results[a].seconds <= results[b].seconds))
            );
          for (const a of STYLES)
            expect([
              a,
              STYLES.some((b) => b !== a && (quicker(b, a) || warmer(b, a))),
            ]).toEqual([a, true]);
          const frontier = STYLES.filter((s) => !isBeaten(s));
          expect(frontier.length).toBeGreaterThanOrEqual(3);
          const seconds = STYLES.map((s) => results[s].seconds);
          expect(Math.max(...seconds) / Math.min(...seconds)).toBeGreaterThan(
            margin
          );
        });
      });
    }
  }
});
