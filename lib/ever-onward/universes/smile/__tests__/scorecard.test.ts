import { scoreUniverse, type Scorecard } from "../../../engine/score";
import { simulate } from "../../../engine/sim";
import { smileBots } from "../bots";
import { def } from "./fixtures";

/**
 * Make Everyone Smile's Engagement Scorecard, the regression floor for
 * universe 4. The lab notebook (docs/ever-onward/lab-notebook.md, "Make
 * Everyone Smile, round 1") records how it got here. Run `npm run
 * score:ever-onward -- smile` for the table. Like Grow's, it simulates every
 * bot (a few seconds).
 */
jest.setTimeout(180_000);

/**
 * The last round scored 83.3 with no failing gate (decision gaps included). The
 * floor is that minus 1. Raise it as rounds land.
 */
const GATE_CAP = 59;
const UNCAPPED_FLOOR = 83.1;

const HOUR = 3600;

/** Minutes a realistic player should spend in each phase. */
const TARGET_MINUTES = { friend: 30, town: 35, world: 35, quiet: 22 };
const LENGTH_TOLERANCE = 0.3;

describe("Make Everyone Smile engagement scorecard", () => {
  let card: Scorecard;
  let realisticMinutes: Record<string, number>;

  beforeAll(() => {
    card = scoreUniverse(def, { bots: smileBots() });
    const realistic = simulate(def, {
      maxSeconds: 6 * HOUR,
      step: 1,
      strategy: smileBots().realistic,
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

  it("has no failing gate, decision gaps (M16) included", () => {
    expect(card.failingGates).toEqual([]);
    const m16 = card.metrics.find((m) => m.id === "M16")!;
    expect(m16.gatePass).toBe(true);
    for (const row of m16.perPhase) expect(row.gate).toBe(true);
  });

  it("scores at least the floor", () => {
    expect(card.total).toBeGreaterThanOrEqual(GATE_CAP);
    // Nothing is capped: the total is the real score.
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

  it("keeps phase lengths near 30/35/35/22 minutes (each within 30%)", () => {
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
    expect(scoreUniverse(def, { bots: smileBots() }).uncapped).toBeCloseTo(
      card.uncapped,
      6
    );
  });
});
