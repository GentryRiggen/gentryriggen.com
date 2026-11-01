import { newUniverseSave } from "../prestige";
import {
  SAVE_KEY,
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
    ["future version", JSON.stringify({ ...newSave(), version: 999 })],
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

  it("rejects NaN and negative numbers", () => {
    const save = newSave();
    save.universes.fixture = { ...newUniverseSave(def), embers: -1 };
    expect(parseSave(JSON.parse(JSON.stringify(save)))).toBeNull();
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
