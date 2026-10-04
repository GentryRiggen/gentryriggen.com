import {
  isSeaState,
  SEA_FAR_END,
  SEA_NEAR_FACTOR,
  SEA_STATES,
  seaFade,
  seaHeight,
  seaParams,
  WAVES,
} from "../seaState";
import { bobPose, createShipPose } from "../bob";

describe("seaParams", () => {
  it("gets rougher from calm to stormy", () => {
    const [calm, choppy, stormy] = SEA_STATES.map(seaParams);
    for (const key of [
      "amplitude",
      "speed",
      "bobScale",
      "rollScale",
    ] as const) {
      expect(calm[key]).toBeLessThan(choppy[key]);
      expect(choppy[key]).toBeLessThan(stormy[key]);
    }
  });

  it("keeps calm ship motion at today's values", () => {
    expect(seaParams("calm")).toMatchObject({ bobScale: 1, rollScale: 1 });
  });

  it("keeps calm waves barely visible", () => {
    expect(seaParams("calm").amplitude).toBeLessThanOrEqual(0.05);
  });
});

describe("isSeaState", () => {
  it("accepts only the three states", () => {
    expect(SEA_STATES.every(isSeaState)).toBe(true);
    expect(isSeaState("rough")).toBe(false);
    expect(isSeaState(null)).toBe(false);
  });
});

describe("seaFade", () => {
  it("damps waves beside the ship and removes them at the horizon", () => {
    expect(seaFade(0)).toBeCloseTo(SEA_NEAR_FACTOR);
    expect(seaFade(20)).toBeCloseTo(1);
    expect(seaFade(SEA_FAR_END)).toBe(0);
  });
});

describe("seaHeight", () => {
  it("has weights that sum to one", () => {
    expect(WAVES.reduce((sum, w) => sum + w.weight, 0)).toBeCloseTo(1);
  });

  it("stays within 0.35 units near the ship even when stormy", () => {
    const { amplitude } = seaParams("stormy");
    let peak = 0;
    for (let x = -8; x <= 8; x += 0.5)
      for (let y = -8; y <= 8; y += 0.5)
        for (let t = 0; t < 20 && Math.hypot(x, y) <= 8; t += 0.7)
          peak = Math.max(peak, Math.abs(seaHeight(x, y, t, amplitude)));
    expect(peak).toBeLessThanOrEqual(0.35);
  });

  it("is flat with zero amplitude and moves over time", () => {
    expect(seaHeight(10, 5, 3, 0)).toBeCloseTo(0);
    expect(seaHeight(10, 5, 0, 0.5)).not.toBeCloseTo(seaHeight(10, 5, 1, 0.5));
  });
});

describe("bobPose by sea state", () => {
  it("scales the bob and roll with the sea", () => {
    const peak = (sea: "calm" | "stormy") => {
      const out = createShipPose();
      let y = 0;
      let roll = 0;
      for (let t = 0; t < 60; t += 0.05) {
        bobPose(t, 0.1, out, sea);
        y = Math.max(y, Math.abs(out.y));
        roll = Math.max(roll, Math.abs(out.roll));
      }
      return { y, roll };
    };
    const calm = peak("calm");
    const stormy = peak("stormy");
    expect(stormy.y / calm.y).toBeCloseTo(seaParams("stormy").bobScale, 1);
    expect(stormy.roll / calm.roll).toBeCloseTo(
      seaParams("stormy").rollScale,
      1
    );
  });

  it("still rolls top-heavy ships more than stable ones in every sea", () => {
    const out = createShipPose();
    for (const sea of SEA_STATES) {
      let stable = 0;
      let heavy = 0;
      for (let t = 0; t < 30; t += 0.05) {
        stable = Math.max(stable, Math.abs(bobPose(t, 0, out, sea).roll));
        heavy = Math.max(heavy, Math.abs(bobPose(t, 0.3, out, sea).roll));
      }
      expect(heavy).toBeGreaterThan(stable);
    }
  });
});
