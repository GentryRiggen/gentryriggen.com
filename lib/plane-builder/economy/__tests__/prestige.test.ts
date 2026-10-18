import { LEVELS, LEVEL_ORDER } from "../../levels";
import type { FlightResult } from "../../sim/flight";
import { squareAt } from "../../prestige/board";
import { TREASURE_COINS } from "../../prestige/bonuses";
import { payout } from "../payout";
import {
  canPrestige,
  moveOnMap,
  newLevelProgress,
  newProgress,
  prestige,
  recordFlight,
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

function allFinishedExceptIslands(): Progress {
  const p = newProgress();
  for (const id of LEVEL_ORDER) p.levels[id].finished = id !== "islands";
  p.unlocked = [...LEVEL_ORDER];
  return p;
}

describe("payout coinFactor", () => {
  it("multiplies the total after the minimum payout", () => {
    const level = LEVELS.meadow;
    const base = payout(level, flight({ distance: 0 }), 1);
    expect(base.total).toBe(level.minPayout);
    expect(payout(level, flight({ distance: 0 }), 1, 0, 3).total).toBe(
      level.minPayout * 3
    );
  });
  it("defaults to 1", () => {
    const a = payout(LEVELS.meadow, flight({ distance: 500 }), 2, 0);
    const b = payout(LEVELS.meadow, flight({ distance: 500 }), 2, 0, 1);
    expect(a).toEqual(b);
  });
});

describe("canPrestige", () => {
  it("needs the islands finished", () => {
    expect(canPrestige(newProgress())).toBe(false);
    const p = newProgress();
    p.levels.islands.finished = true;
    expect(canPrestige(p)).toBe(true);
  });
  it("is off while a move is owed", () => {
    const p = newProgress();
    p.levels.islands.finished = true;
    p.prestige.movePending = true;
    expect(canPrestige(p)).toBe(false);
  });
});

describe("prestige", () => {
  function done(): Progress {
    const p = allFinishedExceptIslands();
    p.levels.islands.finished = true;
    p.levels.meadow.coins = 777;
    p.levels.meadow.tiers = { ...p.levels.meadow.tiers, wings: 2 };
    p.prestige.bonuses.treasure = 3;
    p.prestige.bonuses.star = 1;
    p.prestige.x = 4;
    p.prestige.visited = ["4,0"];
    p.lifetimeDistance = 1234;
    p.runFlights = 55;
    p.fastestRun = 40;
    p.bestTimes = { meadow: 9 };
    p.nickname = "Swift Falcon";
    return p;
  }

  it("resets worlds, owes a move and bumps the level", () => {
    const next = prestige(done());
    expect(next.unlocked).toEqual(["meadow"]);
    expect(next.prestige.level).toBe(1);
    expect(next.prestige.movePending).toBe(true);
    expect(next.runFlights).toBe(0);
    for (const id of LEVEL_ORDER) {
      expect(next.levels[id]).toEqual({
        ...newLevelProgress(),
        coins: 3 * TREASURE_COINS,
      });
    }
  });

  it("keeps position, bonuses and stats", () => {
    const before = done();
    const next = prestige(before);
    expect(next.prestige).toMatchObject({
      x: 4,
      y: 0,
      visited: ["4,0"],
      bonuses: before.prestige.bonuses,
    });
    expect(next).toMatchObject({
      lifetimeDistance: 1234,
      fastestRun: 40,
      bestTimes: { meadow: 9 },
      nickname: "Swift Falcon",
    });
  });

  it("gives no coins without Treasure Chests", () => {
    const p = done();
    p.prestige.bonuses.treasure = 0;
    expect(prestige(p).levels.meadow.coins).toBe(0);
  });
});

describe("moveOnMap", () => {
  const pending = (): Progress => {
    const p = newProgress();
    p.prestige.movePending = true;
    return p;
  };

  it("refuses without a pending move", () => {
    expect(moveOnMap(newProgress(), 1, 0)).toEqual({ ok: false });
  });

  it("refuses anything but one orthogonal step", () => {
    for (const [dx, dy] of [
      [0, 0],
      [1, 1],
      [2, 0],
      [0.5, 0.5],
      [NaN, 0],
    ]) {
      expect(moveOnMap(pending(), dx, dy)).toEqual({ ok: false });
    }
  });

  it("moves, collects the square once and clears the pending flag", () => {
    const r = moveOnMap(pending(), 1, 0);
    if (!r.ok) throw new Error("expected a move");
    expect(r.collected).toBe(squareAt(1, 0));
    expect(r.progress.prestige).toMatchObject({
      x: 1,
      y: 0,
      movePending: false,
      visited: ["1,0"],
    });
    const total = Object.values(r.progress.prestige.bonuses).reduce(
      (a, b) => a + b,
      0
    );
    expect(total).toBe(r.collected ? 1 : 0);
    if (r.collected) expect(r.progress.prestige.bonuses[r.collected]).toBe(1);
  });

  it("collects nothing when stepping back onto a visited square", () => {
    const first = moveOnMap(pending(), 1, 0);
    if (!first.ok) throw new Error("expected a move");
    const again = moveOnMap(
      {
        ...first.progress,
        prestige: { ...first.progress.prestige, movePending: true },
      },
      -1,
      0
    );
    const back = moveOnMap(
      {
        ...first.progress,
        prestige: { ...first.progress.prestige, movePending: true },
      },
      1,
      0
    );
    if (!again.ok || !back.ok) throw new Error("expected moves");
    // (0, 0) is empty and (2, 0) is new; now step back onto (1, 0).
    const onto = moveOnMap(
      {
        ...back.progress,
        prestige: { ...back.progress.prestige, movePending: true },
      },
      -1,
      0
    );
    if (!onto.ok) throw new Error("expected a move");
    expect(onto.collected).toBeNull();
    expect(onto.progress.prestige.visited).toEqual(
      back.progress.prestige.visited
    );
  });

  it("does not mutate its input", () => {
    const p = pending();
    const snapshot = JSON.stringify(p);
    moveOnMap(p, 0, 1);
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});

describe("recordFlight stats", () => {
  it("adds up lifetime distance and run flights", () => {
    let p = newProgress();
    p = recordFlight(p, "meadow", flight({ distance: 300 }), 0).progress;
    p = recordFlight(p, "meadow", flight({ distance: 200 }), 0).progress;
    expect(p.lifetimeDistance).toBe(500);
    expect(p.runFlights).toBe(2);
  });

  it("keeps the fastest finish time per world", () => {
    let p = newProgress();
    const win = (t: number) =>
      flight({ distance: 2000, finished: true, finishTime: t });
    p = recordFlight(p, "meadow", win(30), 0).progress;
    p = recordFlight(p, "meadow", win(20), 0).progress;
    p = recordFlight(p, "meadow", win(25), 0).progress;
    p = recordFlight(p, "meadow", flight(), 0).progress;
    expect(p.bestTimes).toEqual({ meadow: 20 });
  });

  it("sets fastestRun when the tenth world finishes, keeping the minimum", () => {
    let p = allFinishedExceptIslands();
    p.runFlights = 11;
    p = recordFlight(
      p,
      "islands",
      flight({ finished: true, finishTime: 50 }),
      0
    ).progress;
    expect(p.fastestRun).toBe(12);
    // A later flight in the same run doesn't count again.
    p = recordFlight(p, "islands", flight({ finished: true }), 0).progress;
    expect(p.fastestRun).toBe(12);
    // A slower second run leaves the record alone.
    const q = { ...allFinishedExceptIslands(), fastestRun: 12, runFlights: 30 };
    expect(
      recordFlight(q, "islands", flight({ finished: true }), 0).progress
        .fastestRun
    ).toBe(12);
    // A faster one replaces it.
    const r = { ...allFinishedExceptIslands(), fastestRun: 12, runFlights: 4 };
    expect(
      recordFlight(r, "islands", flight({ finished: true }), 0).progress
        .fastestRun
    ).toBe(5);
  });

  it("leaves fastestRun alone while worlds remain", () => {
    const p = recordFlight(
      newProgress(),
      "meadow",
      flight({ distance: 2000, finished: true }),
      0
    ).progress;
    expect(p.fastestRun).toBeNull();
  });
});
