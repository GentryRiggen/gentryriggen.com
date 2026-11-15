import {
  UNLOCK_PATH,
  isUnlocked,
  nextUnlock,
  ownedKey,
  unlocksBetween,
} from "../unlocks";

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
    expect(nextUnlock(UNLOCK_PATH.at(-1)!.at)).toBeNull();
    expect(nextUnlock(10000)?.item).toEqual({
      kind: "tool",
      id: "supervolcano",
    });
    expect(nextUnlock(0)?.at).toBe(25);
  });
});

describe("nextUnlock with owned items", () => {
  it("skips owned items above the points", () => {
    const first = nextUnlock(0)!;
    const second = nextUnlock(first.at)!;
    expect(nextUnlock(0, [ownedKey(first.item)])).toEqual(second);
    expect(nextUnlock(0, [ownedKey(second.item)])).toEqual(first);
  });
});
