import { newProgress } from "../../economy/progress";
import { SAVE_KEY, loadProgress, saveProgress } from "../local";
import { SAVE_VERSION, parseSave } from "../schema";

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
      version: 1,
      progress: { ...progress, levels: rest },
    });
    expect(parsed?.levels.mountains).toEqual(newProgress().levels.mountains);
  });

  it.each([
    ["not an object", 42],
    ["newer version", { version: 99, progress: newProgress() }],
    [
      "bad tier",
      (() => {
        const p = newProgress();
        p.levels.meadow.tiers.wings = 9;
        return { version: 1, progress: p };
      })(),
    ],
    [
      "negative coins",
      (() => {
        const p = newProgress();
        p.levels.meadow.coins = -1;
        return { version: 1, progress: p };
      })(),
    ],
    [
      "unknown level",
      {
        version: 1,
        progress: { ...newProgress(), unlocked: ["meadow", "moon"] },
      },
    ],
  ])("rejects %s", (_, raw) => {
    expect(parseSave(raw)).toBeNull();
  });

  it("orders unlocks and always includes the meadow", () => {
    const p = { ...newProgress(), unlocked: ["canyon"] };
    expect(parseSave({ version: 1, progress: p })?.unlocked).toEqual([
      "meadow",
      "canyon",
    ]);
  });
});

describe("local storage", () => {
  it("starts fresh with nothing stored", () => {
    expect(loadProgress()).toEqual({
      progress: newProgress(),
      recovered: false,
    });
  });

  it("saves and loads", () => {
    const p = newProgress();
    p.levels.meadow.coins = 42;
    expect(saveProgress(p)).toBe(true);
    expect(loadProgress().progress.levels.meadow.coins).toBe(42);
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
