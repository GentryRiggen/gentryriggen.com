import { LEVEL_ORDER } from "../../levels";
import { canPrestige, newProgress } from "../../economy/progress";
import { SAVE_KEY, loadProgress, saveProgress } from "../local";
import { SAVE_VERSION, parseSave } from "../schema";

beforeEach(() => window.localStorage.clear());

const v3 = (patch: Record<string, unknown>) => {
  const progress = { ...newProgress(), ...patch };
  return { version: SAVE_VERSION, progress };
};

describe("save v3", () => {
  it("is version 3", () => {
    expect(SAVE_VERSION).toBe(3);
  });

  it("round-trips prestige data and stats", () => {
    const p = newProgress();
    p.prestige = {
      level: 3,
      x: -2,
      y: 5,
      visited: ["1,0", "-2,5"],
      bonuses: { ...p.prestige.bonuses, coins: 2, star: 1 },
      movePending: true,
    };
    p.lifetimeDistance = 12345.5;
    p.runFlights = 7;
    p.fastestRun = 30;
    p.bestTimes = { meadow: 12.5, canyon: 40 };
    p.nickname = "Swift Falcon";
    expect(parseSave({ version: SAVE_VERSION, progress: p })).toEqual(p);
  });

  it("rejects bad new fields", () => {
    const base = newProgress();
    const bad: Record<string, unknown>[] = [
      { prestige: { ...base.prestige, level: -1 } },
      { prestige: { ...base.prestige, level: 1.5 } },
      { prestige: { ...base.prestige, x: 0.5 } },
      { prestige: { ...base.prestige, movePending: "yes" } },
      { prestige: { ...base.prestige, visited: [1, 2] } },
      { prestige: { ...base.prestige, visited: ["a,b"] } },
      {
        prestige: { ...base.prestige, visited: new Array(100_001).fill("1,1") },
      },
      {
        prestige: {
          ...base.prestige,
          bonuses: { ...base.prestige.bonuses, coins: -1 },
        },
      },
      {
        prestige: {
          ...base.prestige,
          bonuses: { ...base.prestige.bonuses, star: 1.2 },
        },
      },
      { prestige: undefined },
      { lifetimeDistance: -5 },
      { lifetimeDistance: "far" },
      { runFlights: -1 },
      { fastestRun: 0 },
      { fastestRun: "fast" },
      { bestTimes: { meadow: -3 } },
      { bestTimes: { meadow: "x" } },
      { nickname: 5 },
      { nickname: "x".repeat(41) },
    ];
    for (const patch of bad) expect(parseSave(v3(patch))).toBeNull();
  });

  it("accepts a nickname of exactly 40 characters", () => {
    const parsed = parseSave(v3({ nickname: "x".repeat(40) }));
    expect(parsed?.nickname).toHaveLength(40);
  });

  it("drops unknown world ids from bestTimes", () => {
    const parsed = parseSave(v3({ bestTimes: { meadow: 5, mars: 3 } }));
    expect(parsed?.bestTimes).toEqual({ meadow: 5 });
  });
});

describe("v2 to v3 migration", () => {
  function v2Save() {
    const progress = newProgress();
    const {
      prestige,
      lifetimeDistance,
      runFlights,
      fastestRun,
      bestTimes,
      nickname,
      ...old
    } = progress;
    void [
      prestige,
      lifetimeDistance,
      runFlights,
      fastestRun,
      bestTimes,
      nickname,
    ];
    for (const id of LEVEL_ORDER) old.levels[id].finished = true;
    old.levels.meadow.coins = 321;
    old.unlocked = [...LEVEL_ORDER];
    return { version: 2, progress: old };
  }

  it("keeps the old progress and adds defaults", () => {
    const parsed = parseSave(v2Save());
    expect(parsed).not.toBeNull();
    expect(parsed?.levels.meadow.coins).toBe(321);
    expect(parsed).toMatchObject({
      prestige: newProgress().prestige,
      lifetimeDistance: 0,
      runFlights: 0,
      fastestRun: null,
      bestTimes: {},
      nickname: null,
    });
  });

  it("offers Prestige for a v2 save with every world finished", () => {
    const parsed = parseSave(v2Save());
    expect(parsed && canPrestige(parsed)).toBe(true);
  });

  it("loads from storage without a reset, then saves as v3", () => {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(v2Save()));
    const result = loadProgress();
    expect(result).toMatchObject({ recovered: false, reset: false });
    expect(result.progress.levels.meadow.coins).toBe(321);
    saveProgress(result.progress);
    const stored = JSON.parse(window.localStorage.getItem(SAVE_KEY)!);
    expect(stored.version).toBe(3);
  });

  it("still resets a v1 save", () => {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: 1, progress: newProgress() })
    );
    expect(loadProgress().reset).toBe(true);
  });
});
