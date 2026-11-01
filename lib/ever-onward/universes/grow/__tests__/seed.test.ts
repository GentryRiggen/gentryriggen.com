import {
  manualGain,
  performAction,
  tick,
  visitorHereFlag,
} from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { growBots } from "../bots";
import { RETURN_VISITOR_ID } from "../visitors";
import {
  WINDOWBOX_ACTION_IDS,
  currentWant,
  isSeedBloomed,
  isWanting,
  potGrowth,
  potStage,
  tendActionId,
  windowBoxLine,
} from "../windowbox";
import { def, runAtPhaseStart } from "./fixtures";

let seedStart: RunState | undefined;
const fresh = (): RunState => {
  seedStart ??= runAtPhaseStart(3);
  return JSON.parse(JSON.stringify(seedStart));
};

const run = (from: RunState, seconds: number): RunState => {
  let next = from;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

const toWant = (from: RunState): RunState => {
  let next = from;
  for (let t = 0; t < 120 && !isWanting(next); t += 1)
    next = tick(def, next, 1);
  return next;
};

const minutes = (strategy: ReturnType<typeof growBots>["realistic"]) => {
  const start = fresh();
  const r = simulate(def, {
    strategy,
    startRun: start,
    maxSeconds: 4 * 3600,
  });
  return { r, min: (r.finalRun.time - start.time) / 60 };
};

describe("the last seed", () => {
  it("starts as soil, with the pot at zero", () => {
    const start = fresh();
    expect(potStage(start)).toBe("soil");
    expect(potGrowth(start)).toBe(0);
    expect(start.resources.potStage).toBe(0);
  });

  it("grows the pot by tending, and a tap always earns care", () => {
    const start = { ...fresh(), resources: { ...fresh().resources, care: 0 } };
    expect(manualGain(def, start)).toBeGreaterThan(0);
    const waiting = toWant(start);
    expect(isWanting(waiting)).toBe(true);
    const before = waiting.resources.growth;
    const after = performAction(
      def,
      waiting,
      tendActionId(currentWant(waiting))
    );
    expect(after.resources.growth).toBeGreaterThan(before);
    expect(after.resources.care).toBeGreaterThan(waiting.resources.care);
    expect(isWanting(after)).toBe(false);
  });

  it("pays the right answer more, and every answer something", () => {
    const waiting = toWant(fresh());
    const want = currentWant(waiting);
    const pays = WINDOWBOX_ACTION_IDS.map(
      (_, i) =>
        performAction(def, waiting, tendActionId(i)).resources.care -
        waiting.resources.care
    );
    pays.forEach((p) => expect(p).toBeGreaterThan(0));
    pays.forEach((p, i) => i !== want && expect(pays[want]).toBeGreaterThan(p));
  });

  it("keeps the want waiting as long as it takes, and never says wrong", () => {
    const waiting = toWant(fresh());
    const later = run(waiting, 600);
    expect(isWanting(later)).toBe(true);
    expect(currentWant(later)).toBe(currentWant(waiting));
    const wrong = (currentWant(waiting) + 1) % 3;
    const done = performAction(def, waiting, tendActionId(wrong));
    expect(windowBoxLine(done)).toMatch(/liked that too/);
    expect(windowBoxLine(done)).not.toMatch(/wrong|fail|lose|bad/i);
  });

  it("gives the pot its own random stream: run.rng never moves", () => {
    const start = fresh();
    expect(run(start, 200).rng).toBe(start.rng);
  });

  it("raises potStage once for each stage the pot grows into", () => {
    let next = fresh();
    const seen: number[] = [];
    for (let t = 0; t < 4 * 3600 && !isSeedBloomed(next); t += 1) {
      next = tick(def, next, 1);
      // tap hard, like the eager player
      next = {
        ...next,
        resources: {
          ...next.resources,
          growth: Math.min(100, next.resources.growth + 0.5),
        },
      };
      const stageNow = next.resources.potStage;
      if (seen[seen.length - 1] !== stageNow) seen.push(stageNow);
    }
    expect(potStage(next)).toBe("bloom");
    // the counter itself only rises and ends at bloom
    const final = tick(def, next, 1);
    expect(final.resources.potStage).toBe(3);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it("blooms, then the visitor comes back, then the run is complete", () => {
    const nearly = {
      ...fresh(),
      resources: { ...fresh().resources, growth: 99.9 },
    };
    expect(nearly.flags[visitorHereFlag(RETURN_VISITOR_ID)]).toBeUndefined();
    let end: RunState = nearly;
    end = {
      ...end,
      resources: { ...end.resources, growth: 100 },
    };
    end = tick(def, end, 1);
    expect(isSeedBloomed(end)).toBe(true);
    expect(end.flags[visitorHereFlag(RETURN_VISITOR_ID)]).toBe(true);
    end = tick(def, end, 1);
    expect(end.complete).toBe(true);
    expect(end.story).toEqual(
      expect.arrayContaining(["seed-return", "seed-child", "seed-end-1"])
    );
  });

  it("never completes on a timer: an untended pot still blooms, only later", () => {
    const idle = minutes({ ...growBots().idle });
    const tended = minutes(growBots().tapper);
    expect(idle.r.finished).toBe(true);
    expect(idle.min).toBeGreaterThan(tended.min);
    // an hour of no answers and no buys never completes it
    const stuck = simulate(def, {
      strategy: { buys: false, tapsPerSecond: 0 },
      startRun: fresh(),
      maxSeconds: 3600,
    });
    expect(stuck.finished).toBe(false);
  });

  it("keeps the shop: the last phase offers care upgrades", () => {
    let next = fresh();
    next = {
      ...next,
      resources: { ...next.resources, care: 100000 },
    };
    next = run(next, 2);
    const offered = next.revealed.filter((id) =>
      def.upgrades.some((u) => u.id === id && u.currency === "care")
    );
    expect(offered).toEqual(expect.arrayContaining(["trellis"]));
    const seedUpgrades = def.upgrades.filter((u) => u.phases?.includes("seed"));
    expect(seedUpgrades.length).toBeGreaterThanOrEqual(5);
    seedUpgrades.forEach((u) => expect(u.currency).toBe("care"));
  });

  it("lasts 12 to 30 minutes for the realistic bot", () => {
    const { r, min } = minutes(growBots().realistic);
    expect(r.finished).toBe(true);
    expect(min).toBeGreaterThanOrEqual(12);
    expect(min).toBeLessThanOrEqual(30);
  });

  it("the music box only adds to hand play", () => {
    const base = fresh();
    const withBox = {
      ...base,
      owned: { ...base.owned, "music-box": 1 },
    };
    const waiting = toWant(withBox);
    const hand = performAction(
      def,
      waiting,
      tendActionId(currentWant(waiting))
    );
    const boxed = run(waiting, 40);
    expect(boxed.resources.care - waiting.resources.care).toBeGreaterThan(0);
    expect(boxed.resources.care - waiting.resources.care).toBeLessThan(
      hand.resources.care - waiting.resources.care
    );
  });

  it("never mentions anything scary in what it says", () => {
    const lines = def.story.filter((m) => m.phase === "seed");
    for (const m of lines) {
      expect(m.text.length).toBeLessThanOrEqual(420);
      expect(m.text).not.toMatch(
        /\b(die|died|dead|death|hurt|lose|lost|fail|wrong|scary|alone)\b/i
      );
    }
  });
});
