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
 * far too short) to 83.9 with no failing gate. The floor is that minus 1.
 * Raise it as rounds land.
 */
const SCORE_FLOOR = 82.9;
const UNCAPPED_FLOOR = 82.9;

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

  it("has no failing gate", () => {
    expect(card.failingGates).toEqual([]);
  });

  it("scores at least the floor", () => {
    expect(card.total).toBeGreaterThanOrEqual(SCORE_FLOOR);
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
