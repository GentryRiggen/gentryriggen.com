import { analyzeShip } from "../../model/analysis";
import { CELLS_PER_SEGMENT, gridLength } from "../../model/grid";
import { computeStats } from "../../model/stats";
import { emptyShip } from "../../model/placement";
import type { Bulkhead, BulkheadHeight, Ship } from "../../model/types";
import { findTemplate } from "../../templates";
import {
  BOMB_FALL_S,
  BOMB_MAX_THROWN,
  MAX_BOMBS,
  thrownByTime,
  withBomb,
  type BombDrop,
} from "../bombs";
import { compartmentSpecsOf } from "../compartments";
import { explainTrial, formatSeconds } from "../explain";
import { BOOM_QUIET_S } from "../flooding";
import { createTrial, runTrial, stepTrial } from "../seaTrial";
import { simShipFromStats } from "../simShip";
import {
  BLAST_SLOW_MO_SPEED,
  buildTimeline,
  holdUntil,
  slowMoSpeed,
  stateAt,
  timelineEnd,
} from "../timeline";
import { trialFunnelsOf } from "../trialFunnels";
import { isTimelineTrial, trialKindOf } from "../trialKind";
import type { BombHit, SimState, TrialInput } from "../types";

function walledShip(walls: number, height: BulkheadHeight = "waterline"): Ship {
  const ship = emptyShip("liner", "Test", 10, 4);
  const bulkheads: Bulkhead[] = Array.from({ length: walls }, (_, i) => ({
    at: i + 1,
    height,
  }));
  return { ...ship, hull: { ...ship.hull, bulkheads } };
}

function boomInput(ship: Ship, bombs: BombHit[]): TrialInput {
  const length = ship.hull.lengthSegments * CELLS_PER_SEGMENT;
  return {
    ship: simShipFromStats(computeStats(ship), ship.hull.beam),
    sea: "calm",
    funnels: [],
    length,
    boom: { compartments: compartmentSpecsOf(ship.hull), length, bombs },
  };
}

function sunkAt(state: SimState): number | undefined {
  return state.events.find((event) => event.kind === "sunk")?.at;
}

describe("Boom! sinking", () => {
  it("is its own timeline trial", () => {
    const input = boomInput(walledShip(0), [{ at: 1, impactX: 10 }]);
    expect(trialKindOf(input)).toBe("boom");
    expect(isTimelineTrial(input)).toBe(true);
  });

  it("takes no water before the first bomb goes off", () => {
    const input = boomInput(walledShip(0), [{ at: 5, impactX: 10 }]);
    let state = createTrial(input);
    while (state.time < 4.9) state = stepTrial(input, state);
    expect(state.compartments.every((c) => c.water === 0)).toBe(true);
    expect(state.events.some((e) => e.kind === "flooding")).toBe(false);
  });

  it("gives one bomb a long, slow sinking, and more bombs a quicker one", () => {
    const ship = walledShip(0);
    const one = sunkAt(runTrial(boomInput(ship, [{ at: 1, impactX: 15 }])));
    const four = sunkAt(
      runTrial(
        boomInput(ship, [
          { at: 1, impactX: 5 },
          { at: 2, impactX: 12 },
          { at: 3, impactX: 19 },
          { at: 4, impactX: 26 },
        ])
      )
    );
    expect(one).toBeDefined();
    expect(four).toBeDefined();
    // Long enough to watch: well over 20 s of real time for one bomb.
    expect(one!).toBeGreaterThan(20);
    expect(four!).toBeLessThan(one!);
  });

  it("lets a well-walled ship ride out one bomb, then waits for the next", () => {
    const end = runTrial(boomInput(walledShip(9), [{ at: 1, impactX: 15 }]));
    expect(end.outcome).toBe("afloat");
    expect(end.time).toBeGreaterThanOrEqual(1 + BOOM_QUIET_S);
    expect(end.compartments.some((c) => c.opened)).toBe(true);
  });

  it("plays the same up to a new bomb, so dropping one mid-run never jumps", () => {
    const ship = walledShip(4);
    const first: BombHit = { at: 1, impactX: 8 };
    const before = buildTimeline(boomInput(ship, [first]));
    const after = buildTimeline(
      boomInput(ship, [first, { at: 12, impactX: 22 }])
    );
    expect(stateAt(after, 11.9)).toEqual(stateAt(before, 11.9));
    expect(stateAt(after, 20).pose).not.toEqual(stateAt(before, 20).pose);
  });

  it("slows playback for a moment at every bomb", () => {
    const timeline = buildTimeline(
      boomInput(walledShip(9), [
        { at: 2, impactX: 5 },
        { at: 8, impactX: 20 },
      ])
    );
    expect(slowMoSpeed(timeline, 1)).toBe(1);
    expect(slowMoSpeed(timeline, 2.3)).toBe(BLAST_SLOW_MO_SPEED);
    expect(slowMoSpeed(timeline, 5)).toBe(1);
    expect(slowMoSpeed(timeline, 8.3)).toBe(BLAST_SLOW_MO_SPEED);
  });

  it("holds a finished timeline on so a late bomb still goes off", () => {
    const timeline = buildTimeline(
      boomInput(walledShip(0), [{ at: 1, impactX: 15 }])
    );
    const end = timelineEnd(timeline);
    const held = holdUntil(timeline, end + 5);
    expect(timelineEnd(held)).toBeGreaterThanOrEqual(end + 5);
    expect(stateAt(held, end + 4).phase).toBe(stateAt(timeline, end).phase);
    expect(holdUntil(timeline, end - 1)).toBe(timeline);
  });

  it("says how long she lasted after the first bomb", () => {
    const input = boomInput(walledShip(0), [
      { at: 1, impactX: 10 },
      { at: 3, impactX: 20 },
    ]);
    const summary = explainTrial(runTrial(input), input);
    expect(summary.title).toBe("Boom! She sank");
    expect(summary.message).toMatch(
      /^She lasted .+ after the first bomb\. It took 2 bombs\.$/
    );
    const afloat = boomInput(walledShip(9), [{ at: 1, impactX: 15 }]);
    expect(explainTrial(runTrial(afloat), afloat).title).toBe(
      "She's still afloat!"
    );
  });

  it("puts a stretch of seconds in plain words", () => {
    expect(formatSeconds(1)).toBe("1 second");
    expect(formatSeconds(42)).toBe("42 seconds");
    expect(formatSeconds(60)).toBe("1 minute");
    expect(formatSeconds(125)).toBe("2 minutes 5 seconds");
  });
});

describe("withBomb", () => {
  const template = findTemplate("titanic");
  if (!template) throw new Error("no titanic");
  const ship = template.build();
  const length = gridLength(ship);
  const base: TrialInput = {
    ship: simShipFromStats(analyzeShip(ship).stats, ship.hull.beam),
    sea: "calm",
    length,
    funnels: trialFunnelsOf(ship),
    boom: {
      compartments: compartmentSpecsOf(ship.hull),
      length,
      bombs: [],
    },
  };
  const drop = (at: number, impactX: number): BombDrop => ({
    at,
    impactX,
    level: 1,
    z: ship.hull.beam / 2,
    point: { x: length / 2 - impactX, y: 2, z: 0 },
  });

  it("blows parts off near the spot, and a second bomb there digs deeper", () => {
    const once = withBomb(base, ship, drop(BOMB_FALL_S, length / 2));
    const first = once.boom!.bombs[0];
    expect(first.thrown!.length).toBeGreaterThan(0);
    expect(first.thrown!.length).toBeLessThanOrEqual(BOMB_MAX_THROWN);
    const twice = withBomb(once, ship, drop(3, length / 2));
    const second = twice.boom!.bombs[1].thrown!;
    expect(second.length).toBeGreaterThan(0);
    expect(second.some((id) => first.thrown!.includes(id))).toBe(false);
    expect(thrownByTime(twice, 2).size).toBe(first.thrown!.length);
    expect(thrownByTime(twice, 3).size).toBe(
      first.thrown!.length + second.length
    );
  });

  it("drops thrown funnels from the sim's list", () => {
    const funnel = trialFunnelsOf(ship)[0];
    const bombed = withBomb(base, ship, {
      ...drop(1, funnel.cellX),
      level: 3,
      z: ship.hull.beam / 2,
    });
    const thrown = new Set(bombed.boom!.bombs[0].thrown);
    for (const left of bombed.funnels) expect(thrown.has(left.id)).toBe(false);
  });

  it("keeps bombs in time order and gives a later bomb's parts to an earlier one", () => {
    const late = withBomb(base, ship, drop(10, length / 2));
    const early = withBomb(late, ship, drop(2, length / 2));
    const [a, b] = early.boom!.bombs;
    expect([a.at, b.at]).toEqual([2, 10]);
    expect(b.thrown!.some((id) => a.thrown!.includes(id))).toBe(false);
  });

  it("stops taking bombs at the most", () => {
    let input = base;
    for (let i = 0; i < MAX_BOMBS; i++)
      input = withBomb(input, ship, drop(i + 1, 5));
    expect(withBomb(input, ship, drop(99, 5))).toBe(input);
  });

  it("ignores a trial that is not Boom!", () => {
    const { boom, ...plain } = base;
    void boom;
    expect(withBomb(plain, ship, drop(1, 5))).toBe(plain);
  });
});
