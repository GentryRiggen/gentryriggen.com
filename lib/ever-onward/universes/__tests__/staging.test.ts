import { lockedUniverses, playableUniverses } from "../staging";

describe("staging", () => {
  it("shows only released universes in production", () => {
    expect(playableUniverses(false).map((u) => u.id)).toEqual([
      "light",
      "grow",
    ]);
    expect(lockedUniverses(false).map((u) => u.id)).toEqual([
      "higher",
      "smile",
    ]);
  });
  it("hides an unreleased universe in production", () => {
    expect(playableUniverses(false, ["grow"]).map((u) => u.id)).toEqual([
      "light",
    ]);
    expect(lockedUniverses(false, ["grow"]).map((u) => u.id)).toContain("grow");
  });
  it("never lists Grow as coming soon once it is released", () => {
    expect(playableUniverses(false, []).map((u) => u.id)).toContain("grow");
    expect(lockedUniverses(false, []).map((l) => l.id)).not.toContain("grow");
  });
  it("never lists a universe as both playable and locked", () => {
    for (const shows of [true, false]) {
      const playable = new Set(playableUniverses(shows).map((u) => u.id));
      expect(lockedUniverses(shows).filter((l) => playable.has(l.id))).toEqual(
        []
      );
    }
  });
});
