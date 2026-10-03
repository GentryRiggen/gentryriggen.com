import {
  AUTOSAVE_KEY,
  deleteShip,
  listShips,
  loadAutosave,
  renameShip,
  saveAutosave,
  saveShip,
  SHIPS_KEY,
} from "../local";
import { gridPart, testShip } from "../../testing";

const ship = testShip([gridPart("a", "deck-1x1", 0, 0, 0)]);

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe("autosave", () => {
  it("round-trips the ship and savedId", () => {
    expect(saveAutosave(ship, "ship-1")).toBe(true);
    expect(loadAutosave()).toEqual({ ship, savedId: "ship-1" });
  });

  it("returns null for missing, corrupt or invalid data", () => {
    expect(loadAutosave()).toBeNull();
    localStorage.setItem(AUTOSAVE_KEY, "{not json");
    expect(loadAutosave()).toBeNull();
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ ship: { v: 9 } }));
    expect(loadAutosave()).toBeNull();
  });

  it("returns false when storage throws", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveAutosave(ship, null)).toBe(false);
  });

  it("returns null when reading throws", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(loadAutosave()).toBeNull();
    expect(listShips()).toEqual([]);
  });
});

describe("My Ships", () => {
  it("saves, lists newest first, and updates in place", () => {
    const first = saveShip({ ...ship, name: "One" }, null, 1000);
    const second = saveShip({ ...ship, name: "Two" }, null, 2000);
    expect(first && second).toBeTruthy();
    expect(listShips().map((s) => s.name)).toEqual(["Two", "One"]);

    saveShip({ ...ship, name: "One v2" }, first!.id, 3000);
    const names = listShips().map((s) => s.name);
    expect(names).toEqual(["One v2", "Two"]);
  });

  it("renames and deletes", () => {
    const saved = saveShip(ship, null)!;
    expect(renameShip(saved.id, "Olympic")).toBe(true);
    expect(listShips()[0].name).toBe("Olympic");
    expect(listShips()[0].ship.name).toBe("Olympic");
    expect(deleteShip(saved.id)).toBe(true);
    expect(listShips()).toEqual([]);
  });

  it("clamps a long rename so the entry stays listed", () => {
    const saved = saveShip(ship, null)!;
    expect(renameShip(saved.id, "x".repeat(80))).toBe(true);
    const [entry] = listShips();
    expect(entry.id).toBe(saved.id);
    expect(entry.name).toHaveLength(60);
    expect(entry.ship.name).toHaveLength(60);
  });

  it("does not overwrite the list when reading it throws", () => {
    saveShip(ship, null);
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const setItem = jest.spyOn(Storage.prototype, "setItem");
    expect(saveShip(ship, null)).toBeNull();
    expect(renameShip("any", "Olympic")).toBe(false);
    expect(deleteShip("any")).toBe(false);
    expect(setItem).not.toHaveBeenCalledWith(SHIPS_KEY, expect.anything());
  });

  it("skips corrupt entries", () => {
    localStorage.setItem(
      SHIPS_KEY,
      JSON.stringify([
        { id: "ok", name: "Fine", savedAt: 1, ship },
        { id: "bad", name: "Broken", savedAt: 2, ship: { v: 1 } },
        "junk",
      ])
    );
    expect(listShips().map((s) => s.id)).toEqual(["ok"]);
  });

  it("returns null when saving fails", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveShip(ship, null)).toBeNull();
  });
});
