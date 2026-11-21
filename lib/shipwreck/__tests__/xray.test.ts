import { PLACE_IDS, PLACES, waterHereText } from "../places";
import { titanic } from "../ships/titanic";
import { buildHull } from "../sim/geometry";
import type { BodyPose } from "../sim/track";
import {
  compartmentSamples,
  depthOver,
  earthZ,
  partAt,
  partCompartments,
  waterLevel,
} from "../xray";

const hull = buildHull(titanic);
const level = (p: Partial<BodyPose> = {}): BodyPose => ({
  part: "whole",
  x: 0,
  y: 0,
  z: -10,
  pitch: 0,
  roll: 0,
  yaw: 0,
  ...p,
});
const br6 = titanic.compartments.find((c) => c.id === "br6")!;

describe("waterLevel", () => {
  const s = compartmentSamples(hull, br6);

  it("is dry at 0 and full at 1", () => {
    expect(waterLevel(s, level(), 0)).toBe(-Infinity);
    expect(waterLevel(s, level(), 1)).toBe(Infinity);
  });

  it("rises with the fill, from the keel to the bulkhead tops", () => {
    const keel = -10;
    const top = -10 + Math.min(br6.aftBulkheadTopZ, br6.fwdBulkheadTopZ);
    let last = -Infinity;
    for (const f of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      const l = waterLevel(s, level(), f);
      expect(l).toBeGreaterThan(last);
      expect(l).toBeGreaterThan(keel);
      expect(l).toBeLessThan(top + 1);
      last = l;
    }
  });

  it("stays level with the earth when she trims (same volume, same level)", () => {
    // A level ship sunk deeper by Δ: the level moves by Δ.
    const a = waterLevel(s, level({ z: -10 }), 0.4);
    const b = waterLevel(s, level({ z: -14 }), 0.4);
    expect(a - b).toBeCloseTo(4, 1);
    // Trimmed: the level is still a single earth height between the
    // compartment's lowest and highest points.
    const pose = level({ pitch: 0.2 });
    const l = waterLevel(s, pose, 0.5);
    const lo = earthZ(pose, br6.toX, 0, 0);
    const hi = earthZ(pose, br6.fromX, 0, 15);
    expect(l).toBeGreaterThan(lo);
    expect(l).toBeLessThan(hi);
  });

  it("a half-full box-ish compartment stands about half way up", () => {
    const l = waterLevel(s, level({ z: 0 }), 0.5);
    expect(l).toBeGreaterThan(5);
    expect(l).toBeLessThan(10);
  });
});

describe("depthOver", () => {
  it("measures water over a floor point", () => {
    expect(depthOver(level({ z: 0 }), [60, 0, 1.6], 4.1)).toBeCloseTo(2.5);
    expect(depthOver(level({ z: 0 }), [60, 0, 1.6], 1)).toBe(0);
    expect(depthOver(level(), [60, 0, 1.6], -Infinity)).toBe(0);
  });
});

describe("parts", () => {
  it("splits compartments at the break", () => {
    const bow = partCompartments(titanic, "bow", -27.1);
    const stern = partCompartments(titanic, "stern", -27.1);
    const whole = partCompartments(titanic, "whole", null);
    expect(whole).toHaveLength(16);
    expect(bow.length + stern.length).toBe(16);
    expect(bow.every((p) => p.fromX >= -27.1)).toBe(true);
    expect(stern.every((p) => p.toX <= -27.1)).toBe(true);
    // A break inside a compartment gives a piece to each half.
    const b2 = partCompartments(titanic, "bow", -40);
    const s2 = partCompartments(titanic, "stern", -40);
    expect(b2.length + s2.length).toBe(17);
  });

  it("partAt picks the half by x", () => {
    expect(partAt(-27.1, true, 60)).toBe("bow");
    expect(partAt(-27.1, true, -60)).toBe("stern");
    expect(partAt(-27.1, false, -60)).toBe("whole");
    expect(partAt(null, true, 0)).toBe("whole");
  });
});

describe("places", () => {
  it("each place sits in its compartment and inside the ship", () => {
    for (const id of PLACE_IDS) {
      const p = PLACES[id];
      expect(p.id).toBe(id);
      expect(p.fact.length).toBeGreaterThan(30);
      expect(p.at[0]).toBeGreaterThan(-138);
      expect(p.at[0]).toBeLessThan(130);
      expect(p.floorZ).toBeLessThanOrEqual(p.at[2]);
      if (p.compartmentId) {
        const c = titanic.compartments.find((k) => k.id === p.compartmentId);
        expect(c).toBeDefined();
        expect(p.at[0]).toBeGreaterThanOrEqual(c!.fromX);
        expect(p.at[0]).toBeLessThanOrEqual(c!.toX);
      }
    }
  });

  it("matches the plans: the bridge forward of the staircase, boiler room 6 between E and F, the engines aft", () => {
    expect(PLACES.bridge.at[0]).toBeGreaterThan(
      PLACES["grand-staircase"].at[0]
    );
    expect(PLACES["engine-room"].at[0]).toBeLessThan(0);
    expect(PLACES.bridge.floorZ).toBeGreaterThan(27);
  });

  it("says the water depth plainly", () => {
    expect(waterHereText(0)).toBe("Dry here");
    expect(waterHereText(2.13)).toBe("Water here: 2.1 m deep");
    expect(waterHereText(14.6)).toBe("Water here: 15 m deep");
  });
});
