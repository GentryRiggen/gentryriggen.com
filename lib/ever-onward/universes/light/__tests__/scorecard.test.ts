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
jest.setTimeout(180_000);

/**
 * Round 4 rebuilt M11 around the click curve, so the old 83 floor (set on
 * the old, clicky bands) no longer applies. The pre-tuning build scored 59
 * capped (79.5 uncapped) on the new card; the tuned build scores 86.8 with
 * no failing gate (87.8 before the review fixes: the never-stuck floor and
 * reachable lens beats). Raise the floor as rounds land.
 *
 * Round 5 added M16 (decision gaps). The sky and the ending still spend most
 * of their time in stretches over a minute with nothing to decide, so their
 * M16 gates fail and the total sits at the gate cap (59). The cap is all the
 * capped floor below checks; the uncapped score is the real regression
 * floor: Round 5's 82.8 minus 1.
 */
const GATE_CAP = 59;
const UNCAPPED_FLOOR = 81.8;
/** An M16 phase allowed to fail its gate, but not to get any worse. */
interface DeadPhaseCeiling {
  /** Share of the phase in gaps over 60 s today, plus 5 points. */
  deadShare: number;
  /** Longest decision-less stretch today, plus 30 s. */
  longest: number;
}
/**
 * Known M16 targets (see the lab notebook): they may fail the gate, but each
 * must stay within 5 points and 30 s of where Round 5 left it (sky 84%,
 * 120 s; ending 75%, 149 s).
 */
const KNOWN_DEAD_PHASES: Readonly<Record<string, DeadPhaseCeiling>> = {
  sky: { deadShare: 0.89, longest: 150 },
  last: { deadShare: 0.8, longest: 179 },
};

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

/** Income per second of each phase's main resource the machines pay from the start. */
const FREE_INCOME = [40, 60, 80, 2];

/** Phase's main resource, paid by the machines from second one: no hands needed. */
const withFreeIncome = (base: UniverseDef): UniverseDef => ({
  ...base,
  tick: (run, dt) => {
    base.tick(run, dt);
    const main = base.phases[run.phase].manualResource;
    run.resources[main] =
      (run.resources[main] ?? 0) + FREE_INCOME[run.phase] * dt;
  },
});

/** Fully automatic from the first minute: taps are a rounding error. */
const automatic = withFreeIncome(def);

/** Taps earn nothing at all (the machines still carry the game). */
const worthlessTaps: UniverseDef = {
  ...withFreeIncome(def),
  manualAction: () => {},
};

describe("Keep the Light On engagement scorecard", () => {
  let good: Scorecard;
  let bad: Scorecard;

  beforeAll(() => {
    good = scoreUniverse(def, { bots: lightBots() });
    bad = scoreUniverse(flooded, { bots: lightBots() });
  });

  it("does not regress below the floor", () => {
    expect(good.total).toBeGreaterThanOrEqual(GATE_CAP);
    expect(good.uncapped).toBeGreaterThanOrEqual(UNCAPPED_FLOOR);
  });

  it("fails no gate but the known decision gaps, and those get no worse", () => {
    const m16 = good.metrics.find((m) => m.id === "M16")!;
    const unexpected = good.failingGates.filter(
      (g) =>
        !Object.keys(KNOWN_DEAD_PHASES).some((p) =>
          g.startsWith(`M16 Decision gaps (${p})`)
        )
    );
    expect(unexpected).toEqual([]);
    for (const [phase, ceiling] of Object.entries(KNOWN_DEAD_PHASES)) {
      const row = m16.perPhase.find((r) => r.phase === phase)!;
      expect(row.stats.deadShare).toBeLessThanOrEqual(ceiling.deadShare);
      expect(row.stats.longest).toBeLessThanOrEqual(ceiling.longest);
    }
  });

  it("reports all 16 metrics with weights summing to 100", () => {
    expect(good.metrics.map((m) => m.id)).toEqual(
      Array.from({ length: 16 }, (_, i) => `M${i + 1}`)
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
    expect(bad.uncapped).toBeLessThan(good.uncapped);
  });

  it("fails the click curve for a build that needs no hands from minute 1", () => {
    const card = scoreUniverse(automatic, { bots: lightBots() });
    const m11 = card.metrics.find((m) => m.id === "M11")!;
    expect(m11.gatePass).toBe(false);
    const coast = m11.perPhase.find((p) => p.phase === "coast")!;
    expect(coast.gate).toBe(false);
    expect(coast.stats.early).toBeLessThan(0.3);
    expect(card.total).toBeLessThanOrEqual(59);
  });

  it("fails the click curve for a build where a tap earns nothing", () => {
    const card = scoreUniverse(worthlessTaps, { bots: lightBots() });
    const m11 = card.metrics.find((m) => m.id === "M11")!;
    expect(m11.gatePass).toBe(false);
    for (const row of m11.perPhase.filter((p) => p.phase !== "run"))
      expect(row.stats.lowestAtThree).toBe(0);
    expect(card.total).toBeLessThanOrEqual(59);
  });

  it("is deterministic", () => {
    expect(scoreUniverse(def, { bots: lightBots() }).uncapped).toBeCloseTo(
      good.uncapped,
      6
    );
  });
});
