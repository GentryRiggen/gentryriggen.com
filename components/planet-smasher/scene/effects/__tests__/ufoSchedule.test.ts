import { UFO_COUNT, ufoSchedule } from "../UfoSwarm";

describe("ufoSchedule", () => {
  const all = Array.from({ length: UFO_COUNT }, (_, i) => ufoSchedule(i));

  it("has twelve saucers", () => {
    expect(UFO_COUNT).toBe(12);
  });

  it("arrives, beams, then leaves, in that order", () => {
    for (const s of all) {
      expect(s.arriveAt).toBeLessThan(s.beamAt);
      expect(s.beamAt).toBeLessThan(s.leaveAt);
    }
  });

  it("starts the beams one after another", () => {
    for (let i = 1; i < all.length; i++) {
      expect(all[i].beamAt).toBeGreaterThan(all[i - 1].beamAt);
    }
  });

  it("staggers the arrivals 0.15 s apart", () => {
    for (let i = 1; i < all.length; i++) {
      expect(all[i].arriveAt - all[i - 1].arriveAt).toBeCloseTo(0.15, 5);
    }
  });

  it("beams for 0.9 s and finishes everything by 6 s", () => {
    for (const s of all) expect(s.leaveAt - s.beamAt).toBeCloseTo(0.9, 5);
    expect(Math.max(...all.map((s) => s.leaveAt))).toBeLessThanOrEqual(6);
  });
});
