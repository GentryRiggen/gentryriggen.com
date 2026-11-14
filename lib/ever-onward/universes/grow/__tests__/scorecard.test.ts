import { scoreUniverse, type Scorecard } from "../../../engine/score";
import { simulate } from "../../../engine/sim";
import { growBots } from "../bots";
import { def } from "./fixtures";

/**
 * Make It Grow's Engagement Scorecard, the regression floor for universe 2.
 * The lab notebook (docs/ever-onward/lab-notebook.md, "Make It Grow, round
 * 1") records how it got here. Run `npm run score:ever-onward -- grow` for
 * the table. Like Light's, it simulates every bot (a few seconds).
 */
jest.setTimeout(180_000);

/**
 * Round 1 took Grow from 59.0 (capped from 76.0, failing M2 on the farm and
 * far too short) to 83.9 with no failing gate. Raise the floor as rounds
 * land.
 *
 * Round 5 added M16 (decision gaps); the world's tail failed its gate, so
 * the total sat at the gate cap (59) with an uncapped score of 82.7.
 *
 * The trade-offs round (seed bank, know-how projects and festivals, a fork
 * in every part, bolder upgrades) put decisions into the world and the farm:
 * M16 went from 5.1 to 6.6 of 8, nothing fails its gate any more and the
 * total is the real score, 82.0. The floor is that minus 1.
 *
 * Pollination (1.32.0) and the farm's harvest day (Dials, Not Buttons) left
 * the world's gates at the mercy of the farm's leftover harvest (a lottery:
 * 0.5M to 17M, so the world opened with 470 to 3400 green). "The Whole
 * World" replaced the which-biome-next choice and the seed migration with
 * the water mix and the blight, and the world now opens the same way however
 * the farm ended (a fixed opening green, plus at most a tenth for a full
 * barn). Every gate passes with nothing listed: the score is 80.2 and the
 * floor is that minus 1. The seed vault costs 80M (it was 46M): the
 * realistic run is 2.0 h, the bottom of its band.
 *
 * The farm review retune (a pumpkin that pays by size, a forecast worth
 * waiting for, luck 0.8) scores 81.1; the vault costs 110M so the run stays
 * at 2.0 h. The floor is that minus 1.
 */
const GATE_CAP = 59;
const UNCAPPED_FLOOR = 80.1;
/** Gates allowed to fail for now, by their label prefix. None today. */
const KNOWN_GATE_MISSES: readonly string[] = [];
/**
 * M16 phases allowed to fail their gate, but not to get any worse. None
 * today: every phase passes.
 */
interface DeadPhaseCeiling {
  /** Share of the phase in gaps over 60 s today, plus 5 points. */
  deadShare: number;
  /** Longest decision-less stretch today, plus 30 s. */
  longest: number;
}
const KNOWN_DEAD_PHASES: Readonly<Record<string, DeadPhaseCeiling>> = {};

const HOUR = 3600;

/** Minutes a realistic player should spend in each phase. */
const TARGET_MINUTES = { yard: 30, farm: 35, world: 35, seed: 20 };
const LENGTH_TOLERANCE = 0.3;

describe("Make It Grow engagement scorecard", () => {
  let card: Scorecard;
  let realisticMinutes: Record<string, number>;

  beforeAll(() => {
    card = scoreUniverse(def, { bots: growBots() });
    const realistic = simulate(def, {
      maxSeconds: 6 * HOUR,
      step: 1,
      strategy: growBots().realistic,
    });
    const starts = [0, ...realistic.phases.map((p) => p.t)];
    const end = realistic.finishTime ?? realistic.endTime;
    realisticMinutes = Object.fromEntries(
      def.phases.map((phase, i) => [
        phase.id,
        ((starts[i + 1] ?? end) - starts[i]) / 60,
      ])
    );
  });

  it("has no failing gate except known decision-gap targets, which get no worse", () => {
    expect(
      card.failingGates.filter(
        (g) =>
          !Object.keys(KNOWN_DEAD_PHASES).some((p) =>
            g.startsWith(`M16 Decision gaps (${p})`)
          ) && !KNOWN_GATE_MISSES.some((known) => g.startsWith(known))
      )
    ).toEqual([]);
    const m16 = card.metrics.find((m) => m.id === "M16")!;
    for (const [phase, ceiling] of Object.entries(KNOWN_DEAD_PHASES)) {
      const row = m16.perPhase.find((r) => r.phase === phase)!;
      expect(row.stats.deadShare).toBeLessThanOrEqual(ceiling.deadShare);
      expect(row.stats.longest).toBeLessThanOrEqual(ceiling.longest);
    }
  });

  it("scores at least the floor", () => {
    expect(card.total).toBeGreaterThanOrEqual(GATE_CAP);
    // A known gate miss caps the total; the uncapped score is the real one.
    if (KNOWN_GATE_MISSES.length === 0)
      expect(card.total).toBeGreaterThanOrEqual(UNCAPPED_FLOOR);
    expect(card.uncapped).toBeGreaterThanOrEqual(UNCAPPED_FLOOR);
  });

  it("takes 2 to 3 hours for the realistic bot", () => {
    const hours = card.runs.realisticFinish! / HOUR;
    expect(hours).toBeGreaterThanOrEqual(2);
    expect(hours).toBeLessThanOrEqual(3);
  });

  it("lets the idle bot finish within 4 hours, never before the eager bot", () => {
    const { idleFinish, tapperFinish } = card.runs;
    expect(idleFinish).not.toBeNull();
    expect(idleFinish! / HOUR).toBeLessThanOrEqual(4);
    expect(idleFinish!).toBeGreaterThanOrEqual(tapperFinish!);
  });

  it("keeps phase lengths near 30/35/35/20 minutes (each within 30%)", () => {
    const outside = Object.entries(TARGET_MINUTES)
      .filter(
        ([phase, target]) =>
          !(
            Math.abs(realisticMinutes[phase] - target) / target <=
            LENGTH_TOLERANCE
          )
      )
      .map(([phase]) => `${phase} ${realisticMinutes[phase]?.toFixed(1)} min`);
    expect(outside).toEqual([]);
  });

  it("is deterministic", () => {
    expect(scoreUniverse(def, { bots: growBots() }).uncapped).toBeCloseTo(
      card.uncapped,
      6
    );
  });
});
