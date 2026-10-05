import { SHIP_KINDS } from "../../model/kinds";
import { handlingFromShip } from "../handling";
import type { SailShip } from "../types";

const base: SailShip = {
  kind: "liner",
  length: 20,
  beam: 5,
  topSpeedKnots: 20,
  grossTonnage: 20000,
};

describe("handlingFromShip", () => {
  it("is finite and positive for every kind", () => {
    for (const kind of SHIP_KINDS) {
      const h = handlingFromShip({ ...base, kind });
      for (const v of Object.values(h)) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThan(0);
      }
    }
  });
  it("turns navy faster than cargo of the same size", () => {
    const navy = handlingFromShip({ ...base, kind: "navy" });
    const cargo = handlingFromShip({ ...base, kind: "cargo" });
    expect(navy.maxTurnRate).toBeGreaterThan(cargo.maxTurnRate);
  });
  it("turns a longer ship more slowly", () => {
    const short = handlingFromShip({ ...base, length: 12 });
    const long = handlingFromShip({ ...base, length: 36 });
    expect(long.maxTurnRate).toBeLessThan(short.maxTurnRate);
  });
  it("takes a heavier ship longer to get up to speed", () => {
    const light = handlingFromShip({ ...base, grossTonnage: 2000 });
    const heavy = handlingFromShip({ ...base, grossTonnage: 90000 });
    expect(heavy.accelSeconds).toBeGreaterThan(light.accelSeconds);
  });
  it("scales top speed with knots", () => {
    const slow = handlingFromShip({ ...base, topSpeedKnots: 10 });
    const fast = handlingFromShip({ ...base, topSpeedKnots: 20 });
    expect(fast.topSpeed).toBeCloseTo(slow.topSpeed * 2);
  });
});
