import { decisionGaps } from "../decisions";
import type { SimResult } from "../sim";
import type { PurchaseRecord, Trace } from "../trace";
import type { UniverseDef } from "../types";

const def = {
  decisionActions: ["choose-a", "choose-b"],
} as unknown as UniverseDef;

const buy = (t: number, meaningful = true): PurchaseRecord =>
  ({ t, phase: 0, meaningful, id: "x" }) as PurchaseRecord;

function result(parts: {
  buys?: PurchaseRecord[];
  actions?: { t: number; id: string }[];
  projects?: { t: number; id: string }[];
  end?: number;
}): SimResult {
  const trace: Trace = {
    sampleEvery: 5,
    samples: [],
    purchases: parts.buys ?? [],
    novelty: [{ t: 400, kind: "story", id: "a line" }],
    phases: [{ id: "p", index: 0, start: 0, end: parts.end ?? 600 }],
  };
  return {
    trace,
    actionsDone: parts.actions ?? [],
    projectsDone: parts.projects ?? [],
  } as unknown as SimResult;
}

describe("decision gaps", () => {
  it("never counts the opening, story lines, filler buys or untagged actions", () => {
    const [phase] = decisionGaps(
      def,
      result({
        buys: [buy(30), buy(200, false)],
        actions: [{ t: 300, id: "ride-rush" }],
      })
    );
    // From the end of the 2-minute opening to the phase's end: one stretch.
    expect(phase.count).toBe(0);
    expect(phase.longest).toBe(480);
    expect(phase.longestFrom).toBe(120);
    expect(phase.deadShare).toBe(1);
  });

  it("counts meaningful buys, projects and tagged choices", () => {
    const [phase] = decisionGaps(
      def,
      result({
        buys: [buy(180)],
        projects: [{ t: 240, id: "p1" }],
        actions: [
          { t: 300, id: "choose-a" },
          { t: 390, id: "choose-b" },
          { t: 420, id: "choose-a" },
        ],
      })
    );
    expect(phase.kinds).toEqual({ buys: 1, projects: 1, actions: 3 });
    expect(phase.count).toBe(5);
    // 120 -> 180 -> 240 -> 300 -> 390 -> 420 -> 600
    expect(phase.longest).toBe(180);
    expect(phase.longestFrom).toBe(420);
    expect(phase.long.map((g) => g.seconds)).toEqual([90, 180]);
    expect(phase.deadShare).toBeCloseTo(270 / 480);
    expect(phase.perMinute).toBeCloseTo(5 / 8);
  });

  it("draws the curve as seconds since the last decision", () => {
    const [phase] = decisionGaps(def, result({ buys: [buy(90)], end: 240 }));
    expect(phase.sinceLast).toEqual([60, 30, 90, 150]);
  });
});
