import { STARTER_TIERS } from "../../plane/catalog";
import {
  COIN_ZONE_MULTIPLIER,
  GAUGE_PERIOD,
  LAUNCH_GAUGE_TIER,
  LAUNCH_ZONE_BOOST,
  gaugePosition,
  gaugeZone,
  hasLaunchGauge,
} from "../gauge";

describe("timing gauge", () => {
  it("sweeps end to end and back each period", () => {
    expect(gaugePosition(0)).toBe(0);
    expect(gaugePosition(GAUGE_PERIOD / 4)).toBeCloseTo(0.5);
    expect(gaugePosition(GAUGE_PERIOD / 2)).toBeCloseTo(1);
    expect(gaugePosition((GAUGE_PERIOD * 3) / 4)).toBeCloseTo(0.5);
    expect(gaugePosition(GAUGE_PERIOD)).toBeCloseTo(0);
    expect(gaugePosition(GAUGE_PERIOD * 10.25)).toBeCloseTo(0.5);
  });

  it("stays on the bar for odd input", () => {
    expect(gaugePosition(Number.NaN)).toBe(0);
    expect(gaugePosition(-0.4)).toBeGreaterThanOrEqual(0);
    expect(gaugePosition(-0.4)).toBeLessThanOrEqual(1);
  });

  it("is green in the middle, yellow beside it, red at the ends", () => {
    expect(gaugeZone(0.5)).toBe("green");
    expect(gaugeZone(0.555)).toBe("green");
    expect(gaugeZone(0.57)).toBe("yellow");
    expect(gaugeZone(0.4)).toBe("yellow");
    expect(gaugeZone(0.7)).toBe("yellow");
    expect(gaugeZone(0.2)).toBe("red");
    expect(gaugeZone(1)).toBe("red");
  });

  it("boosts launches in green, slows them in red", () => {
    expect(LAUNCH_ZONE_BOOST).toEqual({ green: 1.25, yellow: 1, red: 0.8 });
  });

  it("never takes coins away", () => {
    for (const m of Object.values(COIN_ZONE_MULTIPLIER))
      expect(m).toBeGreaterThanOrEqual(1);
  });

  it("arrives with the mid launcher tier", () => {
    expect(hasLaunchGauge(STARTER_TIERS)).toBe(false);
    expect(
      hasLaunchGauge({ ...STARTER_TIERS, launcher: LAUNCH_GAUGE_TIER })
    ).toBe(true);
  });
});
