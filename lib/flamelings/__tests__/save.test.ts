import { createPet, hatch, emptySave } from "../actions";
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
