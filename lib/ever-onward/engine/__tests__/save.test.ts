import { newUniverseSave } from "../prestige";
import {
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  MAX_BACKUPS,
  SAVE_VERSION,
  loadSave,
  newSave,
  parseSave,
  writeSave,
} from "../save";
import { fixture as def } from "./fixtures";

beforeEach(() => window.localStorage.clear());

const backupKeys = () =>
  Object.keys(window.localStorage).filter((k) => k.includes(":backup:"));

describe("save", () => {
  it("moves a save from the old Little Machines key to the new one", () => {
    const raw = JSON.stringify(newSave());
    window.localStorage.setItem(LEGACY_SAVE_KEY, raw);
    expect(loadSave()).toEqual({ save: newSave(), recovered: false });
    expect(window.localStorage.getItem(SAVE_KEY)).toBe(raw);
    expect(window.localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull();
  });

  it("keeps the new save and leaves the old key alone when both exist", () => {
    const current = JSON.stringify({ ...newSave(), seenIntro: true });
    const legacy = JSON.stringify(newSave());
    window.localStorage.setItem(SAVE_KEY, current);
    window.localStorage.setItem(LEGACY_SAVE_KEY, legacy);
    expect(loadSave().save.seenIntro).toBe(true);
    expect(window.localStorage.getItem(SAVE_KEY)).toBe(current);
    expect(window.localStorage.getItem(LEGACY_SAVE_KEY)).toBe(legacy);
  });

  it("starts fresh when nothing is stored", () => {
    expect(loadSave()).toEqual({ save: newSave(), recovered: false });
  });

  it("round-trips a save", () => {
    const save = newSave();
    save.universes.fixture = {
      ...newUniverseSave(def),
      best: 1234,
      completions: 2,
      embers: 9,
      prestigeUpgrades: { spark: 1 },
    };
    save.seenIntro = true;
    expect(writeSave(save)).toBe(true);
    expect(loadSave()).toEqual({ save, recovered: false });
    expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)!).version).toBe(
      SAVE_VERSION
    );
  });

  it.each([
    ["not json", "{nope"],
    ["wrong shape", JSON.stringify({ version: 1, universes: 5 })],
    ["no version", JSON.stringify({ universes: {}, seenIntro: false })],
    [
      "bad run",
      JSON.stringify({
        ...newSave(),
        universes: {
          x: { ...newUniverseSave(def), run: { phase: "one" } },
        },
      }),
    ],
  ])("backs up an unreadable save (%s) and starts fresh", (_name, raw) => {
    window.localStorage.setItem(SAVE_KEY, raw);
    const result = loadSave();
    expect(result.recovered).toBe(true);
    expect(result.save).toEqual(newSave());
    const keys = backupKeys();
    expect(keys).toHaveLength(1);
    expect(window.localStorage.getItem(keys[0])).toBe(raw);
  });

  it("does not stack identical backups", () => {
    window.localStorage.setItem(SAVE_KEY, "garbage");
    loadSave();
    loadSave();
    expect(backupKeys()).toHaveLength(1);
  });

  it("rejects negative numbers, leaving out only that universe", () => {
    const save = newSave();
    save.universes.fixture = { ...newUniverseSave(def), embers: -1 };
    save.universes.other = newUniverseSave(def);
    save.seenIntro = true;
    const parsed = parseSave(JSON.parse(JSON.stringify(save)));
    expect(parsed?.seenIntro).toBe(true);
    expect(Object.keys(parsed!.universes)).toEqual(["other"]);
  });

  it("keeps a run whose numbers were damaged (NaN stores as null)", () => {
    const save = newSave();
    const universe = newUniverseSave(def);
    universe.run.resources.coins = NaN;
    universe.run.mods.mult = Infinity;
    save.universes.fixture = universe;
    const parsed = parseSave(JSON.parse(JSON.stringify(save)));
    expect(parsed?.universes.fixture).toBeDefined();
  });

  it("backs up and flags a save with one bad universe, keeping the rest", () => {
    const save = newSave();
    save.universes.good = { ...newUniverseSave(def), embers: 4 };
    save.universes.bad = { ...newUniverseSave(def), embers: -1 };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    const result = loadSave();
    expect(result.recovered).toBe(true);
    expect(result.save.universes.good.embers).toBe(4);
    expect(result.save.universes.bad).toBeUndefined();
    expect(backupKeys()).toHaveLength(1);
  });

  it("keeps only the newest few backups", () => {
    for (let i = 0; i < 6; i += 1) {
      jest.spyOn(Date, "now").mockReturnValue(1000 + i);
      window.localStorage.setItem(SAVE_KEY, `garbage ${i}`);
      loadSave();
    }
    jest.restoreAllMocks();
    const keys = backupKeys().sort();
    expect(keys).toHaveLength(MAX_BACKUPS);
    expect(keys.map((k) => window.localStorage.getItem(k))).toEqual([
      "garbage 3",
      "garbage 4",
      "garbage 5",
    ]);
  });

  it("survives blocked storage", () => {
    const get = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const set = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(loadSave()).toEqual({ save: newSave(), recovered: false });
    expect(writeSave(newSave())).toBe(false);
    get.mockRestore();
    set.mockRestore();
  });
});
