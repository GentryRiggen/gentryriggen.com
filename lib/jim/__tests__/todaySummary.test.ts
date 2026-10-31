import { todaySummary } from "../notesData";
import type { ViewData } from "../view";
import { VIEW_FIXTURE } from "./fixtures";

/** 2026-10-31 at 13:00 UTC: before the 16:00 UTC standup in any US zone. */
const MORNING = new Date("2026-10-31T13:00:00Z");

describe("todaySummary", () => {
  it("gives the next meeting today, days since the last injection and this week's workouts", () => {
    expect(todaySummary(VIEW_FIXTURE, MORNING)).toEqual({
      meeting: { time: expect.any(String), subject: "Team standup" },
      injectionDays: 3,
      workouts: 1,
    });
  });

  it("skips all-day events and meetings that are over", () => {
    const after = new Date("2026-10-31T17:00:00Z");
    expect(todaySummary(VIEW_FIXTURE, after).meeting).toBeNull();
  });

  it("shows a meeting still running", () => {
    const during = new Date("2026-10-31T16:10:00Z");
    expect(todaySummary(VIEW_FIXTURE, during).meeting?.subject).toBe(
      "Team standup"
    );
  });

  it("ignores a calendar snapshot from another day", () => {
    const old: ViewData = {
      ...VIEW_FIXTURE,
      calendar: {
        ...VIEW_FIXTURE.calendar!,
        fetchedAt: "2026-10-29T15:00:00Z",
      },
    };
    expect(todaySummary(old, MORNING).meeting).toBeNull();
    expect(
      todaySummary({ ...VIEW_FIXTURE, calendar: null }, MORNING).meeting
    ).toBeNull();
  });

  it("counts workout days Monday to Sunday, lifts included", () => {
    const data: ViewData = {
      ...VIEW_FIXTURE,
      training: {
        workouts: [
          { ...VIEW_FIXTURE.training.workouts[0], date: "2026-10-26" },
          { ...VIEW_FIXTURE.training.workouts[0], date: "2026-10-28" },
          // Last Sunday is last week.
          { ...VIEW_FIXTURE.training.workouts[0], date: "2026-10-25" },
        ],
        lifts: [
          // Same day as a workout: one session.
          { ...VIEW_FIXTURE.training.lifts[0], date: "2026-10-28" },
          { ...VIEW_FIXTURE.training.lifts[0], date: "2026-10-30" },
          // A month-only date can't be placed in a week.
          { ...VIEW_FIXTURE.training.lifts[0], date: "2026-10" },
        ],
      },
    };
    expect(todaySummary(data, MORNING).workouts).toBe(3);
  });

  it("is empty when there is nothing to say", () => {
    const empty: ViewData = {
      ...VIEW_FIXTURE,
      calendar: null,
      health: { ...VIEW_FIXTURE.health, injections: [] },
      training: { lifts: [], workouts: [] },
    };
    expect(todaySummary(empty, MORNING)).toEqual({
      meeting: null,
      injectionDays: null,
      workouts: null,
    });
  });

  it("says 0 days on an injection day", () => {
    const data: ViewData = {
      ...VIEW_FIXTURE,
      health: {
        ...VIEW_FIXTURE.health,
        injections: [
          { date: "2026-10-31", time: "", mg: 50, ml: "", note: "" },
        ],
      },
    };
    expect(todaySummary(data, MORNING).injectionDays).toBe(0);
  });
});
