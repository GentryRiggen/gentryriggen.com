import { scoreFor } from "@/lib/leaderboard/types";
import { LEVEL_ORDER, LEVELS } from "../../levels";
import type { FlightResult } from "../../sim/flight";
import {
  newProgress,
  prestige,
  recordDailyFlight,
  recordFlight,
  seasonEntry,
  startSeason,
  type Progress,
} from "../progress";

const flight = (over: Partial<FlightResult> = {}): FlightResult => ({
  distance: 100,
  coins: 0,
  rings: 0,
  finished: false,
  finishTime: null,
  endReason: "crash",
  ...over,
});

const finish = (id: (typeof LEVEL_ORDER)[number], time = 100) =>
  flight({
    distance: LEVELS[id].finishDistance,
    finished: true,
    finishTime: time,
    endReason: "landed",
  });

/** Flies every world once, finishing each: a full run. */
function flyRun(p: Progress): Progress {
  let next = p;
  for (const id of LEVEL_ORDER) {
    next = recordFlight(next, id, finish(id), 0).progress;
  }
  return next;
}

describe("season stats", () => {
  it("a new save has never seen a season", () => {
    expect(newProgress().season).toEqual({
      number: 0,
      prestiges: 0,
      distance: 0,
      bestTimes: {},
      fastestRun: null,
      runCounts: true,
    });
  });

  it("startSeason zeroes season stats but keeps lifetime progress", () => {
    const p = newProgress();
    p.prestige.level = 7;
    p.lifetimeDistance = 900000;
    p.fastestRun = 20;
    p.bestTimes = { meadow: 30 };
    p.season = {
      number: 2,
      prestiges: 3,
      distance: 5000,
      bestTimes: { meadow: 31 },
      fastestRun: 25,
      runCounts: true,
    };
    const next = startSeason(p, 3);
    expect(next.prestige.level).toBe(7);
    expect(next.lifetimeDistance).toBe(900000);
    expect(next.fastestRun).toBe(20);
    expect(next.bestTimes).toEqual({ meadow: 30 });
    expect(next.season).toEqual({
      number: 3,
      prestiges: 0,
      distance: 0,
      bestTimes: {},
      fastestRun: null,
      runCounts: true,
    });
  });

  it("startSeason mid-run means the run does not count", () => {
    const p = { ...newProgress(), runFlights: 4 };
    expect(startSeason(p, 2).season.runCounts).toBe(false);
  });

  it("recordFlight adds distance and min best time to the season", () => {
    let p = startSeason(newProgress(), 2);
    p = recordFlight(p, "meadow", flight({ distance: 250 }), 0).progress;
    p = recordFlight(p, "meadow", finish("meadow", 40), 0).progress;
    p = recordFlight(p, "meadow", finish("meadow", 45), 0).progress;
    expect(p.season.distance).toBe(250 + 2 * LEVELS.meadow.finishDistance);
    expect(p.season.bestTimes).toEqual({ meadow: 40 });
    expect(p.season.number).toBe(2);
  });

  it("prestige bumps season.prestiges and sets runCounts", () => {
    const p = startSeason({ ...newProgress(), runFlights: 3 }, 2);
    expect(p.season.runCounts).toBe(false);
    const next = prestige(p);
    expect(next.season.prestiges).toBe(1);
    expect(next.season.runCounts).toBe(true);
  });

  it("run started before the season does not count as a season fastest run", () => {
    let p = recordFlight(newProgress(), "meadow", finish("meadow"), 0).progress;
    p = startSeason(p, 2);
    // Finish the rest of the run inside the season.
    for (const id of LEVEL_ORDER.slice(1)) {
      p = recordFlight(p, id, finish(id), 0).progress;
    }
    expect(p.fastestRun).toBe(LEVEL_ORDER.length);
    expect(p.season.fastestRun).toBeNull();
    p = flyRun(prestige(p));
    expect(p.season.fastestRun).toBe(LEVEL_ORDER.length);
  });

  it("recordDailyFlight leaves the season alone", () => {
    const p = startSeason(newProgress(), 2);
    const ghost = { time: 30, data: [] };
    const next = recordDailyFlight(
      p,
      "meadow",
      finish("meadow", 30),
      50,
      "2026-10-30",
      ghost
    );
    expect(next.season).toBe(p.season);
  });

  it("seasonEntry carries the nickname and season stats", () => {
    let p: Progress = {
      ...startSeason(newProgress(), 2),
      nickname: "Happy Otter 7",
    };
    p = { ...p, prestige: { ...p.prestige, level: 9 }, lifetimeDistance: 1e7 };
    p = flyRun(p);
    p = prestige(p);
    const entry = seasonEntry(p);
    expect(entry).toEqual({
      nickname: "Happy Otter 7",
      prestige: 1,
      score: scoreFor(1, p.season.distance),
      lifetimeDistance: p.season.distance,
      bestTimes: p.season.bestTimes,
      fastestRun: LEVEL_ORDER.length,
    });
  });
});
