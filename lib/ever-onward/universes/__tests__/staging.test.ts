import { lockedUniverses, playableUniverses } from "../staging";

describe("staging", () => {
  it("shows only released universes in production", () => {
    expect(playableUniverses(false).map((u) => u.id)).toEqual(["light"]);
    expect(lockedUniverses(false).map((u) => u.id)).toEqual([
      "grow",
      "higher",
      "smile",
    ]);
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
