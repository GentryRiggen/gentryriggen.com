import { concordia } from "../../ships/concordia";
import { CONCORDIA_INTERIOR } from "../concordia";
import {
  landingStop,
  LIFT_DWELL_S,
  LIFT_SPEED_MS,
  liftAt,
  liftById,
  liftLanding,
  liftRideS,
  liftRideZ,
  liftStopZ,
  nextStop,
  otherCarZ,
} from "../lift";

const lifts = CONCORDIA_INTERIOR.lifts!;
const liftA = lifts[0];
const top = liftA.stops.length - 1;
/** Her stops' decks, bottom to top. */
const decks = liftA.stops.map((s) => s.deck);

describe("the glass lift ride", () => {
  it("stops at the low lobby (deck 0 + 0.4 m), 3, 4, 5 and 7", () => {
    expect(decks).toEqual(["0", "3", "4", "5", "7"]);
    const z0 = concordia.decks.find((d) => d.name === "0")!.z;
    const z7 = concordia.decks.find((d) => d.name === "7")!.z;
    // Her sheer is the same offset for every deck at one x.
    expect(
      liftStopZ(liftA, concordia, top) - liftStopZ(liftA, concordia, 0)
    ).toBeCloseTo(z7 - (z0 + 0.4), 6);
  });

  it("starts at the from stop's floor and ends at the to stop's, every pair", () => {
    for (let a = 0; a <= top; a += 1)
      for (let b = 0; b <= top; b += 1) {
        if (a === b) continue;
        const len = liftRideS(liftA, concordia, a, b);
        expect(liftRideZ(liftA, concordia, a, b, 0)).toBeCloseTo(
          liftStopZ(liftA, concordia, a),
          9
        );
        expect(liftRideZ(liftA, concordia, a, b, len)).toBeCloseTo(
          liftStopZ(liftA, concordia, b),
          9
        );
        // Before and after: held at the ends.
        expect(liftRideZ(liftA, concordia, a, b, -1)).toBeCloseTo(
          liftStopZ(liftA, concordia, a),
          9
        );
        expect(liftRideZ(liftA, concordia, a, b, len + 5)).toBeCloseTo(
          liftStopZ(liftA, concordia, b),
          9
        );
      }
  });

  it("never goes faster than 1.5 m/s and always moves toward the arrival", () => {
    const dt = 1 / 120;
    for (const [a, b] of [
      [0, top],
      [top, 0],
      [1, 2],
      [3, 2],
      [2, top],
    ]) {
      const len = liftRideS(liftA, concordia, a, b);
      const dir = Math.sign(
        liftStopZ(liftA, concordia, b) - liftStopZ(liftA, concordia, a)
      );
      let prev = liftRideZ(liftA, concordia, a, b, 0);
      let fastest = 0;
      for (let s = dt; s <= len + dt; s += dt) {
        const z = liftRideZ(liftA, concordia, a, b, s);
        const v = (z - prev) / dt;
        expect(v * dir).toBeGreaterThanOrEqual(-1e-9);
        fastest = Math.max(fastest, Math.abs(v));
        prev = z;
      }
      expect(fastest).toBeLessThanOrEqual(LIFT_SPEED_MS + 1e-6);
    }
  });

  it("one straight ride bottom to top takes 11–14 s (the formula: taps go a stop at a time, four legs about 17 s)", () => {
    const up = liftRideS(liftA, concordia, 0, top);
    expect(up).toBeGreaterThanOrEqual(11);
    expect(up).toBeLessThanOrEqual(14);
    expect(liftRideS(liftA, concordia, top, 0)).toBeCloseTo(up, 9);
    // What a kid rides: four legs, each easing in and out.
    let legs = 0;
    for (let i = 0; i < top; i += 1)
      legs += liftRideS(liftA, concordia, i, i + 1);
    expect(legs).toBeGreaterThan(up);
    expect(legs).toBeGreaterThan(16);
    expect(legs).toBeLessThan(18);
    // One deck takes a few seconds (eases in and out).
    const one = liftRideS(liftA, concordia, 1, 2);
    expect(one).toBeGreaterThan(2);
    expect(one).toBeLessThan(4);
  });

  it("skips a wet stop going that way and returns null with no dry stop that way", () => {
    const wet = new Set(["4"]);
    const dry = (s: { deck: string }) => !wet.has(s.deck);
    // From 3 up: 4 is wet, so 5.
    expect(nextStop(liftA, 1, 1, dry)).toBe(3);
    expect(nextStop(liftA, 1, -1, dry)).toBe(0);
    // The low lobby flooded: nothing below 3.
    wet.add("0");
    expect(nextStop(liftA, 1, -1, dry)).toBeNull();
    // From the top down past 5 and the wet 4 to 3.
    wet.add("5");
    expect(nextStop(liftA, top, -1, dry)).toBe(1);
    expect(nextStop(liftA, top, 1, dry)).toBeNull();
    expect(nextStop(liftA, 0, -1, () => true)).toBeNull();
  });

  it("the other car's loop visits every stop, dwelling, within the shaft", () => {
    const zs = liftA.stops.map((_, i) => liftStopZ(liftA, concordia, i));
    const lo = zs[0];
    const hi = zs[top];
    const parked = new Set<number>();
    for (let t = 0; t < 200; t += 0.25) {
      const z = otherCarZ(liftA, concordia, t);
      expect(z).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(z).toBeLessThanOrEqual(hi + 1e-9);
      const at = zs.findIndex((s) => Math.abs(s - z) < 1e-9);
      if (at >= 0) parked.add(at);
    }
    expect([...parked].sort()).toEqual([0, 1, 2, 3, 4]);
    // It starts parked at the bottom for the dwell.
    expect(otherCarZ(liftA, concordia, LIFT_DWELL_S / 2)).toBeCloseTo(lo, 9);
    // Never faster than the ride either.
    let prev = otherCarZ(liftA, concordia, 0);
    for (let t = 0.05; t < 150; t += 0.05) {
      const z = otherCarZ(liftA, concordia, t);
      expect(Math.abs(z - prev) / 0.05).toBeLessThanOrEqual(
        LIFT_SPEED_MS + 1e-6
      );
      prev = z;
    }
  });

  it("finds a car area's shaft, stop and landing; any other area is none", () => {
    expect(liftById(CONCORDIA_INTERIOR, "lift-b")).toBe(lifts[1]);
    expect(liftAt(CONCORDIA_INTERIOR, "lift-a@3")).toEqual({
      lift: liftA,
      stop: 1,
    });
    expect(liftLanding(CONCORDIA_INTERIOR, "lift-b@0")).toBe("lobby-1");
    expect(liftLanding(CONCORDIA_INTERIOR, "lift-b@7")).toBe("lobby-7");
    expect(liftAt(CONCORDIA_INTERIOR, "atrium-3")).toBeNull();
    expect(liftAt({}, "lift-a@3")).toBeNull();
    expect(landingStop(liftA, "atrium-5")).toBe(3);
    expect(landingStop(liftA, "theatre")).toBe(-1);
  });
});
