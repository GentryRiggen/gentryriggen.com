import {
  BACKUPS_KEPT,
  CORRUPT_PREFIX,
  LEGACY_WALK_SEEN_KEY,
  SAVE_KEY,
  SAVE_SHIP_IDS,
  emptySave,
  hasWalked,
  liveryOf,
  loadSave,
  loadSaveResult,
  parseSaveSalvaging,
  shipOf,
  whatIfOf,
  withLivery,
  withWalked,
  withWhatIf,
  writeSave,
  wreckOf,
} from "../save";
import { SHIP_IDS, getShip } from "../ships";
import { resolveLivery } from "../ships/types";
import { FINISHER_SPOT } from "../sim/run";

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
      ship: "andrea-doria",
      whatIfByShip: {
        "andrea-doria": { ids: ["x"] },
        titanic: { ids: ["br6"] },
        lusitania: { ids: ["br1", 4, "br1"], portholesOpen: "no" },
      },
    })!.save;
    expect(parsed.ship).toBeUndefined();
    expect(parsed.whatIfByShip).toEqual({ lusitania: { ids: ["br1"] } });
    expect(
      parseSaveSalvaging({ ...V1, whatIfByShip: { "andrea-doria": {} } })!.save
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

describe("save: the Carpathia's What if (1.4)", () => {
  const V1 = {
    v: 1,
    settings: { sound: true, speed: 30, camera: "orbit" },
    seen: { realNight: true, endings: [] },
    lastWhatIf: ["br6"],
  };

  it("keeps her ids, the U-boat's return among them, and drops junk", () => {
    const v1 = parseSaveSalvaging(V1)!.save;
    const next = withWhatIf({ ...v1, ship: "carpathia" }, "carpathia", {
      ids: ["boiler", "hold3", FINISHER_SPOT],
    });
    const storage = new MemoryStorage();
    writeSave(next, storage);
    const back = loadSave(NOW, storage);
    expect(shipOf(back)).toBe("carpathia");
    expect(whatIfOf(back, "carpathia")).toEqual({
      ids: ["boiler", "hold3", "finisher"],
    });
    // Not strings, repeats and empty ids go; the editor drops ids she has
    // not got (WhatIfEditor.test).
    const junk = parseSaveSalvaging({
      ...V1,
      ship: "carpathia",
      whatIfByShip: {
        carpathia: {
          ids: [FINISHER_SPOT, 3, "", null, FINISHER_SPOT, "engine"],
        },
      },
    })!.save;
    expect(whatIfOf(junk, "carpathia")).toEqual({
      ids: ["finisher", "engine"],
    });
  });
});

describe("save: each ship's paint (1.4, liveryByShip)", () => {
  /** A save as 1.3 wrote it: no liveryByShip. */
  const V13 = {
    v: 1,
    settings: { sound: true, speed: 30, camera: "orbit" },
    seen: { realNight: true, endings: ["sank"] },
    lastWhatIf: ["br6"],
    ship: "lusitania",
    whatIfByShip: { lusitania: { ids: ["boiler1"], portholesOpen: true } },
  };

  it("loads an older save with every ship in her default paint, nothing reset", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(V13));
    const r = loadSaveResult(NOW, storage);
    expect(r.writable).toBe(true);
    expect(storage.backups()).toEqual([]);
    expect(r.save.liveryByShip).toBeUndefined();
    // Everything else as it was.
    expect(shipOf(r.save)).toBe("lusitania");
    expect(r.save.seen.endings).toEqual(["sank"]);
    expect(whatIfOf(r.save, "lusitania").ids).toEqual(["boiler1"]);
    for (const id of SHIP_IDS) {
      expect(liveryOf(r.save, id)).toBeNull();
      const spec = getShip(id);
      expect(resolveLivery(spec, liveryOf(r.save, id))).toBe(
        spec.liveries?.find((l) => l.default)?.id ?? null
      );
    }
  });

  it("remembers a ship's paint and reads it back", () => {
    const storage = new MemoryStorage();
    const v = withLivery(
      withLivery(parseSaveSalvaging(V13)!.save, "carpathia", "cunard-1912"),
      "lusitania",
      "cunard-1907"
    );
    writeSave(v, storage);
    const back = loadSave(NOW, storage);
    expect(liveryOf(back, "carpathia")).toBe("cunard-1912");
    expect(liveryOf(back, "lusitania")).toBe("cunard-1907");
    expect(
      resolveLivery(getShip("carpathia"), liveryOf(back, "carpathia"))
    ).toBe("cunard-1912");
  });

  it("falls back to her default for a junk or unknown id, keeping the rest", () => {
    const back = parseSaveSalvaging({
      ...V13,
      liveryByShip: {
        carpathia: "rainbow-2030",
        lusitania: 7,
        titanic: "<script>",
        britannic: "liner",
        fitzgerald: "x".repeat(80),
      },
    })!.save;
    // Shaped like an id: kept (the ship decides); others dropped.
    expect(back.liveryByShip).toEqual({
      carpathia: "rainbow-2030",
      britannic: "liner",
    });
    expect(
      resolveLivery(getShip("carpathia"), liveryOf(back, "carpathia"))
    ).toBe("dazzle-1918");
    expect(
      resolveLivery(getShip("lusitania"), liveryOf(back, "lusitania"))
    ).toBe("war-1915");
    expect(shipOf(back)).toBe("lusitania");
    // A liveryByShip that is not an object is ignored, not a reset.
    expect(
      parseSaveSalvaging({ ...V13, liveryByShip: "cunard" })!.save.ship
    ).toBe("lusitania");
  });
});

describe("save: the Britannic's What if (1.4)", () => {
  const BASE = {
    v: 1,
    settings: { sound: true, speed: 30, camera: "orbit" },
    seen: { realNight: true, endings: [] },
    lastWhatIf: [],
  };

  it("round-trips her mines, portholes, doors and engines", () => {
    const v1 = parseSaveSalvaging(BASE)!.save;
    const choice = {
      ids: ["hold3", "br4"],
      portholesOpen: false,
      doorsClosed: true,
      enginesStopped: true,
    };
    const next = withWhatIf({ ...v1, ship: "britannic" }, "britannic", choice);
    const storage = new MemoryStorage();
    writeSave(next, storage);
    const back = loadSave(NOW, storage);
    expect(back).toEqual(next);
    expect(shipOf(back)).toBe("britannic");
    expect(whatIfOf(back, "britannic")).toEqual(choice);
  });

  it("reads an older save without her toggles as the real morning", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        ...BASE,
        ship: "britannic",
        whatIfByShip: {
          britannic: { ids: ["hold3"] },
          lusitania: { ids: ["br1"], portholesOpen: false },
        },
      })
    );
    const { save, writable } = loadSaveResult(NOW, storage);
    expect(writable).toBe(true);
    const w = whatIfOf(save, "britannic");
    expect(w).toEqual({ ids: ["hold3"] });
    // Missing means the real morning: open, stuck, running for Kea.
    expect(w.portholesOpen ?? true).toBe(true);
    expect(w.doorsClosed ?? false).toBe(false);
    expect(w.enginesStopped ?? false).toBe(false);
    // Bad values are dropped, not guessed.
    const bad = parseSaveSalvaging({
      ...BASE,
      whatIfByShip: {
        britannic: { ids: [], doorsClosed: "yes", enginesStopped: 1 },
        "andrea-doria": { ids: ["hold3"], doorsClosed: true },
      },
    })!.save;
    expect(bad.whatIfByShip).toEqual({ britannic: { ids: [] } });
  });
});

describe("save: the Costa Concordia's What if (1.9)", () => {
  const BASE = {
    v: 1,
    settings: { sound: true, speed: 30, camera: "orbit" },
    seen: { realNight: true, endings: [] },
    lastWhatIf: [],
  };

  it("round-trips her spots and the wind out to sea", () => {
    const v1 = parseSaveSalvaging(BASE)!.save;
    const choice = { ids: ["wtc5", "wtc6"], toSea: true };
    const next = withWhatIf({ ...v1, ship: "concordia" }, "concordia", choice);
    const storage = new MemoryStorage();
    writeSave(next, storage);
    const back = loadSave(NOW, storage);
    expect(back).toEqual(next);
    expect(shipOf(back)).toBe("concordia");
    expect(whatIfOf(back, "concordia")).toEqual(choice);
  });

  it("reads an older save without it as the real night, drops bad values and unknown ships", () => {
    const old = parseSaveSalvaging({
      ...BASE,
      whatIfByShip: { concordia: { ids: ["wtc5"] } },
    })!.save;
    const w = whatIfOf(old, "concordia");
    expect(w).toEqual({ ids: ["wtc5"] });
    expect(w.toSea ?? false).toBe(false);
    const bad = parseSaveSalvaging({
      ...BASE,
      whatIfByShip: {
        concordia: { ids: [], toSea: "yes" },
        "andrea-doria": { ids: ["wtc5"], toSea: true },
      },
    })!.save;
    expect(bad.whatIfByShip).toEqual({ concordia: { ids: [] } });
  });

  it("keeps the aground ending she can reach", () => {
    const save = parseSaveSalvaging({
      ...BASE,
      seen: { realNight: true, endings: ["aground", "sank", "upside-down"] },
    })!.save;
    expect(save.seen.endings).toEqual(["aground", "sank"]);
  });
});

describe("save: the Poseidon's What if (1.11)", () => {
  const BASE = {
    v: 1,
    settings: { sound: true, speed: 30, camera: "orbit" },
    seen: { realNight: true, endings: [] },
    lastWhatIf: [],
  };

  it("round-trips her spots and the wave, even none chosen", () => {
    const v1 = parseSaveSalvaging(BASE)!.save;
    for (const choice of [
      { ids: ["ballroom", "vents"], wave: "smaller" as const },
      { ids: [], wave: "ahead" as const },
      { ids: ["stern", "lobby"], wave: "real" as const },
    ]) {
      const next = withWhatIf({ ...v1, ship: "poseidon" }, "poseidon", choice);
      const storage = new MemoryStorage();
      writeSave(next, storage);
      const back = loadSave(NOW, storage);
      expect(back).toEqual(next);
      expect(shipOf(back)).toBe("poseidon");
      expect(whatIfOf(back, "poseidon")).toEqual(choice);
    }
  });

  it("reads an older save without her as the real wave, and drops a junk wave", () => {
    const old = parseSaveSalvaging({
      ...BASE,
      whatIfByShip: { poseidon: { ids: ["vents"] } },
    })!.save;
    expect(whatIfOf(old, "poseidon")).toEqual({ ids: ["vents"] });
    expect(whatIfOf(old, "poseidon").wave ?? "real").toBe("real");
    // A save with no entry for her at all.
    expect(whatIfOf(parseSaveSalvaging(BASE)!.save, "poseidon")).toEqual({
      ids: [],
    });
    const bad = parseSaveSalvaging({
      ...BASE,
      whatIfByShip: { poseidon: { ids: ["vents"], wave: "tsunami" } },
    })!.save;
    expect(bad.whatIfByShip).toEqual({ poseidon: { ids: ["vents"] } });
  });

  it("keeps the capsized ending she can reach", () => {
    const save = parseSaveSalvaging({
      ...BASE,
      seen: { realNight: true, endings: ["capsized", "sank", "upside-down"] },
    })!.save;
    expect(save.seen.endings).toEqual(["capsized", "sank"]);
  });
});

describe("the wreck chosen (any ship in any wreck, 1.14)", () => {
  it("keeps a known wreck and drops an unknown one", () => {
    const base = { ...emptySave(), ship: "titanic" };
    expect(
      parseSaveSalvaging({ ...base, wreck: "fitzgerald" })?.save.wreck
    ).toBe("fitzgerald");
    expect(
      parseSaveSalvaging({ ...base, wreck: "queen-mary" })?.save.wreck
    ).toBeUndefined();
  });

  it("is her own when none was chosen (an older save)", () => {
    expect(wreckOf(emptySave())).toBe("titanic");
    expect(wreckOf({ ...emptySave(), ship: "carpathia" })).toBe("carpathia");
    expect(
      wreckOf({ ...emptySave(), ship: "carpathia", wreck: "titanic" })
    ).toBe("titanic");
  });
});

describe("having walked (1.16: the Walk button stops pulsing)", () => {
  it("is false when missing (an older save), nothing else reset", () => {
    const older = {
      ...emptySave(),
      seen: { realNight: true, endings: ["sank" as const] },
      ship: "lusitania" as const,
    };
    const parsed = parseSaveSalvaging(older)!.save;
    expect(parsed.seen.walked).toBeUndefined();
    expect(hasWalked(parsed)).toBe(false);
    expect(parsed).toEqual(older);
    expect(hasWalked(emptySave())).toBe(false);
  });

  it("round-trips once walked", () => {
    const storage = new MemoryStorage();
    const save = withWalked(emptySave());
    expect(save.seen).toEqual({ realNight: false, endings: [], walked: true });
    expect(writeSave(save, storage)).toBe(true);
    const back = loadSave(NOW, storage);
    expect(back).toEqual(save);
    expect(hasWalked(back)).toBe(true);
  });

  it("keeps the rest of what was seen and drops a junk value", () => {
    const seen = { realNight: true, endings: ["sank" as const] };
    expect(withWalked({ ...emptySave(), seen }).seen).toEqual({
      ...seen,
      walked: true,
    });
    for (const junk of ["yes", 1, null, false])
      expect(
        parseSaveSalvaging({ ...emptySave(), seen: { ...seen, walked: junk } })!
          .save.seen
      ).toEqual(seen);
  });
});

describe("1.15's walk-seen key (read once into the save)", () => {
  it("folds a walked 1.15 player into seen.walked, with or without a save", () => {
    const fresh = new MemoryStorage();
    fresh.setItem(LEGACY_WALK_SEEN_KEY, "1");
    expect(hasWalked(loadSave(NOW, fresh))).toBe(true);

    const saved = new MemoryStorage();
    saved.setItem(SAVE_KEY, JSON.stringify(emptySave()));
    saved.setItem(LEGACY_WALK_SEEN_KEY, "1");
    const back = loadSave(NOW, saved);
    expect(hasWalked(back)).toBe(true);
    expect(back.seen.endings).toEqual([]);
  });

  it("ignores anything but 1 and a storage that throws", () => {
    const other = new MemoryStorage();
    other.setItem(LEGACY_WALK_SEEN_KEY, "yes");
    expect(hasWalked(loadSave(NOW, other))).toBe(false);
    const throws = {
      getItem: (k: string) => {
        if (k === LEGACY_WALK_SEEN_KEY) throw new Error("denied");
        return null;
      },
      setItem: () => {},
    };
    expect(hasWalked(loadSave(NOW, throws))).toBe(false);
  });

  it("is removed once the save holding the flag is written, and never written", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_WALK_SEEN_KEY, "1");
    const save = loadSave(NOW, storage);
    expect(writeSave(save, storage)).toBe(true);
    expect(storage.getItem(LEGACY_WALK_SEEN_KEY)).toBeNull();
    expect(hasWalked(loadSave(NOW, storage))).toBe(true);
    // A save that has not walked leaves no key behind either.
    const plain = new MemoryStorage();
    writeSave(emptySave(), plain);
    expect(plain.getItem(LEGACY_WALK_SEEN_KEY)).toBeNull();
  });
});
