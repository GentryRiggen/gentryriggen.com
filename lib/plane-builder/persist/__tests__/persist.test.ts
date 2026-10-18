import { LEVELS } from "../../levels";
import { newProgress } from "../../economy/progress";
import { SAVE_KEY, loadProgress, saveProgress } from "../local";
import { SAVE_VERSION, parseSave } from "../schema";

const NEW_WORLDS = [
  "beach",
  "jungle",
  "city",
  "glacier",
  "volcano",
  "storm",
  "islands",
] as const;

beforeEach(() => window.localStorage.clear());

describe("parseSave", () => {
  it("round-trips a valid save", () => {
    const progress = newProgress();
    expect(parseSave({ version: SAVE_VERSION, progress })).toEqual(progress);
  });

  it("fills in levels the save doesn't have", () => {
    const progress = newProgress();
    const { mountains, ...rest } = progress.levels;
    void mountains;
    const parsed = parseSave({
      version: SAVE_VERSION,
      progress: { ...progress, levels: rest },
    });
    expect(parsed?.levels.mountains).toEqual(newProgress().levels.mountains);
  });

  it("loads a 3-world v2 save (migrated): new worlds start fresh and locked", () => {
    const progress = newProgress();
    const { mountains, canyon, meadow } = progress.levels;
    const parsed = parseSave({
      version: 2,
      progress: {
        levels: { meadow, canyon, mountains },
        unlocked: ["meadow", "canyon", "mountains"],
      },
    });
    expect(parsed?.unlocked).toEqual(["meadow", "canyon", "mountains"]);
    for (const id of NEW_WORLDS) {
      expect(parsed?.levels[id]).toEqual(newProgress().levels[id]);
    }
  });

  it("opens the first new world once the mountains are finished", () => {
    const progress = newProgress();
    progress.levels.mountains.finished = true;
    const parsed = parseSave({ version: SAVE_VERSION, progress });
    expect(parsed?.unlocked).toEqual(["meadow", "beach"]);
  });

  it.each([
    ["not an object", 42],
    ["newer version", { version: 99, progress: newProgress() }],
    [
      "bad tier",
      (() => {
        const p = newProgress();
        p.levels.meadow.tiers.wings = 9;
        return { version: SAVE_VERSION, progress: p };
      })(),
    ],
    [
      "negative coins",
      (() => {
        const p = newProgress();
        p.levels.meadow.coins = -1;
        return { version: SAVE_VERSION, progress: p };
      })(),
    ],
    [
      "non-string unlock",
      {
        version: SAVE_VERSION,
        progress: { ...newProgress(), unlocked: ["meadow", 7] },
      },
    ],
  ])("rejects %s", (_, raw) => {
    expect(parseSave(raw)).toBeNull();
  });

  it("orders unlocks and always includes the meadow", () => {
    const p = { ...newProgress(), unlocked: ["canyon"] };
    expect(parseSave({ version: SAVE_VERSION, progress: p })?.unlocked).toEqual(
      ["meadow", "canyon"]
    );
  });
});

describe("parseSave tolerance and bounds", () => {
  const wrap = (progress: unknown) => ({ version: SAVE_VERSION, progress });

  it("drops unknown level ids from unlocked", () => {
    const p = { ...newProgress(), unlocked: ["meadow", "moon", "canyon"] };
    expect(parseSave(wrap(p))?.unlocked).toEqual(["meadow", "canyon"]);
  });

  it("defaults a missing unlocked list to the meadow", () => {
    const { unlocked, ...rest } = newProgress();
    void unlocked;
    expect(parseSave(wrap(rest))?.unlocked).toEqual(["meadow"]);
  });

  it("clamps coins and best", () => {
    const p = newProgress();
    p.levels.meadow.coins = 5e12;
    p.levels.meadow.best = 99999;
    p.levels.canyon.best = 12.5;
    const parsed = parseSave(wrap(p));
    expect(parsed?.levels.meadow.coins).toBe(1e9);
    expect(parsed?.levels.meadow.best).toBe(LEVELS.meadow.finishDistance);
    expect(parsed?.levels.canyon.best).toBe(12.5);
  });

  it("unlocks the level after a finished one", () => {
    const p = newProgress();
    p.levels.meadow.finished = true;
    expect(parseSave(wrap(p))?.unlocked).toEqual(["meadow", "canyon"]);
  });
});

describe("local storage", () => {
  it("starts fresh with nothing stored", () => {
    expect(loadProgress()).toEqual({
      progress: newProgress(),
      recovered: false,
      reset: false,
    });
  });

  it("saves and loads", () => {
    const p = newProgress();
    p.levels.meadow.coins = 42;
    expect(saveProgress(p)).toBe(true);
    expect(loadProgress().progress.levels.meadow.coins).toBe(42);
  });

  it("starts a save from before 1.2 fresh, keeping a backup", () => {
    const old = newProgress();
    old.levels.meadow.coins = 900;
    const raw = JSON.stringify({ version: 1, progress: old });
    window.localStorage.setItem(SAVE_KEY, raw);
    const r = loadProgress();
    expect(r).toEqual({
      progress: newProgress(),
      recovered: false,
      reset: true,
    });
    const backups = Object.keys(window.localStorage).filter((k) =>
      k.startsWith(`${SAVE_KEY}:backup:`)
    );
    expect(backups).toHaveLength(1);
    expect(window.localStorage.getItem(backups[0])).toBe(raw);
    expect(loadProgress().reset).toBe(false);
  });

  it("loads a current save without resetting it", () => {
    const p = newProgress();
    p.levels.meadow.coins = 42;
    saveProgress(p);
    expect(loadProgress()).toMatchObject({ recovered: false, reset: false });
  });

  it("backs up an unreadable save", () => {
    window.localStorage.setItem(SAVE_KEY, "{broken");
    const r = loadProgress();
    expect(r.recovered).toBe(true);
    expect(r.progress).toEqual(newProgress());
    const backups = Object.keys(window.localStorage).filter((k) =>
      k.startsWith(`${SAVE_KEY}:backup:`)
    );
    expect(backups).toHaveLength(1);
    expect(window.localStorage.getItem(backups[0])).toBe("{broken");
  });

  it("does not pile up identical backups", () => {
    let now = 1000;
    const clock = jest.spyOn(Date, "now").mockImplementation(() => (now += 1));
    window.localStorage.setItem(SAVE_KEY, "{broken");
    loadProgress();
    loadProgress();
    clock.mockRestore();
    const backups = Object.keys(window.localStorage).filter((k) =>
      k.startsWith(`${SAVE_KEY}:backup:`)
    );
    expect(backups).toHaveLength(1);
  });

  it("reports a failed write instead of throwing", () => {
    const spy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("full");
      });
    expect(saveProgress(newProgress())).toBe(false);
    spy.mockRestore();
  });
});
