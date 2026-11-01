import { manualAction, newRun } from "../engine";
import { simulate } from "../sim";
import { fixture as def } from "./fixtures";

describe("simulate", () => {
  it("plays the fixture to completion and reports a timeline", () => {
    const result = simulate(def, { maxSeconds: 3600 });
    expect(result.finished).toBe(true);
    expect(result.finishTime).toBeGreaterThan(0);
    expect(result.finishTime).toBeLessThan(3600);
    expect(result.phases.map((p) => p.id)).toEqual(["bright"]);
    expect(result.purchases.length).toBeGreaterThan(3);
    expect(result.unlocks.map((u) => u.id)).toContain("lens");
    expect(result.longestGap.seconds).toBeGreaterThan(0);
    expect(result.longestGap.seconds).toBeLessThan(result.finishTime!);
  });

  it("is deterministic", () => {
    const a = simulate(def, { maxSeconds: 3600 });
    const b = simulate(def, { maxSeconds: 3600 });
    expect(a.finishTime).toBe(b.finishTime);
    expect(a.purchases).toEqual(b.purchases);
  });

  it("stops at maxSeconds without finishing", () => {
    const result = simulate(def, { maxSeconds: 5 });
    expect(result.finished).toBe(false);
    expect(result.finishTime).toBeNull();
    expect(result.endTime).toBeGreaterThanOrEqual(5);
  });

  it("is faster with prestige upgrades", () => {
    const base = simulate(def, { maxSeconds: 3600 });
    const boosted = simulate(def, {
      maxSeconds: 3600,
      prestige: { spark: 3 },
    });
    expect(boosted.finishTime!).toBeLessThan(base.finishTime!);
  });

  it("can tap only, buying nothing", () => {
    const result = simulate(def, {
      maxSeconds: 60,
      strategy: { buys: false },
    });
    expect(result.purchases).toEqual([]);
    expect(result.finalRun.taps).toBeGreaterThan(100);
  });

  it("honors a priority hint and a custom chooser", () => {
    const result = simulate(def, {
      maxSeconds: 120,
      strategy: { choose: (_run, affordable) => affordable.at(-1) },
    });
    expect(result.purchases.length).toBeGreaterThan(0);
  });

  it("starts from a given run and stops on a condition", () => {
    let start = newRun(def);
    start = manualAction(def, start);
    const result = simulate(def, {
      maxSeconds: 600,
      startRun: start,
      strategy: { buys: false },
      stopWhen: (run) => run.resources.coins >= 30,
    });
    expect(result.finalRun.resources.coins).toBeGreaterThanOrEqual(30);
    expect(result.finished).toBe(false);
  });
});

describe("simulate step", () => {
  it("clamps a step of zero or less to a positive minimum", () => {
    for (const step of [0, -3]) {
      const result = simulate(def, { maxSeconds: 1, step });
      expect(result.endTime).toBeGreaterThanOrEqual(1);
    }
  });
});
