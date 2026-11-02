import { lockedUniverses, playableUniverses } from "../staging";

describe("staging", () => {
  it("shows only released universes in production", () => {
    expect(playableUniverses(false).map((u) => u.id)).toEqual([
      "light",
      "grow",
      "higher",
    ]);
    expect(lockedUniverses(false).map((u) => u.id)).toEqual(["smile"]);
  });
  it("hides an unreleased universe in production", () => {
    expect(playableUniverses(false, ["grow"]).map((u) => u.id)).toEqual([
      "light",
      "higher",
    ]);
    expect(lockedUniverses(false, ["grow"]).map((u) => u.id)).toContain("grow");
  });
  it("never lists Grow as coming soon once it is released", () => {
    expect(playableUniverses(false, []).map((u) => u.id)).toContain("grow");
    expect(lockedUniverses(false, []).map((l) => l.id)).not.toContain("grow");
  });
  it("never lists Build It Higher as coming soon once it is built", () => {
    expect(playableUniverses(true).map((u) => u.id)).toContain("higher");
    expect(lockedUniverses(true).map((l) => l.id)).not.toContain("higher");
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
