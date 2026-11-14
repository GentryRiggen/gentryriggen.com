import type { Lift } from "@/lib/jim/view";
import {
  movementPage,
  neighborDays,
  prLifts,
  trainingDays,
  yearWeeks,
} from "../training";

function lift(
  date: string,
  weight: number | null,
  reps: number,
  extra: Partial<Lift> = {}
): Lift {
  return {
    date,
    movement: "Back squat",
    weight,
    unit: "lb",
    reps,
    repUnit: "",
    sets: 1,
    kind: "strength",
    note: "",
    ...extra,
  };
}

describe("prLifts", () => {
  it("marks a set a PR only when nothing earlier was as heavy for as many reps", () => {
    const a = lift("2026-09-01", 200, 5);
    const b = lift("2026-09-08", 210, 3); // fewer reps, heavier: a PR at 3
    const c = lift("2026-09-15", 200, 5); // ties a: not a PR
    const d = lift("2026-09-22", 205, 5); // beats a: a PR
    const wod = lift("2026-09-23", 300, 1, { kind: "wod" });
    const prs = prLifts([a, b, c, d, wod]);
    expect([a, b, c, d, wod].map((l) => prs.has(l))).toEqual([
      true,
      true,
      false,
      true,
      false,
    ]);
  });

  it("counts only the heaviest of a day's equal sets", () => {
    const light = lift("2026-09-01", 180, 5);
    const heavy = lift("2026-09-01", 200, 5);
    const prs = prLifts([heavy, light]);
    expect(prs.has(heavy)).toBe(true);
    expect(prs.has(light)).toBe(false);
  });

  it("marks PRs on a strength set measured in inches, like the Mac", () => {
    const box = { movement: "Box jump", unit: "in" } as const;
    const low = lift("2026-09-01", 24, 5, box);
    const high = lift("2026-09-08", 30, 5, box);
    const same = lift("2026-09-15", 30, 5, box);
    const prs = prLifts([low, high, same]);
    expect([low, high, same].map((l) => prs.has(l))).toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe("trainingDays", () => {
  it("groups full dates and skips month-only ones", () => {
    const days = trainingDays({
      lifts: [lift("2026-09-01", 200, 5), lift("2026-08", 190, 5)],
      workouts: [
        {
          date: "2026-09-01",
          type: "AMRAP",
          workout: "",
          score: "5",
          rx: "",
          note: "",
        },
        {
          date: "2026-09-03",
          type: "For time",
          workout: "",
          score: "9:00",
          rx: "",
          note: "",
        },
      ],
    });
    expect([...days.keys()].sort()).toEqual(["2026-09-01", "2026-09-03"]);
    expect(days.get("2026-09-01")!.lifts).toHaveLength(1);
    expect(neighborDays(days, "2026-09-01")).toEqual({
      prev: null,
      next: "2026-09-03",
    });
    expect(neighborDays(days, "2026-09-02")).toEqual({
      prev: "2026-09-01",
      next: "2026-09-03",
    });
  });
});

describe("movementPage", () => {
  it("finds the movement by slug with rows newest first and a daily 1RM trend", () => {
    const page = movementPage(
      [
        lift("2026-09-01", 200, 5),
        lift("2026-09-01", 210, 3),
        lift("2026-10-01", 250, 1),
        lift("2026-10-02", 100, 5, { movement: "Bench press" }),
      ],
      "back-squat",
      "2026-10-31"
    )!;
    expect(page.movement.name).toBe("Back squat");
    expect(page.rows.map((l) => l.date)).toEqual([
      "2026-10-01",
      "2026-09-01",
      "2026-09-01",
    ]);
    // 200 × (1 + 5/30) = 233.3; 210 × 1.1 = 231: the day's best is 233.
    expect(page.trend).toEqual([
      { date: "2026-09-01", v: 233 },
      { date: "2026-10-01", v: 250 },
    ]);
    expect(page.trendTrimmed).toBe(false);
  });

  it("keeps the trend to the past year when that has two days or more", () => {
    const page = movementPage(
      [
        lift("2024-01-01", 150, 1),
        lift("2026-09-01", 200, 1),
        lift("2026-10-01", 210, 1),
      ],
      "back-squat",
      "2026-10-31"
    )!;
    expect(page.trend.map((p) => p.date)).toEqual(["2026-09-01", "2026-10-01"]);
    expect(page.trendTrimmed).toBe(true);
  });

  it("is null for an unknown slug", () => {
    expect(
      movementPage([lift("2026-09-01", 1, 1)], "deadlift", "2026-10-31")
    ).toBeNull();
  });
});

describe("yearWeeks", () => {
  it("covers 365 days in Sunday-first weeks, ending today", () => {
    const weeks = yearWeeks("2026-10-31", (d) => (d === "2026-10-31" ? 3 : 0));
    const days = weeks.flatMap((w) => w.days).filter(Boolean);
    expect(days).toHaveLength(365);
    expect(days[0]!.date).toBe("2025-11-01");
    expect(days.at(-1)).toEqual({ date: "2026-10-31", level: 3 });
    // 2025-11-01 was a Saturday: six blanks before it.
    expect(weeks[0].days.slice(0, 6)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});
