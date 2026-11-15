import { isUnlocked, nextUnlock, unlocksBetween } from "../unlocks";

describe("unlocks", () => {
  it("lists what a point jump crosses, in order", () => {
    expect(unlocksBetween(0, 100)).toEqual([
      { kind: "tool", id: "meteorShower" },
      { kind: "tool", id: "megaBomb" },
    ]);
  });

  it("starts with the asteroid and Earth", () => {
    expect(isUnlocked({ kind: "tool", id: "asteroid" }, 0)).toBe(true);
    expect(isUnlocked({ kind: "planet", id: "earth" }, 0)).toBe(true);
    expect(isUnlocked({ kind: "tool", id: "nuke" }, 159)).toBe(false);
    expect(isUnlocked({ kind: "tool", id: "nuke" }, 160)).toBe(true);
  });

  it("has nothing after the last unlock", () => {
    expect(nextUnlock(109000)).toBeNull();
    expect(nextUnlock(4750)?.item).toEqual({
      kind: "tool",
      id: "supervolcano",
    });
    expect(nextUnlock(0)?.at).toBe(25);
  });
});
