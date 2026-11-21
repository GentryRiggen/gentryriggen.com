import {
  BACKUPS_KEPT,
  CORRUPT_PREFIX,
  SAVE_KEY,
  emptySave,
  loadSave,
  loadSaveResult,
  parseSaveSalvaging,
  writeSave,
} from "../save";

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
      settings: { sound: true, speed: 1, camera: "orbit" },
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
