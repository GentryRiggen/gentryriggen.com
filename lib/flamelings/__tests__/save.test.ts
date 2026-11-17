import { createPet, hatch, emptySave } from "../actions";
import { SAVE_SCHEMA } from "../types";
import {
  BACKUPS_KEPT,
  CORRUPT_PREFIX,
  SAVE_KEY,
  loadSave,
  loadSaveResult,
  parseSave,
  writeSave,
} from "../save";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
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

const look = { colour: "sky", shape: "drop", eyes: "wide" } as const;
const NOW = new Date(2026, 10, 16, 12).getTime();

describe("save", () => {
  it("round-trips a save", () => {
    const storage = new MemoryStorage();
    const save = hatch(emptySave(NOW), {
      id: "a",
      name: "Pip",
      look,
      now: NOW,
    });
    expect(writeSave(save, storage)).toBe(true);
    expect(loadSave(NOW, storage)).toEqual(save);
  });

  it("starts fresh when nothing is saved or storage is missing", () => {
    expect(loadSave(NOW, new MemoryStorage()).pets).toEqual([]);
    expect(loadSave(NOW, null).pets).toEqual([]);
    expect(writeSave(emptySave(NOW), null)).toBe(false);
  });

  it("copies an unreadable save aside and starts fresh", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, "{not json");
    const result = loadSaveResult(NOW, storage);
    expect(result.save.pets).toEqual([]);
    expect(result.writable).toBe(true);
    const [backup] = storage.backups();
    expect(storage.getItem(backup)).toBe("{not json");
    expect(backup).toMatch(/^flamelings:v1:corrupt:\d+/);
  });

  it("keeps the last three backups", () => {
    const storage = new MemoryStorage();
    for (let i = 0; i < 5; i++) {
      storage.setItem(SAVE_KEY, `{bad ${i}`);
      loadSaveResult(NOW + i, storage);
    }
    const kept = storage.backups().map((k) => storage.getItem(k));
    expect(kept).toHaveLength(BACKUPS_KEPT);
    expect(kept).toEqual(["{bad 2", "{bad 3", "{bad 4"]);
  });

  it("keeps a pet whose hat, colour, emote or food this build does not know", () => {
    const pet = createPet({ id: "a", name: "Pip", look, now: NOW });
    const odd = {
      ...pet,
      look: { colour: "chartreuse", shape: "drop", eyes: "wide" },
      worn: { hat: "fez", face: null, neck: "scarf" },
      unlocked: [...pet.unlocked, "hat:fez", "emote:moonwalk", "food:pizza"],
    };
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        v: 1,
        pets: [odd],
        memorial: [],
        collection: [],
        updatedAt: 1,
      })
    );
    const result = loadSaveResult(NOW, storage);
    expect(result.save.pets).toHaveLength(1);
    expect(result.save.pets[0].look).toEqual({
      colour: "ember",
      shape: "drop",
      eyes: "wide",
    });
    expect(result.save.pets[0].worn).toEqual({
      hat: null,
      face: null,
      neck: "scarf",
    });
    expect(result.save.pets[0].unlocked).not.toContain("hat:fez");
    expect(result.save.pets[0].unlocked).toContain("emote:love");
  });

  it("keeps the other pets when one is beyond saving, and backs the original up", () => {
    const good = createPet({ id: "good", name: "Pip", look, now: NOW });
    const raw = JSON.stringify({
      v: 1,
      pets: [good, "garbage", { name: "no id" }],
      memorial: [],
      collection: [],
      updatedAt: 1,
    });
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, raw);
    const result = loadSaveResult(NOW, storage);
    expect(result.save.pets.map((p) => p.id)).toEqual(["good"]);
    expect(result.writable).toBe(true);
    expect(storage.backups().map((k) => storage.getItem(k))).toEqual([raw]);
  });

  it("repairs a pet's broken numbers and name instead of dropping it", () => {
    const pet = createPet({ id: "a", name: "Pip", look, now: NOW });
    const parsed = parseSave({
      v: 1,
      pets: [{ ...pet, fuel: "lots", name: 7 }],
      memorial: [],
    });
    expect(parsed).not.toBeNull();
    const result = loadSaveResult(
      NOW,
      Object.assign(new MemoryStorage(), {
        getItem: () =>
          JSON.stringify({
            v: 1,
            pets: [{ ...pet, fuel: "lots", name: 7 }],
            memorial: [],
          }),
      })
    );
    expect(result.save.pets[0]).toMatchObject({ fuel: 100, name: "Flameling" });
  });

  it("does not overwrite when the stored save cannot be read", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, "precious");
    storage.getItem = () => {
      throw new Error("blocked");
    };
    const result = loadSaveResult(NOW, storage);
    expect(result.writable).toBe(false);
    expect(storage.data.get(SAVE_KEY)).toBe("precious");
  });

  it("does not overwrite when the backup could not be written", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, "{bad");
    const set = storage.setItem.bind(storage);
    storage.setItem = (k, v) => {
      if (k.startsWith(CORRUPT_PREFIX)) throw new Error("quota");
      set(k, v);
    };
    expect(loadSaveResult(NOW, storage).writable).toBe(false);
    expect(storage.data.get(SAVE_KEY)).toBe("{bad");
  });

  it("never throws when storage does", () => {
    const angry = {
      getItem() {
        throw new Error("no");
      },
      setItem() {
        throw new Error("no");
      },
    };
    expect(loadSave(NOW, angry).pets).toEqual([]);
    expect(writeSave(emptySave(NOW), angry)).toBe(false);
  });

  it("clamps numbers, drops duplicate ids and trims names", () => {
    const pet = createPet({ id: "a", name: "Pip", look, now: NOW });
    const base = {
      v: 1,
      pets: [pet],
      memorial: [],
      collection: [],
      updatedAt: 1,
    };
    expect(parseSave(base)).not.toBeNull();
    expect(parseSave({ ...base, v: 2 })).toBeNull();
    expect(parseSave({ ...base, pets: [pet, pet] })).toBeNull();
    expect(parseSave({ ...base, pets: Array(9).fill(pet) })).toBeNull();
    expect(
      parseSave({ ...base, pets: [{ ...pet, fuel: 900 }] })?.pets[0].fuel
    ).toBe(100);
    const trimmed = parseSave({
      ...base,
      pets: [{ ...pet, name: "A very very long name" }],
    });
    expect(trimmed?.pets[0].name.length).toBe(12);
  });
});

describe("migrating a 1.0 save", () => {
  /** A pet exactly as 1.0 wrote it: no sparks and no decor. */
  function oldPet(id: string) {
    const {
      sparks: _s,
      decor: _d,
      ...old
    } = createPet({
      id,
      name: "Pip",
      look,
      now: NOW,
    });
    void _s;
    void _d;
    return old;
  }

  function store(pets: unknown[]) {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        v: 1,
        pets,
        memorial: [],
        collection: ["hat:crown"],
        updatedAt: 5,
      })
    );
    return storage;
  }

  it("loads cleanly with no sparks, no decor and no backup", () => {
    const storage = store([oldPet("a")]);
    const result = loadSaveResult(NOW, storage);
    expect(result.writable).toBe(true);
    expect(storage.backups()).toEqual([]);
    expect(result.save.pets[0].sparks).toBe(0);
    expect(result.save.pets[0].decor).toEqual([]);
    expect(result.save.collection).toEqual(["hat:crown"]);
  });

  it("drops unknown shop and decor ids one by one", () => {
    const base = oldPet("a");
    const storage = store([
      {
        ...base,
        sparks: 42.9,
        worn: { hat: "pirate", face: "monocle-xl", neck: "cape" },
        decor: ["rug", "castle", "tent", 7, "rug"],
        unlocked: [
          ...base.unlocked,
          "hat:pirate",
          "neck:cape",
          "decor:rug",
          "decor:castle",
        ],
      },
    ]);
    const { save } = loadSaveResult(NOW, storage);
    const pet = save.pets[0];
    expect(pet.sparks).toBe(42);
    expect(pet.worn).toEqual({ hat: "pirate", face: null, neck: "cape" });
    expect(pet.unlocked).toEqual(
      expect.arrayContaining(["hat:pirate", "neck:cape", "decor:rug"])
    );
    expect(pet.unlocked).not.toContain("decor:castle");
    // "tent" is known but not owned, so it cannot be out in the glade.
    expect(pet.decor).toEqual(["rug"]);
  });

  it("repairs broken sparks without losing the pet", () => {
    for (const sparks of [-5, "lots", null, 1e12]) {
      const { save } = loadSaveResult(NOW, store([{ ...oldPet("a"), sparks }]));
      expect(save.pets).toHaveLength(1);
      expect(save.pets[0].sparks).toBeGreaterThanOrEqual(0);
      expect(save.pets[0].sparks).toBeLessThanOrEqual(1_000_000);
    }
  });
});

describe("save schema", () => {
  it("loads a 1.1 save (no schema, no sparkRounds) and upgrades it", () => {
    const storage = new MemoryStorage();
    const old = hatch(emptySave(NOW), { id: "a", name: "Pip", look, now: NOW });
    const { schema: _schema, ...rest } = old;
    const { sparkRounds: _rounds, ...pet } = old.pets[0];
    void _schema;
    void _rounds;
    storage.setItem(SAVE_KEY, JSON.stringify({ ...rest, pets: [pet] }));
    const result = loadSaveResult(NOW, storage);
    expect(result.writable).toBe(true);
    expect(result.newer).toBe(false);
    expect(result.save.schema).toBe(SAVE_SCHEMA);
    expect(result.save.pets[0].sparkRounds).toEqual({ window: "", count: 0 });
  });

  it("plays a newer save in memory and never writes over it", () => {
    const storage = new MemoryStorage();
    const text = JSON.stringify({
      ...hatch(emptySave(NOW), { id: "a", name: "Pip", look, now: NOW }),
      schema: SAVE_SCHEMA + 1,
      futureField: { keep: true },
    });
    storage.setItem(SAVE_KEY, text);
    const result = loadSaveResult(NOW, storage);
    expect(result.newer).toBe(true);
    expect(result.writable).toBe(false);
    expect(result.save.pets).toHaveLength(1);
    expect(storage.getItem(SAVE_KEY)).toBe(text);
    expect(storage.backups()).toEqual([]);
  });
});

describe("happenings in a save", () => {
  const base = () => {
    const save = hatch(emptySave(NOW), {
      id: "a",
      name: "Pip",
      look,
      now: NOW,
    });
    return JSON.parse(JSON.stringify(save));
  };

  it("loads a 1.1 save with no happening fields", () => {
    const raw = base();
    delete raw.pets[0].happening;
    delete raw.pets[0].wish;
    const parsed = parseSave(raw);
    expect(parsed?.pets[0].happening).toBeNull();
    expect(parsed?.pets[0].wish).toBe(0);
  });

  it("keeps a good happening and drops an unknown kind", () => {
    const raw = base();
    raw.pets[0].happening = {
      window: "2026-11-16:am",
      kind: "visitor",
      variant: "owl",
      done: true,
      seen: true,
    };
    expect(parseSave(raw)?.pets[0].happening).toEqual(raw.pets[0].happening);
    raw.pets[0].happening.kind = "dragon";
    expect(parseSave(raw)?.pets[0].happening).toBeNull();
  });

  it("defaults a bad variant instead of dropping the happening", () => {
    const raw = base();
    raw.pets[0].happening = {
      window: "2026-11-16:am",
      kind: "visitor",
      variant: "dragon",
      done: false,
      seen: false,
    };
    expect(parseSave(raw)?.pets[0].happening?.variant).toBe("owl");
  });
});

describe("review fixes: backups", () => {
  it("does not back up a newer save with a broken entry on every load", () => {
    const storage = new MemoryStorage();
    const good = hatch(emptySave(NOW), {
      id: "a",
      name: "Pip",
      look,
      now: NOW,
    });
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        ...good,
        schema: SAVE_SCHEMA + 1,
        pets: [...good.pets, { nope: true }],
      })
    );
    for (let i = 0; i < 5; i++) loadSaveResult(NOW + i, storage);
    expect(storage.backups()).toEqual([]);
  });

  it("backs up identical broken text only once", () => {
    const storage = new MemoryStorage();
    const good = hatch(emptySave(NOW), {
      id: "a",
      name: "Pip",
      look,
      now: NOW,
    });
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ ...good, pets: [...good.pets, { nope: true }] })
    );
    const first = loadSaveResult(NOW, storage);
    for (let i = 1; i < 5; i++) loadSaveResult(NOW + i, storage);
    expect(first.writable).toBe(true);
    expect(storage.backups()).toHaveLength(1);
  });
});
