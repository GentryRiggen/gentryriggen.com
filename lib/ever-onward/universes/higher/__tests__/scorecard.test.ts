import { scoreUniverse, type Scorecard } from "../../../engine/score";
import { simulate } from "../../../engine/sim";
import { higherBots } from "../bots";
import { def } from "./fixtures";

/**
 * Build It Higher's Engagement Scorecard, the regression floor for universe
 * 3. The lab notebook (docs/ever-onward/lab-notebook.md, "Build It Higher,
 * round 1") records how it got here. Run `npm run score:ever-onward -- higher`
 * for the table. Like the others, it simulates every bot (a few seconds).
 */
jest.setTimeout(180_000);

/**
 * Round 1 took the first build from 76.3 (capped to 59 by failing M1 reveal
 * gaps) to 83.9 with no failing gate. The floor is that minus 1. Raise it as
 * rounds land.
 *
 * The Town's foremen and shadow (three dials on top of the build pace) cost
 * about a point and a half: the town reads busier on the reveal and decision
 * metrics, and a player who never touches the dials is a little further
 * behind (idle / eager 1.8x). 82.3 is the town's 82.6 minus a margin.
 *
 * The Sky's wind, cable strain and no-crane climb cost another point and a
 * half (more reveal and log events, idle / eager 1.95x, one decision gap near
 * minute 6). The sky scored 81.2.
 *
 * The town's fix round (a lights switch, honest foreman pay, an eased dark)
 * earned it back to 81.8 with every gate uncapped. 81.3 is that minus half a
 * point. What is still short of the town's old 84.4: reveals (M1: a story
 * line or two per minute, a few plates a few seconds after their reveal) and
 * idle / eager 1.99x (an unattended Town takes about 70 min, the dials are
 * worth a lot).
 *
 * The Sky's fix round (a strain dial that moves with the clouds, honest copy)
 * scores 82.4 uncapped, so the floor is 81.9 (that minus half a point).
 */
const GATE_CAP = 59;
const UNCAPPED_FLOOR = 81.9;

const HOUR = 3600;

/** Minutes a realistic player should spend in each phase. */
const TARGET_MINUTES = { playroom: 25, town: 35, sky: 35, top: 20 };
const LENGTH_TOLERANCE = 0.3;

describe("Build It Higher engagement scorecard", () => {
  let card: Scorecard;
  let realisticMinutes: Record<string, number>;

  beforeAll(() => {
    card = scoreUniverse(def, { bots: higherBots() });
    const realistic = simulate(def, {
      maxSeconds: 6 * HOUR,
      step: 1,
      strategy: higherBots().realistic,
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

  it("has no failing gate (decision gaps included)", () => {
    expect(card.failingGates).toEqual([]);
    const m16 = card.metrics.find((m) => m.id === "M16")!;
    expect(m16.perPhase.every((row) => row.gate)).toBe(true);
  });

  it("scores at least the floor", () => {
    expect(card.total).toBeGreaterThanOrEqual(GATE_CAP);
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

  it("keeps phase lengths near 25/35/35/20 minutes (each within 30%)", () => {
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
    expect(scoreUniverse(def, { bots: higherBots() }).uncapped).toBeCloseTo(
      card.uncapped,
      6
    );
  });
});
