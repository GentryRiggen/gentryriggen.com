import {
  BACKUPS_KEPT,
  CORRUPT_PREFIX,
  SAVE_KEY,
  SAVE_SHIP_IDS,
  emptySave,
  loadSave,
  loadSaveResult,
  parseSaveSalvaging,
  shipOf,
  whatIfOf,
  withWhatIf,
  writeSave,
} from "../save";
import { SHIP_IDS } from "../ships";

class MemoryStorage {
  data = new Map<string, string>();
  failWrites = false;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error("quota");
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  backups() {
    return [...this.data.keys()].filter(
      (k) => k.startsWith(CORRUPT_PREFIX) && !k.endsWith(":index")
    );
  }
}

const NOW = new Date(2026, 10, 20, 12).getTime();

describe("save", () => {
  it("round-trips a save", () => {
    const storage = new MemoryStorage();
    const save = {
      ...emptySave(),
      settings: { sound: false, speed: 30 as const, camera: "bridge" as const },
      seen: { realNight: true, endings: ["sank" as const] },
      lastWhatIf: ["bow-1", "bow-2"],
    };
    expect(writeSave(save, storage)).toBe(true);
    expect(loadSave(NOW, storage)).toEqual(save);
  });

  it("starts fresh when nothing is saved or storage is missing", () => {
    expect(loadSaveResult(NOW, new MemoryStorage())).toEqual({
      save: emptySave(),
      writable: true,
      newer: false,
    });
    expect(loadSaveResult(NOW, null).writable).toBe(false);
    expect(writeSave(emptySave(), null)).toBe(false);
  });

  it("defaults unknown values and keeps the rest", () => {
    const parsed = parseSaveSalvaging({
      v: 1,
      settings: { sound: "yes", speed: 7, camera: "drone" },
      seen: { realNight: true, endings: ["sank", "exploded", "sank", 4] },
      lastWhatIf: ["a", "a", 3, "", "b"],
    });
    expect(parsed?.save).toEqual({
      v: 1,
      settings: { sound: true, speed: 30, camera: "orbit" },
      seen: { realNight: true, endings: ["sank"] },
      lastWhatIf: ["a", "b"],
    });
  });

  it("fills in missing sections", () => {
    expect(parseSaveSalvaging({ v: 1 })?.save).toEqual(emptySave());
  });

  it("rejects what is not a save at all", () => {
    expect(parseSaveSalvaging(null)).toBeNull();
    expect(parseSaveSalvaging([])).toBeNull();
    expect(parseSaveSalvaging({ v: "1" })).toBeNull();
    expect(parseSaveSalvaging({ settings: {} })).toBeNull();
  });

  it("copies an unreadable save aside and starts fresh", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, "{not json");
    const result = loadSaveResult(NOW, storage);
    expect(result.save).toEqual(emptySave());
    expect(result.writable).toBe(true);
    expect(storage.backups()).toHaveLength(1);
    expect(storage.getItem(SAVE_KEY)).toBe("{not json");
  });

  it("does not become writable when the backup fails", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, "{not json");
    storage.failWrites = true;
    const result = loadSaveResult(NOW, storage);
    expect(result.writable).toBe(false);
    expect(storage.getItem(SAVE_KEY)).toBe("{not json");
  });

  it("keeps only the last few backups and never repeats one", () => {
    const storage = new MemoryStorage();
    for (let i = 0; i < BACKUPS_KEPT + 2; i++) {
      storage.setItem(SAVE_KEY, `broken ${i}`);
      loadSaveResult(NOW + i, storage);
    }
    expect(storage.backups()).toHaveLength(BACKUPS_KEPT);
    loadSaveResult(NOW + 99, storage);
    expect(storage.backups()).toHaveLength(BACKUPS_KEPT);
  });

  it("plays a newer build's save without writing over it", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 2, settings: { speed: 100 }, extra: true })
    );
    const result = loadSaveResult(NOW, storage);
    expect(result.newer).toBe(true);
    expect(result.writable).toBe(false);
    expect(result.save.settings.speed).toBe(100);
    expect(storage.backups()).toHaveLength(0);
  });

  it("never throws when reading or writing throws", () => {
    const broken = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
    };
    expect(loadSaveResult(NOW, broken).writable).toBe(false);
    expect(writeSave(emptySave(), broken)).toBe(false);
  });
});

describe("save: ships (1.1)", () => {
  /** A save as 1.0 wrote it: no ship, the Titanic's ids in lastWhatIf. */
  const V1 = {
    v: 1,
    settings: { sound: true, speed: 30, camera: "orbit" },
    seen: { realNight: true, endings: ["broke-in-two"] },
    lastWhatIf: ["br6", "br5"],
  };

  it("reads a 1.0 save as the Titanic's, its What if? still hers", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(V1));
    const { save, writable } = loadSaveResult(NOW, storage);
    expect(writable).toBe(true);
    expect(save.ship).toBeUndefined();
    expect(shipOf(save)).toBe("titanic");
    expect(whatIfOf(save, "titanic")).toEqual({ ids: ["br6", "br5"] });
    // The Titanic's ids never reach the Lusitania's editor.
    expect(whatIfOf(save, "lusitania")).toEqual({ ids: [] });
  });

  it("keeps a Lusitania What if? under her own name", () => {
    const v1 = parseSaveSalvaging(V1)!.save;
    const next = withWhatIf({ ...v1, ship: "lusitania" }, "lusitania", {
      ids: ["turbine"],
      portholesOpen: false,
    });
    expect(next.lastWhatIf).toEqual(["br6", "br5"]);
    expect(next.whatIfByShip).toEqual({
      lusitania: { ids: ["turbine"], portholesOpen: false },
    });
    const storage = new MemoryStorage();
    writeSave(next, storage);
    const back = loadSave(NOW, storage);
    expect(back).toEqual(next);
    expect(shipOf(back)).toBe("lusitania");
    expect(whatIfOf(back, "lusitania")).toEqual({
      ids: ["turbine"],
      portholesOpen: false,
    });
    // The Titanic's What if? still goes where 1.0 kept it.
    expect(withWhatIf(back, "titanic", { ids: ["hold1"] }).lastWhatIf).toEqual([
      "hold1",
    ]);
  });

  it("drops unknown ships and bad entries", () => {
    const parsed = parseSaveSalvaging({
      ...V1,
      ship: "britannic",
      whatIfByShip: {
        britannic: { ids: ["x"] },
        titanic: { ids: ["br6"] },
        lusitania: { ids: ["br1", 4, "br1"], portholesOpen: "no" },
      },
    })!.save;
    expect(parsed.ship).toBeUndefined();
    expect(parsed.whatIfByShip).toEqual({ lusitania: { ids: ["br1"] } });
    expect(
      parseSaveSalvaging({ ...V1, whatIfByShip: { britannic: {} } })!.save
        .whatIfByShip
    ).toBeUndefined();
    expect(parseSaveSalvaging({ ...V1, ship: 7 })!.save.ship).toBeUndefined();
  });

  it("knows every ship the game does", () => {
    expect([...SAVE_SHIP_IDS]).toEqual([...SHIP_IDS]);
  });
});

describe("save: What if for every ship (1.3)", () => {
  const BASE = {
    v: 1,
    settings: { sound: true, speed: 30, camera: "orbit" },
    seen: { realNight: true, endings: [] },
    lastWhatIf: [],
  };

  it("still loads a 1.1 save holding one Lusitania spot", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        ...BASE,
        ship: "lusitania",
        whatIfByShip: { lusitania: { ids: ["br1"], portholesOpen: true } },
      })
    );
    const { save, writable } = loadSaveResult(NOW, storage);
    expect(writable).toBe(true);
    expect(whatIfOf(save, "lusitania")).toEqual({
      ids: ["br1"],
      portholesOpen: true,
    });
  });

  it("round-trips three Lusitania torpedo hits", () => {
    const save = withWhatIf(parseSaveSalvaging(BASE)!.save, "lusitania", {
      ids: ["br1", "br3", "turbine"],
      portholesOpen: false,
    });
    const storage = new MemoryStorage();
    writeSave(save, storage);
    expect(whatIfOf(loadSave(NOW, storage), "lusitania")).toEqual({
      ids: ["br1", "br3", "turbine"],
      portholesOpen: false,
    });
  });

  it("round-trips the Fitzgerald's spots and storm", () => {
    const save = withWhatIf(parseSaveSalvaging(BASE)!.save, "fitzgerald", {
      ids: ["hatch-1", "vents", "shoal-2"],
      storm: "calmer",
    });
    const storage = new MemoryStorage();
    writeSave(save, storage);
    const back = loadSave(NOW, storage);
    expect(back).toEqual(save);
    expect(whatIfOf(back, "fitzgerald")).toEqual({
      ids: ["hatch-1", "vents", "shoal-2"],
      storm: "calmer",
    });
  });

  it("defaults junk storm values (the real storm) and keeps her spots", () => {
    for (const storm of ["hurricane", 3, null, true, {}]) {
      const parsed = parseSaveSalvaging({
        ...BASE,
        whatIfByShip: { fitzgerald: { ids: ["hatch-2", 9], storm } },
      })!.save;
      expect(whatIfOf(parsed, "fitzgerald")).toEqual({ ids: ["hatch-2"] });
    }
    const worse = parseSaveSalvaging({
      ...BASE,
      whatIfByShip: { fitzgerald: { ids: [], storm: "worse" } },
    })!.save;
    expect(whatIfOf(worse, "fitzgerald")).toEqual({ ids: [], storm: "worse" });
  });
});
