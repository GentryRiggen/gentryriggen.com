import { isUnlocked, nextUnlock, unlocksBetween } from "../unlocks";

describe("unlocks", () => {
  it("lists what a point jump crosses, in order", () => {
    expect(unlocksBetween(25, 130)).toEqual([
      { kind: "tool", id: "meteorShower" },
      { kind: "tool", id: "megaBomb" },
    ]);
  });

  it("starts with the asteroid and Earth", () => {
    expect(isUnlocked({ kind: "tool", id: "asteroid" }, 0)).toBe(true);
    expect(isUnlocked({ kind: "planet", id: "earth" }, 0)).toBe(true);
    expect(isUnlocked({ kind: "tool", id: "nuke" }, 299)).toBe(false);
    expect(isUnlocked({ kind: "tool", id: "nuke" }, 300)).toBe(true);
  });

  it("has nothing after the last unlock", () => {
    expect(nextUnlock(13000)).toBeNull();
    expect(nextUnlock(5200)?.item).toEqual({ kind: "tool", id: "nukeTwin" });
    expect(nextUnlock(0)?.at).toBe(30);
  });
});
