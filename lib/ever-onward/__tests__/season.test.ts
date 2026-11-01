import { DEFAULT_SEASON, SEASONS, currentSeason, seasonById } from "../season";

const onDay = (month: number) => new Date(2026, month - 1, 15, 12);

describe("currentSeason", () => {
  it.each([
    [10, "autumn"],
    [11, "autumn"],
    [12, "winter"],
    [1, "winter"],
    [3, "spring"],
    [4, "spring"],
    [5, "spring"],
    [6, "summer"],
    [7, "summer"],
    [8, "summer"],
    [2, "default"],
    [9, "default"],
  ])("month %i is %s", (month, id) => {
    expect(currentSeason(onDay(month)).id).toBe(id);
  });

  it("uses the local calendar day at the month edges", () => {
    expect(currentSeason(new Date(2026, 9, 1, 0, 0)).id).toBe("autumn");
    expect(currentSeason(new Date(2026, 8, 30, 23, 59)).id).toBe("default");
  });

  it("never lets two seasons claim the same month", () => {
    const months = SEASONS.flatMap((s) => s.months);
    expect(new Set(months).size).toBe(months.length);
  });
});

describe("seasonById", () => {
  it("finds a season, the default, or nothing", () => {
    expect(seasonById("winter")?.id).toBe("winter");
    expect(seasonById("default")).toBe(DEFAULT_SEASON);
    expect(seasonById("nope")).toBeNull();
    expect(seasonById(null)).toBeNull();
  });
});
