import type { ShipSpec } from "../../ships/types";
import { HEADWAY_STOP_HALF_LIFE_S } from "../constants";
import { headwayRun, speedAt } from "../headway";
import { simulate } from "../run";
import type { SimFrame } from "../track";
import { threeShip } from "./testShips";

/**
 * A speed profile (1.4, the Britannic: full speed, the way taken off,
 * ahead again for Kea): [shown s, m/s] pairs, linear, her earth distance
 * the profile's integral while she floats; engines stopped at the first
 * event coast her down with HEADWAY_STOP_HALF_LIFE_S instead.
 */

const PROFILE = [
  [0, 10],
  [600, 10],
  [700, 0],
  [900, 4],
  [1000, 0],
] as const;
const H: NonNullable<ShipSpec["headway"]> = { startMs: 10, profile: PROFILE };
const ship = threeShip({ extra: { headway: H } });

const at = (frames: readonly SimFrame[], t: number): SimFrame =>
  frames.find((f) => f.t >= t - 1e-9) as SimFrame;
const x = (frames: readonly SimFrame[], t: number) => at(frames, t).bodies[0].x;

describe("the speed profile", () => {
  const track = simulate(ship, [], { endT: 1100 });

  it("carries her 6,000 m by 600 s at 10 m/s", () => {
    expect(Math.abs(x(track.frames, 600) - 6000)).toBeLessThan(60);
  });

  it("is half way down at 650 s", () => {
    expect(speedAt(H, 650)).toBeCloseTo(5, 9);
    const u = (x(track.frames, 652) - x(track.frames, 648)) / 4;
    expect(Math.abs(u - 5)).toBeLessThan(0.1);
  });

  it("integrates exactly over a step (the profile's area)", () => {
    // 0–1000 s: 6,000 + 500 + 400 + 200 m.
    expect(headwayRun(H, 0, 1000)).toBeCloseTo(7100, 6);
    expect(headwayRun(H, 1000, 1100)).toBe(0); // held at 0 past the end
    expect(headwayRun(H, 620, 680)).toBeCloseTo(
      ((8 + 2) / 2) * 60, // 8 m/s at 620, 2 m/s at 680
      9
    );
  });

  it("enginesStopped: she coasts with the stop half-life", () => {
    const stopped = simulate(ship, [], { endT: 700, enginesStopped: true });
    const k = Math.LN2 / HEADWAY_STOP_HALF_LIFE_S;
    for (const t of [100, 300, 600]) {
      const want = (10 / k) * (1 - Math.exp(-k * t));
      expect(Math.abs(x(stopped.frames, t) / want - 1)).toBeLessThan(0.01);
      expect(speedAt(H, t, { enginesStopped: true })).toBeCloseTo(
        10 * Math.exp(-k * t),
        9
      );
    }
  });

  it("no profile: headwayRun is unchanged", () => {
    expect(headwayRun({ startMs: 7 }, 10, 110)).toBe(700);
    expect(headwayRun({ startMs: 7 }, 10, 110, null, {})).toBe(700);
    const k = Math.LN2 / 120;
    expect(headwayRun({ startMs: 7, halfLifeS: 120 }, 0, 60)).toBe(
      (7 / k) * (Math.exp(-k * 0) - Math.exp(-k * 60))
    );
    expect(headwayRun(undefined, 0, 60)).toBe(0);
    expect(speedAt({ startMs: 7 }, 500)).toBe(7);
  });
});
