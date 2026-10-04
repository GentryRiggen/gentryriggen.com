import {
  AUTOSAVE_BACKUP_KEY,
  AUTOSAVE_KEY,
  clearUnreadableShips,
  countUnreadableShips,
  deleteShip,
  listShips,
  loadAutosave,
  renameShip,
  saveAutosave,
  saveShip,
  SHIPS_BACKUP_KEY,
  SHIPS_KEY,
} from "../local";
import {
  attachPart,
  gridPart,
  hasLoneSurrogate,
  testShip,
} from "../../testing";
import { HULL_ID } from "../../model/types";

const ship = testShip([gridPart("a", "deck-1x1", 0, 0, 0)]);

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe("ships with parts that no longer fit", () => {
  const broken = testShip([
    gridPart("a", "deck-1x1", 0, 0, 0),
    gridPart("floating", "deck-1x1", 3, 0, 0),
  ]);

  it("loads the autosave without them and reports how many", () => {
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ ship: broken, savedId: "s" })
    );
    expect(loadAutosave()).toMatchObject({ kind: "ok", dropped: 1 });
  });

  it("backs up the original autosave before the repaired ship replaces it", () => {
    const text = JSON.stringify({ ship: broken, savedId: "s" });
    localStorage.setItem(AUTOSAVE_KEY, text);
    loadAutosave();
    expect(localStorage.getItem(AUTOSAVE_BACKUP_KEY)).toBe(text);
  });

  it("keeps an independent part that comes after a dropped one", () => {
    const mixed = testShip([
      gridPart("floating", "deck-1x1", 3, 0, 0),
      gridPart("a", "deck-1x1", 0, 0, 0),
      gridPart("b", "deck-1x1", 0, 2, 0),
    ]);
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ ship: mixed, savedId: null })
    );
    const loaded = loadAutosave();
    expect(loaded).toMatchObject({ kind: "ok", dropped: 1 });
    if (loaded.kind !== "ok") throw new Error("expected ok");
    expect(loaded.ship.parts.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("lists a saved ship without them, leaving the stored entry alone", () => {
    const entry = { id: "s", name: "x", savedAt: 1, ship: broken };
    localStorage.setItem(SHIPS_KEY, JSON.stringify([entry]));
    const [listed] = listShips();
    expect(listed.dropped).toBe(1);
    expect(listed.ship.parts.map((p) => p.id)).toEqual(["a"]);
    expect(countUnreadableShips()).toBe(0);
    expect(JSON.parse(localStorage.getItem(SHIPS_KEY) ?? "[]")).toEqual([
      entry,
    ]);
  });
});

describe("autosave", () => {
  it("round-trips the ship and savedId", () => {
    expect(saveAutosave(ship, "ship-1")).toBe(true);
    expect(loadAutosave()).toEqual({
      kind: "ok",
      dropped: 0,
      ship,
      savedId: "ship-1",
    });
  });

  it("round-trips bulkheads", () => {
    const walled = {
      ...ship,
      hull: { ...ship.hull, bulkheads: [{ at: 3, height: "deck" as const }] },
    };
    expect(saveAutosave(walled, null)).toBe(true);
    expect(loadAutosave()).toEqual({
      kind: "ok",
      dropped: 0,
      ship: walled,
      savedId: null,
    });
  });

  it("loads a v1 autosave and My Ships entry with the default beam", () => {
    const v1 = { ...ship, kind: undefined, v: 1, hull: { lengthSegments: 8 } };
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ ship: v1, savedId: "old" })
    );
    expect(loadAutosave()).toEqual({
      kind: "ok",
      dropped: 0,
      ship,
      savedId: "old",
    });
    localStorage.setItem(
      SHIPS_KEY,
      JSON.stringify([{ id: "old", name: "Test", savedAt: 1, ship: v1 }])
    );
    expect(listShips().map((s) => s.ship)).toEqual([ship]);
  });

  it("loads a v5 autosave and My Ships entry as a liner", () => {
    const v5 = { ...ship, kind: undefined, v: 5 };
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ ship: v5, savedId: "old" })
    );
    expect(loadAutosave()).toEqual({
      kind: "ok",
      dropped: 0,
      ship,
      savedId: "old",
    });
    localStorage.setItem(
      SHIPS_KEY,
      JSON.stringify([{ id: "old", name: "Test", savedAt: 1, ship: v5 }])
    );
    expect(listShips().map((s) => s.ship)).toEqual([ship]);
    expect(listShips()[0].ship.kind).toBe("liner");
  });

  it("loads a v4 autosave and My Ships entry unchanged", () => {
    const v4 = { ...ship, kind: undefined, v: 4 };
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ ship: v4, savedId: "old" })
    );
    expect(loadAutosave()).toEqual({
      kind: "ok",
      dropped: 0,
      ship,
      savedId: "old",
    });
    localStorage.setItem(
      SHIPS_KEY,
      JSON.stringify([{ id: "old", name: "Test", savedAt: 1, ship: v4 }])
    );
    expect(listShips().map((s) => s.ship)).toEqual([ship]);
  });

  it("loads a v3 autosave and My Ships entry with the default ends", () => {
    const { bow, stern, ...hull } = ship.hull;
    expect([bow, stern]).toEqual(["straight", "counter"]);
    const v3 = { ...ship, kind: undefined, v: 3, hull };
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ ship: v3, savedId: "old" })
    );
    expect(loadAutosave()).toEqual({
      kind: "ok",
      dropped: 0,
      ship,
      savedId: "old",
    });
    localStorage.setItem(
      SHIPS_KEY,
      JSON.stringify([{ id: "old", name: "Test", savedAt: 1, ship: v3 }])
    );
    expect(listShips().map((s) => s.ship)).toEqual([ship]);
  });

  it("loads a v2 autosave and My Ships entry with old mast types", () => {
    const v2 = {
      ...ship,
      kind: undefined,
      v: 2,
      parts: [
        { ...attachPart("m", "mast", HULL_ID, "mast-aft"), type: "mast-aft" },
      ],
    };
    const migrated = testShip([attachPart("m", "mast", HULL_ID, "mast-aft")]);
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ ship: v2, savedId: "old" })
    );
    expect(loadAutosave()).toEqual({
      kind: "ok",
      dropped: 0,
      ship: migrated,
      savedId: "old",
    });
    localStorage.setItem(
      SHIPS_KEY,
      JSON.stringify([{ id: "old", name: "Test", savedAt: 1, ship: v2 }])
    );
    expect(listShips().map((s) => s.ship)).toEqual([migrated]);
  });

  it("reports none when nothing is stored", () => {
    expect(loadAutosave()).toEqual({ kind: "none" });
  });

  it.each([
    ["corrupt JSON", "{not json"],
    ["a non-record", "[1,2]"],
    ["JSON null", "null"],
    ["an invalid ship", JSON.stringify({ ship: { v: 9 } })],
  ])("reports invalid for %s", (_label, text) => {
    localStorage.setItem(AUTOSAVE_KEY, text);
    expect(loadAutosave()).toEqual({ kind: "invalid" });
    expect(localStorage.getItem(AUTOSAVE_BACKUP_KEY)).toBe(text);
  });

  it("keeps an earlier autosave backup when backing up a new one", () => {
    localStorage.setItem(AUTOSAVE_BACKUP_KEY, "older");
    localStorage.setItem(AUTOSAVE_KEY, "{newer");
    loadAutosave();
    expect(localStorage.getItem(AUTOSAVE_BACKUP_KEY)).toBe("older");
    const copies = Object.keys(localStorage).filter((key) =>
      key.startsWith(`${AUTOSAVE_BACKUP_KEY}:`)
    );
    expect(copies.map((key) => localStorage.getItem(key))).toEqual(["{newer"]);
  });

  it("returns false when storage throws", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveAutosave(ship, null)).toBe(false);
  });

  it("reports none when reading throws", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(loadAutosave()).toEqual({ kind: "none" });
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

  it("clamps a rename without splitting an emoji", () => {
    const saved = saveShip(ship, null)!;
    expect(renameShip(saved.id, "a".repeat(59) + "😀")).toBe(true);
    const [entry] = listShips();
    expect(entry.id).toBe(saved.id);
    expect(hasLoneSurrogate(entry.name)).toBe(false);
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
      ship: {
        v: 6,
        name: "Future",
        hull: { lengthSegments: 8, beam: 4 },
        parts: [],
      },
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

    it("leaves an unparseable twin of a renamed entry untouched", () => {
      const id = storeWithFuture();
      const twin = { ...future, id };
      localStorage.setItem(
        SHIPS_KEY,
        JSON.stringify([twin, ...rawEntries().slice(1)])
      );
      expect(renameShip(id, "Renamed")).toBe(true);
      expect(rawEntries()).toContainEqual(twin);
      expect(listShips().map((s) => s.name)).toEqual(["Renamed"]);
    });

    it("counts them", () => {
      expect(countUnreadableShips()).toBe(0);
      storeWithFuture();
      localStorage.setItem(
        SHIPS_KEY,
        JSON.stringify([...rawEntries(), "junk", { id: 7, ship }])
      );
      expect(countUnreadableShips()).toBe(3);
    });

    it("clears only them", () => {
      storeWithFuture();
      const valid = rawEntries()[1];
      localStorage.setItem(
        SHIPS_KEY,
        JSON.stringify([...rawEntries(), "junk"])
      );
      expect(clearUnreadableShips()).toBe(true);
      expect(rawEntries()).toEqual([valid]);
      expect(countUnreadableShips()).toBe(0);
      expect(listShips().map((s) => s.name)).toEqual(["Valid"]);
    });

    it("refuses to clear when reading throws", () => {
      storeWithFuture();
      jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      const setItem = jest.spyOn(Storage.prototype, "setItem");
      expect(countUnreadableShips()).toBe(0);
      expect(clearUnreadableShips()).toBe(false);
      expect(setItem).not.toHaveBeenCalled();
    });

    it("lists non-finite or missing savedAt at the bottom", () => {
      const saved = saveShip({ ...ship, name: "Valid" }, null, 1)!;
      const shipJson = JSON.stringify(ship);
      localStorage.setItem(
        SHIPS_KEY,
        `[{"id":"inf","name":"Inf","savedAt":1e400,"ship":${shipJson}},` +
          `{"id":"none","name":"None","ship":${shipJson}},` +
          `${JSON.stringify(rawEntries()[0])}]`
      );
      const listed = listShips();
      expect(listed.map((s) => s.id)).toEqual([saved.id, "inf", "none"]);
      expect(listed.slice(1).map((s) => s.savedAt)).toEqual([0, 0]);
      expect(countUnreadableShips()).toBe(0);
    });

    it("normalises non-finite savedAt to 0 on rewrite", () => {
      const saved = saveShip({ ...ship, name: "Valid" }, null, 1)!;
      localStorage.setItem(
        SHIPS_KEY,
        `[{"id":"inf","name":"Inf","savedAt":1e400,"ship":${JSON.stringify(
          ship
        )}},${JSON.stringify(rawEntries()[0])}]`
      );
      expect(renameShip(saved.id, "Renamed")).toBe(true);
      expect(rawEntries()).toContainEqual(
        expect.objectContaining({ id: "inf", savedAt: 0 })
      );
      expect(listShips().map((s) => s.id)).toEqual([saved.id, "inf"]);
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

    /** Every stored backup's text, sorted. */
    function backups(): string[] {
      const texts: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (
          key === SHIPS_BACKUP_KEY ||
          key.startsWith(`${SHIPS_BACKUP_KEY}:`)
        ) {
          texts.push(localStorage.getItem(key)!);
        }
      }
      return texts.sort();
    }

    it("does not clobber an existing backup", () => {
      localStorage.setItem(SHIPS_BACKUP_KEY, "earlier");
      localStorage.setItem(SHIPS_KEY, wrapper);
      expect(saveShip(ship, null)).not.toBeNull();
      expect(localStorage.getItem(SHIPS_BACKUP_KEY)).toBe("earlier");
      expect(backups()).toEqual(["earlier", wrapper].sort());
    });

    it("backs up a second, different value too", () => {
      const second = JSON.stringify({ format: 2, ships: [{ id: "x" }] });
      localStorage.setItem(SHIPS_KEY, wrapper);
      expect(saveShip(ship, null, 1)).not.toBeNull();
      localStorage.setItem(SHIPS_KEY, second);
      expect(saveShip(ship, null, 2)).not.toBeNull();
      expect(backups()).toEqual([wrapper, second].sort());
    });

    it("keeps both backups when two land in the same millisecond", () => {
      const third = JSON.stringify({ format: 3 });
      jest.spyOn(Date, "now").mockReturnValue(1000);
      localStorage.setItem(SHIPS_BACKUP_KEY, "first");
      localStorage.setItem(SHIPS_KEY, wrapper);
      expect(saveShip(ship, null)).not.toBeNull();
      localStorage.setItem(SHIPS_KEY, third);
      expect(saveShip(ship, null)).not.toBeNull();
      expect(backups()).toEqual(["first", wrapper, third].sort());
    });

    it("does not back up an identical value twice", () => {
      localStorage.setItem(SHIPS_KEY, wrapper);
      expect(saveShip(ship, null, 1)).not.toBeNull();
      localStorage.setItem(SHIPS_KEY, wrapper);
      expect(saveShip(ship, null, 2)).not.toBeNull();
      expect(backups()).toEqual([wrapper]);
    });

    it("is not blocked by a garbage backup", () => {
      localStorage.setItem(SHIPS_BACKUP_KEY, "garbage{");
      localStorage.setItem(SHIPS_KEY, wrapper);
      expect(saveShip(ship, null)).not.toBeNull();
      expect(backups()).toEqual(["garbage{", wrapper].sort());
    });

    it("does not back up corrupt text", () => {
      localStorage.setItem(SHIPS_KEY, "{not json");
      expect(saveShip(ship, null)).not.toBeNull();
      expect(localStorage.getItem(SHIPS_BACKUP_KEY)).toBeNull();
    });

    function failBackupWrites() {
      const realSetItem = Storage.prototype.setItem;
      jest.spyOn(Storage.prototype, "setItem").mockImplementation(function (
        this: Storage,
        key,
        value
      ) {
        if (key.startsWith(SHIPS_BACKUP_KEY)) {
          throw new Error("QuotaExceededError");
        }
        realSetItem.call(this, key, value);
      });
    }

    it("refuses to overwrite when the backup can't be written", () => {
      localStorage.setItem(SHIPS_KEY, wrapper);
      failBackupWrites();
      expect(saveShip(ship, null)).toBeNull();
      expect(localStorage.getItem(SHIPS_KEY)).toBe(wrapper);
    });

    it("counts it as one unreadable entry", () => {
      localStorage.setItem(SHIPS_KEY, wrapper);
      expect(countUnreadableShips()).toBe(1);
    });

    it.each(["null", "{not json"])(
      "does not count %s as unreadable",
      (text) => {
        localStorage.setItem(SHIPS_KEY, text);
        expect(countUnreadableShips()).toBe(0);
      }
    );

    it("can be cleared even when the backup can't be written", () => {
      localStorage.setItem(SHIPS_KEY, wrapper);
      failBackupWrites();
      expect(countUnreadableShips()).toBe(1);
      expect(clearUnreadableShips()).toBe(true);
      expect(localStorage.getItem(SHIPS_KEY)).toBe("[]");
      expect(countUnreadableShips()).toBe(0);
      expect(saveShip(ship, null)).not.toBeNull();
      expect(listShips()).toHaveLength(1);
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
