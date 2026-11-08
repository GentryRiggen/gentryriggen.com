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
 *
 * Round 7 (trade-offs: the fund, forks, overdrive, bigger upgrades) scored
 * 79.0 uncapped. Making every step at least half as big again and cutting the
 * steps the picture never showed shortened the run (M14 lost about 3 points,
 * the length band is 2.0-3.0 h and the eager player now finishes in about
 * 1.5 h) while M16 (decision gaps) rose; the floor is that score minus 1.
 */
const GATE_CAP = 59;
/**
 * The Coast's dials (the harbor toll and the oil market beside the lamp, with
 * fewer, bigger keeper steps and the tide clock gone) scored 76.6 uncapped,
 * up from 73.6, and the Coast now passes every gate it used to trip (M1, M4,
 * M5, M15): 14 keepers instead of 40 cut its buys from 63 to 40, and the
 * dials' clicks a minute stay under 3.3.
 *
 * No More Night's grid and crews (batteries and the evening rush, the crews'
 * posts, the streetlights as a dial) scored 76.7 uncapped: the same total,
 * with the night's chores, tension and decisions all in their bands (the
 * night is 21 minutes, up from 19). The floor is that score minus 1.
 *
 * Fixing that night's review (the bank always on offer, a grid you read
 * rather than sum, crews that commit, a lit night worth 200 seconds, the
 * night's prices 135 instead of 28) scored 76.5 uncapped with the night
 * back at 20 minutes. The floor stays where it was.
 *
 * The Sky's dials (the probe design, the sun's edge with its flares, and
 * wild probes; the probe races, course drift, the claimable flare and the
 * sky's overdrive are gone) scored 76.8 uncapped, up from 76.5, with the sky
 * about 17 minutes for a reading player and every sky gate in its band bar
 * the known decision gaps. The floor stays where it was.
 *
 * The Last Light's warmth (the remembered lights, each costing warmth and
 * keeping you company; sails, a hearth, warm company and a crossing song to
 * buy with resolve; the memory garden gone) scored 78.3 uncapped, up from
 * 76.8, with the last part about 20 minutes and its decision gaps now in
 * band (longest 112 s, 16% of the time in gaps over a minute, where it was
 * 159 s and 76%). The floor is that score minus 1.3.
 *
 * Fixing that review (a kind crossing a player who never buys still finishes
 * in about twice the reader's time, lumps and winds that make reading beat
 * every fixed habit, a price ladder and three more song verses that keep a
 * decision coming) scored 77.4 uncapped with the last part about 21 minutes
 * and every gate in its band but the known total length. The floor stays at
 * 77.
 */
const UNCAPPED_FLOOR = 77;
/** Gates knowingly failing; no other gate may fail. */
const KNOWN_REWORK_GATES: readonly string[] = [
  // The whole run is about 1.3 h; later parts add the length (the band is 2-3 h).
  "M14 Total length (run)",
];
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
const FREE_INCOME = [70, 60, 80, 2];

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
        !KNOWN_REWORK_GATES.some((known) => g.startsWith(known)) &&
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

  it("keeps the last light's decisions at a steady pace, with no gate failing in the last part", () => {
    const m16 = good.metrics.find((m) => m.id === "M16")!;
    const last = m16.perPhase.find((r) => r.phase === "last")!;
    expect(last.gate).toBe(true);
    expect(last.stats.longest).toBeLessThanOrEqual(150);
    expect(last.stats.deadShare).toBeLessThanOrEqual(0.4);
    expect(good.failingGates.filter((g) => g.includes("(last)"))).toEqual([]);
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
