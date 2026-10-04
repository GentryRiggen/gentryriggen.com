import {
  AUTOSAVE_KEY,
  deleteShip,
  listShips,
  loadAutosave,
  renameShip,
  saveAutosave,
  saveShip,
  SHIPS_BACKUP_KEY,
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

  describe("entries the app can't parse", () => {
    const future = {
      id: "future",
      name: "From a newer deploy",
      savedAt: 5,
      ship: { v: 2, name: "Future", hull: { lengthSegments: 8 }, parts: [] },
      extra: { kept: true },
    };

    function rawEntries(): unknown[] {
      return JSON.parse(localStorage.getItem(SHIPS_KEY) ?? "[]");
    }

    function storeWithFuture(): string {
      const saved = saveShip({ ...ship, name: "Valid" }, null, 1)!;
      localStorage.setItem(
        SHIPS_KEY,
        JSON.stringify([future, ...rawEntries()])
      );
      return saved.id;
    }

    it("hides them from the list", () => {
      storeWithFuture();
      expect(listShips().map((s) => s.name)).toEqual(["Valid"]);
    });

    it("keeps them through a delete of another id", () => {
      storeWithFuture();
      expect(deleteShip("nonexistent")).toBe(true);
      expect(rawEntries()).toContainEqual(future);
    });

    it("keeps them through a save", () => {
      storeWithFuture();
      expect(saveShip({ ...ship, name: "New" }, null, 9)).not.toBeNull();
      expect(rawEntries()).toContainEqual(future);
      expect(listShips().map((s) => s.name)).toEqual(["New", "Valid"]);
    });

    it("keeps them through a rename of a valid entry", () => {
      const id = storeWithFuture();
      expect(renameShip(id, "Renamed")).toBe(true);
      expect(rawEntries()).toContainEqual(future);
      expect(listShips().map((s) => s.name)).toEqual(["Renamed"]);
    });

    it("skips non-finite savedAt but keeps it in storage", () => {
      const saved = saveShip({ ...ship, name: "Valid" }, null, 1)!;
      localStorage.setItem(
        SHIPS_KEY,
        `[{"id":"inf","name":"Inf","savedAt":1e400,"ship":${JSON.stringify(
          ship
        )}},${JSON.stringify(rawEntries()[0])}]`
      );
      expect(listShips().map((s) => s.id)).toEqual([saved.id]);
      expect(renameShip(saved.id, "Renamed")).toBe(true);
      expect(rawEntries().map((e) => (e as { id: string }).id)).toContain(
        "inf"
      );
    });
  });

  describe("a stored list that isn't an array", () => {
    const wrapper = JSON.stringify({ format: 2, ships: [{ id: "w" }] });

    it("backs up the raw text before overwriting it", () => {
      localStorage.setItem(SHIPS_KEY, wrapper);
      expect(saveShip(ship, null)).not.toBeNull();
      expect(localStorage.getItem(SHIPS_BACKUP_KEY)).toBe(wrapper);
      expect(listShips()).toHaveLength(1);
    });

    it("does not clobber an existing backup", () => {
      localStorage.setItem(SHIPS_BACKUP_KEY, "earlier");
      localStorage.setItem(SHIPS_KEY, wrapper);
      expect(saveShip(ship, null)).not.toBeNull();
      expect(localStorage.getItem(SHIPS_BACKUP_KEY)).toBe("earlier");
    });

    it("does not back up corrupt text", () => {
      localStorage.setItem(SHIPS_KEY, "{not json");
      expect(saveShip(ship, null)).not.toBeNull();
      expect(localStorage.getItem(SHIPS_BACKUP_KEY)).toBeNull();
    });

    it("refuses to overwrite when the backup can't be written", () => {
      localStorage.setItem(SHIPS_KEY, wrapper);
      const realSetItem = Storage.prototype.setItem;
      jest.spyOn(Storage.prototype, "setItem").mockImplementation(function (
        this: Storage,
        key,
        value
      ) {
        if (key === SHIPS_BACKUP_KEY) throw new Error("QuotaExceededError");
        realSetItem.call(this, key, value);
      });
      expect(saveShip(ship, null)).toBeNull();
      expect(localStorage.getItem(SHIPS_KEY)).toBe(wrapper);
    });
  });

  it("dedupes ids, keeping the newest", () => {
    localStorage.setItem(
      SHIPS_KEY,
      JSON.stringify([
        { id: "d", name: "Old", savedAt: 1, ship: { ...ship, name: "Old" } },
        { id: "d", name: "New", savedAt: 2, ship: { ...ship, name: "New" } },
      ])
    );
    const listed = listShips();
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe("New");
  });

  it("takes the displayed name from the ship, not the entry", () => {
    localStorage.setItem(
      SHIPS_KEY,
      JSON.stringify([
        {
          id: "n",
          name: "N".repeat(5000),
          savedAt: 1,
          ship: { ...ship, name: "Real" },
        },
      ])
    );
    expect(listShips()[0].name).toBe("Real");
  });

  it("returns null when saving fails", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveShip(ship, null)).toBeNull();
  });
});
