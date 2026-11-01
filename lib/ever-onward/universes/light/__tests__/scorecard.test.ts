import { scoreUniverse, type Scorecard } from "../../../engine/score";
import type { UniverseDef } from "../../../engine/types";
import { lightBots } from "../bots";
import { def } from "./fixtures";

/**
 * The Engagement Scorecard (docs/superpowers/specs/2026-11-01-ever-onward-
 * engagement-research.md) played over the whole universe. It guards against
 * regressions: the floor below is the latest round's score minus 2, and the fun loop
 * raises it as the lab notebook (docs/ever-onward/lab-notebook.md) records
 * better rounds. Run it alone with `npm run score:ever-onward` for the table.
 *
 * It simulates seven full runs (about 3 s), so it stays in the normal jest
 * run. If it ever gets slow, tag it and move it to its own CI job the way the
 * other slow suites do (JEST_EXTRA_IGNORE).
 */
jest.setTimeout(60_000);

/** Round 2 scored 59.0 (81.9 before the gate cap). Raise as rounds land. */
const SCORE_FLOOR = 57;
const UNCAPPED_FLOOR = 79;

const BOON_CURRENCY = ["coins", "power", "energy", "energy"];
const BOON_BASE_COST = [20, 80, 100, 100];
const BOONS_PER_PHASE = 6;

/**
 * The first balance's mistakes in miniature: no cap on what is on offer, every
 * cost divided by 10, and six cheap repeatables in every phase that are always
 * affordable (half tagged as mechanics, so they count as options; half are
 * filler that change nothing).
 */
const flooded: UniverseDef = {
  ...def,
  maxVisible: undefined,
  upgrades: [
    ...def.upgrades.map((u) => ({ ...u, baseCost: u.baseCost / 10 })),
    ...def.phases.flatMap((phase, p) =>
      Array.from({ length: BOONS_PER_PHASE }, (_, i) => ({
        id: `boon-${p}-${i}`,
        name: "Boon",
        description: "",
        phases: [phase.id],
        currency: BOON_CURRENCY[p],
        baseCost: BOON_BASE_COST[p] * (1 + i / 2),
        costGrowth: 1.25,
        maxLevel: Infinity,
        kind: i % 2 === 1 ? ("mechanic" as const) : ("filler" as const),
      }))
    ),
  ],
};

describe("Keep the Light On engagement scorecard", () => {
  let good: Scorecard;
  let bad: Scorecard;

  beforeAll(() => {
    good = scoreUniverse(def, { bots: lightBots() });
    bad = scoreUniverse(flooded, { bots: lightBots() });
  });

  it("does not regress below the floor", () => {
    expect(good.total).toBeGreaterThanOrEqual(SCORE_FLOOR);
    expect(good.uncapped).toBeGreaterThanOrEqual(UNCAPPED_FLOOR);
  });

  it("reports all 15 metrics with weights summing to 100", () => {
    expect(good.metrics.map((m) => m.id)).toEqual(
      Array.from({ length: 15 }, (_, i) => `M${i + 1}`)
    );
    expect(good.metrics.reduce((sum, m) => sum + m.weight, 0)).toBe(100);
    expect(good.phases).toHaveLength(def.phases.length);
  });

  it("scores a flood of cheap upgrades well below the real build", () => {
    expect(bad.uncapped).toBeLessThan(good.uncapped - 10);
    expect(bad.total).toBeLessThanOrEqual(good.total);
  });

  it("fails the decision-density gate for the flood, not for the real build", () => {
    const gate = (card: Scorecard, id: string) =>
      card.metrics.find((m) => m.id === id)!.gatePass;
    for (const id of ["M2", "M4", "M5"]) expect(gate(bad, id)).toBe(false);
    expect(gate(good, "M2")).toBe(true);
    expect(bad.total).toBeLessThanOrEqual(59);
  });

  it("is deterministic", () => {
    expect(scoreUniverse(def, { bots: lightBots() }).uncapped).toBeCloseTo(
      good.uncapped,
      6
    );
  });
});
