import { STABILITY_THRESHOLDS } from "@/lib/ship-builder/model/stats";
import {
  BOB_AMPLITUDE,
  BOB_PERIOD,
  bobPose,
  createShipPose,
  rollAmplitudeDeg,
} from "../bob";

const RAD_PER_DEG = Math.PI / 180;

describe("rollAmplitudeDeg", () => {
  it("is about 1 degree for a level, stable ship", () => {
    expect(rollAmplitudeDeg(0)).toBeCloseTo(1);
  });

  it("reaches about 4 degrees at the Dangerous threshold", () => {
    expect(rollAmplitudeDeg(STABILITY_THRESHOLDS.dangerous)).toBeCloseTo(4);
  });

  it("grows with the ratio and stops growing past Dangerous", () => {
    expect(rollAmplitudeDeg(0.15)).toBeCloseTo(2.5);
    expect(rollAmplitudeDeg(0.9)).toBeCloseTo(4);
  });

  it("treats a negative ratio as level", () => {
    expect(rollAmplitudeDeg(-0.2)).toBeCloseTo(1);
  });
});

describe("bobPose", () => {
  it("rises and falls by 0.05 over a 4 second period", () => {
    const out = createShipPose();
    expect(bobPose(0, 0, out).y).toBeCloseTo(0);
    expect(bobPose(BOB_PERIOD / 4, 0, out).y).toBeCloseTo(BOB_AMPLITUDE);
    expect(bobPose(BOB_PERIOD, 0, out).y).toBeCloseTo(0);
    expect(bobPose(BOB_PERIOD * 0.75, 0, out).y).toBeCloseTo(-BOB_AMPLITUDE);
  });

  it("never rolls past its amplitude", () => {
    const out = createShipPose();
    let peak = 0;
    for (let t = 0; t < 20; t += 0.05) {
      peak = Math.max(peak, Math.abs(bobPose(t, 0, out).roll));
    }
    expect(peak / RAD_PER_DEG).toBeLessThanOrEqual(1.0001);
    expect(peak / RAD_PER_DEG).toBeGreaterThan(0.99);
  });

  it("rolls further for a top-heavy ship", () => {
    const out = createShipPose();
    const peak = (ratio: number) => {
      let max = 0;
      for (let t = 0; t < 20; t += 0.05) {
        max = Math.max(max, Math.abs(bobPose(t, ratio, out).roll));
      }
      return max;
    };
    expect(peak(0.3)).toBeGreaterThan(peak(0) * 3.9);
  });

  it("keeps pitch tiny", () => {
    const out = createShipPose();
    for (let t = 0; t < 20; t += 0.1) {
      expect(Math.abs(bobPose(t, 0.3, out).pitch)).toBeLessThan(
        0.5 * RAD_PER_DEG
      );
    }
  });

  it("reuses the object it is given", () => {
    const out = createShipPose();
    expect(bobPose(1, 0, out)).toBe(out);
  });
});
