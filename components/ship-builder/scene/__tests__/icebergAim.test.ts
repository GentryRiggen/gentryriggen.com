import {
  ICEBERG_APPROACH,
  ICEBERG_IMPACT_S,
  ICEBERG_SLIDE_S,
  icebergOffset,
} from "../icebergMotion";
import { hullXOfImpact, impactXFromHit } from "../icebergAim";

describe("impactXFromHit", () => {
  it("counts cells from the bow, which faces +X", () => {
    expect(impactXFromHit(30, 60)).toBe(0);
    expect(impactXFromHit(0, 60)).toBe(30);
    expect(impactXFromHit(-30, 60)).toBe(60);
    expect(impactXFromHit(12, 60)).toBe(18);
  });

  it("clamps taps on the rounded ends inside the hull", () => {
    expect(impactXFromHit(34, 60)).toBe(0);
    expect(impactXFromHit(-40, 60)).toBe(60);
  });

  it("round-trips with hullXOfImpact", () => {
    expect(impactXFromHit(hullXOfImpact(18, 60), 60)).toBe(18);
  });
});

describe("icebergOffset", () => {
  it("starts ahead, meets the hull on impact and slides past", () => {
    expect(icebergOffset(0)).toBe(ICEBERG_APPROACH);
    expect(icebergOffset(ICEBERG_IMPACT_S)).toBeCloseTo(0, 6);
    expect(icebergOffset(ICEBERG_SLIDE_S)).toBeCloseTo(-ICEBERG_APPROACH, 6);
  });

  it("then drifts away slowly and stops", () => {
    const after = icebergOffset(ICEBERG_SLIDE_S + 2);
    expect(after).toBeLessThan(-ICEBERG_APPROACH);
    expect(icebergOffset(1000)).toBe(icebergOffset(2000));
  });
});
