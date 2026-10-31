import { newProgress, newSeason } from "../../economy/progress";
import { SAVE_VERSION, parseSave } from "../schema";

const v4Progress = () => {
  const progress: Record<string, unknown> = {
    ...newProgress(),
    lifetimeDistance: 5000,
    bestTimes: { meadow: 20 },
  };
  delete progress.season;
  return progress;
};

describe("save v5 (leaderboard seasons)", () => {
  it("is version 5", () => {
    expect(SAVE_VERSION).toBe(5);
  });

  it("migrates a v4 save with season 0 and empty season stats", () => {
    const parsed = parseSave({ version: 4, progress: v4Progress() });
    expect(parsed).not.toBeNull();
    expect(parsed?.season).toEqual(newSeason());
    // Lifetime stats are untouched.
    expect(parsed?.lifetimeDistance).toBe(5000);
    expect(parsed?.bestTimes).toEqual({ meadow: 20 });
  });

  it("round-trips season stats", () => {
    const p = newProgress();
    p.season = {
      number: 3,
      prestiges: 2,
      distance: 140000.5,
      bestTimes: { meadow: 18, canyon: 40 },
      fastestRun: 22,
      runCounts: false,
    };
    expect(parseSave({ version: SAVE_VERSION, progress: p })).toEqual(p);
  });

  it("rejects a bad season like any other bad field", () => {
    const base = newSeason();
    const bad: unknown[] = [
      undefined,
      null,
      "season",
      { ...base, number: -1 },
      { ...base, number: 1.5 },
      { ...base, prestiges: -1 },
      { ...base, prestiges: 0.5 },
      { ...base, distance: -3 },
      { ...base, distance: "far" },
      { ...base, bestTimes: { meadow: -1 } },
      { ...base, bestTimes: null },
      { ...base, fastestRun: 0 },
      { ...base, fastestRun: "fast" },
      { ...base, runCounts: "yes" },
    ];
    for (const season of bad) {
      const progress = { ...newProgress(), season };
      expect(parseSave({ version: SAVE_VERSION, progress })).toBeNull();
    }
  });
});
