import {
  newProgress,
  recordDailyFlight,
  recordFlight,
} from "../../economy/progress";
import { encodeGhost, type GhostPose } from "../../ghost/ghost";
import type { FlightResult } from "../../sim/flight";
import { SAVE_VERSION, parseSave } from "../schema";

const poses: GhostPose[] = Array.from({ length: 12 }, (_, i) => ({
  x: i * 6,
  y: 8,
  z: 0,
  heading: 0,
  pitch: 0,
  bank: 0,
}));
const ghost = (time: number) => encodeGhost(time, poses);

const finish = (time: number): FlightResult => ({
  distance: 1000,
  coins: 0,
  rings: 0,
  finished: true,
  finishTime: time,
  endReason: "runout",
});

describe("save v4", () => {
  it("round-trips ghosts and the daily best", () => {
    const p = newProgress();
    p.bestTimes = { meadow: 20 };
    p.ghosts = { meadow: ghost(20) };
    p.dailyBest = { date: "2026-10-30", time: 22.5, ghost: ghost(22.5) };
    expect(parseSave({ version: SAVE_VERSION, progress: p })).toEqual(p);
  });

  it("migrates a v3 save with empty ghosts", () => {
    const { ghosts, dailyBest, ...old } = newProgress();
    expect(ghosts).toEqual({});
    expect(dailyBest).toBeNull();
    const parsed = parseSave({ version: 3, progress: old });
    expect(parsed?.ghosts).toEqual({});
    expect(parsed?.dailyBest).toBeNull();
  });

  it("drops a damaged ghost without losing the save", () => {
    const p = newProgress();
    const parsed = parseSave({
      version: SAVE_VERSION,
      progress: {
        ...p,
        ghosts: { meadow: { time: 5, data: [1, 2, 3] }, canyon: ghost(30) },
        dailyBest: { date: "tomorrow", time: 5, ghost: ghost(5) },
      },
    });
    expect(parsed?.ghosts).toEqual({ canyon: ghost(30) });
    expect(parsed?.dailyBest).toBeNull();
  });
});

describe("recordFlight ghosts", () => {
  it("keeps the ghost of a new best time", () => {
    const first = recordFlight(
      newProgress(),
      "meadow",
      finish(30),
      0,
      ghost(30)
    );
    expect(first.progress.ghosts.meadow).toEqual(ghost(30));
    const faster = recordFlight(
      first.progress,
      "meadow",
      finish(25),
      0,
      ghost(25)
    );
    expect(faster.progress.ghosts.meadow).toEqual(ghost(25));
  });

  it("keeps the old ghost when the new flight is slower", () => {
    const first = recordFlight(
      newProgress(),
      "meadow",
      finish(30),
      0,
      ghost(30)
    );
    const slower = recordFlight(
      first.progress,
      "meadow",
      finish(35),
      0,
      ghost(35)
    );
    expect(slower.progress.ghosts.meadow).toEqual(ghost(30));
  });

  it("saves no ghost when there is none", () => {
    const r = recordFlight(newProgress(), "meadow", finish(30), 0, null);
    expect(r.progress.ghosts).toEqual({});
  });
});

describe("recordDailyFlight", () => {
  const day = "2026-10-30";
  it("sets today's best, only improving it", () => {
    const a = recordDailyFlight(
      newProgress(),
      "canyon",
      finish(40),
      5,
      day,
      ghost(40)
    );
    expect(a.dailyBest).toEqual({ date: day, time: 40, ghost: ghost(40) });
    const slower = recordDailyFlight(
      a,
      "canyon",
      finish(45),
      5,
      day,
      ghost(45)
    );
    expect(slower.dailyBest?.time).toBe(40);
    const faster = recordDailyFlight(
      a,
      "canyon",
      finish(38),
      5,
      day,
      ghost(38)
    );
    expect(faster.dailyBest?.time).toBe(38);
  });

  it("replaces yesterday's best with a slower time today", () => {
    const a = recordDailyFlight(
      newProgress(),
      "canyon",
      finish(30),
      0,
      "2026-10-29",
      ghost(30)
    );
    const b = recordDailyFlight(a, "canyon", finish(50), 0, day, ghost(50));
    expect(b.dailyBest).toEqual({ date: day, time: 50, ghost: ghost(50) });
  });

  it("pays coins but leaves the world's own records alone", () => {
    const p = recordDailyFlight(
      newProgress(),
      "canyon",
      finish(40),
      120,
      day,
      ghost(40)
    );
    expect(p.levels.canyon.coins).toBe(120);
    expect(p.levels.canyon.best).toBe(0);
    expect(p.levels.canyon.finished).toBe(false);
    expect(p.bestTimes).toEqual({});
    expect(p.runFlights).toBe(0);
    expect(p.unlocked).toEqual(["meadow"]);
  });

  it("sets no best for an unfinished flight", () => {
    const unfinished: FlightResult = {
      ...finish(1),
      finished: false,
      finishTime: null,
    };
    const p = recordDailyFlight(
      newProgress(),
      "canyon",
      unfinished,
      10,
      day,
      null
    );
    expect(p.dailyBest).toBeNull();
    expect(p.levels.canyon.coins).toBe(10);
  });
});
