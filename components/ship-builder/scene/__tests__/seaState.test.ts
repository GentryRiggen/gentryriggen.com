import {
  isSeaState,
  SEA_FAR_END,
  SEA_NEAR_FACTOR,
  SEA_STATES,
  seaFade,
  seaHeight,
  seaParams,
  SEA_WAVES,
} from "../seaState";
import {
  WAVES as SIM_WAVES,
  WILD_WAVES,
} from "@/lib/ship-builder/sim/seaWaves";
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

describe("the wild sea", () => {
  it("is rougher than stormy, overcast and fully clouded", () => {
    const wild = seaParams("wild");
    const stormy = seaParams("stormy");
    for (const key of ["amplitude", "speed", "bobScale", "rollScale"] as const)
      expect(wild[key]).toBeGreaterThan(stormy[key]);
    expect(wild.cloudCover).toBe(1);
    expect(wild.overcast).toBeGreaterThanOrEqual(stormy.overcast);
  });

  it("is never one of the main-screen seas", () => {
    expect(SEA_STATES).toEqual(["calm", "choppy", "stormy"]);
    expect(isSeaState("wild")).toBe(false);
  });

  it("only uses the wild components, and the others only the three", () => {
    const wild = seaParams("wild").weights;
    const calm = seaParams("calm").weights;
    expect(wild.slice(0, SIM_WAVES.length).every((w) => w === 0)).toBe(true);
    expect(calm.slice(SIM_WAVES.length).every((w) => w === 0)).toBe(true);
    for (const sea of [...SEA_STATES, "wild" as const]) {
      const { weights } = seaParams(sea);
      expect(weights).toHaveLength(SEA_WAVES.length);
      expect(weights.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1);
    }
  });
});

describe("SEA_WAVES mirror the sim's waves", () => {
  it("has the sim's three waves, then its six wild ones", () => {
    const sim = [...SIM_WAVES, ...WILD_WAVES];
    expect(SEA_WAVES).toHaveLength(sim.length);
    SEA_WAVES.forEach((wave, i) => {
      expect(wave.dirX).toBe(sim[i].dirX);
      expect(wave.dirY).toBe(sim[i].dirY);
      expect(wave.wavelength).toBe(sim[i].wavelength);
      expect(wave.omega).toBe(sim[i].omega);
    });
    // The weights per sea are the sim's weights.
    const calm = seaParams("calm").weights;
    const wild = seaParams("wild").weights;
    SIM_WAVES.forEach((wave, i) => expect(calm[i]).toBe(wave.weight));
    WILD_WAVES.forEach((wave, i) =>
      expect(wild[SIM_WAVES.length + i]).toBe(wave.weight)
    );
    // The wild sea keeps the sim's phases; the three keep the scene's own 0.
    WILD_WAVES.forEach((wave, i) =>
      expect(SEA_WAVES[SIM_WAVES.length + i].phase).toBe(wave.phase)
    );
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
  it("keeps the calm, choppy and stormy surface as it was", () => {
    // The three-wave sum the scene drew before the wild sea was added.
    const legacy = (x: number, y: number, t: number, amplitude: number) => {
      const sum = SIM_WAVES.reduce((total, w) => {
        const k = (Math.PI * 2) / w.wavelength;
        return (
          total +
          w.weight * Math.sin(k * (w.dirX * x + w.dirY * y) + w.omega * t)
        );
      }, 0);
      return sum * amplitude * seaFade(Math.hypot(x, y));
    };
    for (const sea of SEA_STATES) {
      const { amplitude, weights } = seaParams(sea);
      for (const [x, y, t] of [
        [0, 0, 0],
        [10, 5, 3],
        [-7, 12, 9.5],
        [30, -20, 41],
      ]) {
        expect(seaHeight(x, y, t, amplitude, weights)).toBeCloseTo(
          legacy(x, y, t, amplitude),
          10
        );
        expect(seaHeight(x, y, t, amplitude)).toBeCloseTo(
          legacy(x, y, t, amplitude),
          10
        );
      }
    }
  });

  it("is bigger in the wild sea than stormy, still clear of the deck", () => {
    const peakOf = (sea: "stormy" | "wild") => {
      const { amplitude, weights } = seaParams(sea);
      let peak = 0;
      for (let x = -8; x <= 8; x += 0.5)
        for (let y = -8; y <= 8; y += 0.5)
          for (let t = 0; t < 20 && Math.hypot(x, y) <= 8; t += 0.7)
            peak = Math.max(
              peak,
              Math.abs(seaHeight(x, y, t, amplitude, weights))
            );
      return peak;
    };
    expect(peakOf("wild")).toBeGreaterThan(peakOf("stormy"));
    expect(peakOf("wild")).toBeLessThanOrEqual(0.5);
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
