import { createPet, hatch, emptySave } from "../actions";
import { CORRUPT_KEY, SAVE_KEY, loadSave, parseSave, writeSave } from "../save";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
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

  it("copies a corrupt save aside and starts fresh", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, "{not json");
    expect(loadSave(NOW, storage).pets).toEqual([]);
    expect(storage.getItem(CORRUPT_KEY)).toBe("{not json");

    const wrong = JSON.stringify({ v: 1, pets: [{ id: "x" }], memorial: [] });
    storage.setItem(SAVE_KEY, wrong);
    expect(loadSave(NOW, storage).pets).toEqual([]);
    expect(storage.getItem(CORRUPT_KEY)).toBe(wrong);
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

  it("rejects out-of-range or unknown fields and clamps numbers", () => {
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
    expect(
      parseSave({
        ...base,
        pets: [{ ...pet, look: { ...look, colour: "pink" } }],
      })
    ).toBeNull();
    expect(
      parseSave({
        ...base,
        pets: [{ ...pet, worn: { hat: "fez", face: null, neck: null } }],
      })
    ).toBeNull();
    expect(parseSave({ ...base, pets: [pet, pet] })).toBeNull();
    expect(parseSave({ ...base, pets: Array(9).fill(pet) })).toBeNull();
    const clamped = parseSave({ ...base, pets: [{ ...pet, fuel: 900 }] });
    expect(clamped?.pets[0].fuel).toBe(100);
    const trimmed = parseSave({
      ...base,
      pets: [
        {
          ...pet,
          name: "A very very long name",
          unlocked: ["hat:fez", "hat:crown"],
        },
      ],
    });
    expect(trimmed?.pets[0].name.length).toBe(12);
    expect(trimmed?.pets[0].unlocked).toEqual(["hat:crown"]);
  });
});
