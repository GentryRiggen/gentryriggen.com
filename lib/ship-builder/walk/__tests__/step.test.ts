import { canPlace } from "../../model/placement";
import type { PlacedPart, Ship } from "../../model/types";
import { SIM_STEP_S } from "../../sim/types";
import { findTemplate } from "../../templates";
import { attachPart, gridPart, testShip } from "../../testing";
import { stepWalker } from "../step";
import {
  TURN_RATE,
  WALK_SPEED,
  WALKER_RADIUS,
  type WalkGrid,
  type WalkInput,
  type WalkState,
} from "../types";
import { walkGridOf } from "../walkGrid";

const STOPPED: WalkInput = { forward: 0, strafe: 0, turn: 0 };
const FORWARD: WalkInput = { forward: 1, strafe: 0, turn: 0 };
/** Yaw 0 faces the bow (model -x); PI faces the stern (model +x). */
const TO_BOW = 0;
const TO_STERN = Math.PI;
const TO_STARBOARD = Math.PI / 2;

const at = (x: number, z: number, yaw = TO_BOW, level = 0): WalkState => ({
  x,
  z,
  yaw,
  level,
  time: 0,
});

function walk(
  start: WalkState,
  input: WalkInput,
  seconds: number,
  grid: WalkGrid
): WalkState {
  let state = start;
  for (let i = 0; i < Math.round(seconds / SIM_STEP_S); i++) {
    state = stepWalker(state, input, grid);
  }
  return state;
}

describe("stepWalker: moving", () => {
  const grid = walkGridOf(testShip());

  it("walks the open deck at WALK_SPEED toward where it faces", () => {
    const end = walk(at(12, 2), FORWARD, 1, grid);
    expect(12 - end.x).toBeCloseTo(WALK_SPEED, 1);
    expect(end.z).toBeCloseTo(2, 5);
    expect(end.level).toBe(0);
  });

  it("walks toward the stern and the starboard edge with the yaw", () => {
    expect(walk(at(8, 2, TO_STERN), FORWARD, 1, grid).x).toBeGreaterThan(9);
    const star = walk(at(8, 2, TO_STARBOARD), FORWARD, 1, grid);
    expect(star.z).toBeLessThan(2 - WALK_SPEED + 0.1);
    expect(star.x).toBeCloseTo(8, 5);
  });

  it("strafes right toward starboard and left toward port at yaw 0", () => {
    expect(walk(at(8, 2), { ...STOPPED, strafe: 1 }, 0.5, grid).z).toBeLessThan(
      2
    );
    expect(
      walk(at(8, 2), { ...STOPPED, strafe: -1 }, 0.5, grid).z
    ).toBeGreaterThan(2);
  });

  it("goes backward when forward is negative", () => {
    expect(
      walk(at(8, 2), { ...FORWARD, forward: -1 }, 0.5, grid).x
    ).toBeGreaterThan(8);
  });

  it("is no faster on the diagonal", () => {
    const straight = walk(at(12, 2), FORWARD, 1, grid);
    const diagonal = walk(
      at(12, 2),
      { forward: 1, strafe: 1, turn: 0 },
      1,
      grid
    );
    const travelled = Math.hypot(12 - diagonal.x, 2 - diagonal.z);
    expect(travelled).toBeCloseTo(12 - straight.x, 2);
  });

  it("turns right with positive turn, at TURN_RATE, and wraps the yaw", () => {
    const turned = stepWalker(at(8, 2), { ...STOPPED, turn: 1 }, grid);
    expect(turned.yaw).toBeCloseTo(TURN_RATE * SIM_STEP_S, 10);
    expect(turned.x).toBe(8);
    const spun = walk(at(8, 2), { ...STOPPED, turn: 1 }, 10, grid);
    expect(spun.yaw).toBeGreaterThanOrEqual(-Math.PI);
    expect(spun.yaw).toBeLessThan(Math.PI);
  });

  it("advances time by one fixed step, even when standing still", () => {
    expect(stepWalker(at(8, 2), STOPPED, grid).time).toBeCloseTo(
      SIM_STEP_S,
      12
    );
  });

  it("holds out-of-range input to -1..1", () => {
    const wild = walk(at(12, 2), { forward: 50, strafe: 0, turn: 0 }, 1, grid);
    expect(12 - wild.x).toBeCloseTo(WALK_SPEED, 1);
  });

  it("treats non-finite input as 0", () => {
    const start = at(8, 2, 1.2);
    const bad: WalkInput = {
      forward: Number.NaN,
      strafe: Number.POSITIVE_INFINITY,
      turn: Number.NEGATIVE_INFINITY,
    };
    const end = stepWalker(start, bad, grid);
    expect(end.x).toBe(8);
    expect(end.z).toBe(2);
    expect(end.yaw).toBe(1.2);
  });

  it("is deterministic and never mutates the state it is given", () => {
    const start = at(12, 2, 0.3);
    const frozen = JSON.stringify(start);
    const input = { forward: 1, strafe: 0.4, turn: -0.5 };
    const a = walk(start, input, 2, grid);
    const b = walk(start, input, 2, grid);
    expect(a).toEqual(b);
    expect(JSON.stringify(start)).toBe(frozen);
    expect(stepWalker(start, input, grid)).not.toBe(start);
  });

  it("stops at the hull edge: no walking off the deck into a wing column", () => {
    const starboard = walk(at(8, 1), { ...FORWARD }, 5, grid);
    expect(starboard.z).toBeGreaterThanOrEqual(0);
    const toStarboardEdge = walk(at(8, 1, TO_STARBOARD), FORWARD, 5, grid);
    expect(toStarboardEdge.z).toBeCloseTo(WALKER_RADIUS, 2);
    const toBow = walk(at(3, 2, TO_BOW), FORWARD, 5, grid);
    expect(toBow.x).toBeCloseTo(WALKER_RADIUS, 2);
    const toStern = walk(at(20, 2, TO_STERN), FORWARD, 5, grid);
    expect(toStern.x).toBeCloseTo(24 - WALKER_RADIUS, 2);
  });
});

describe("stepWalker: obstacles", () => {
  it("is blocked by a cabin", () => {
    const grid = walkGridOf(testShip([gridPart("c", "cabin-1st", 0, 8, 2)]));
    const end = walk(at(12, 2.5), FORWARD, 5, grid);
    expect(end.x).toBeCloseTo(9 + WALKER_RADIUS, 2);
    expect(end.level).toBe(0);
  });

  it("slides along a wall instead of sticking to it", () => {
    const wall = [0, 1, 2, 3].map((z) =>
      gridPart(`w${z}`, "cabin-1st", 0, 8, z)
    );
    const grid = walkGridOf(testShip(wall));
    // Toward the bow and a little to port: the wall stops x, z carries on.
    const start = at(12, 0.8, -0.5);
    const end = walk(start, FORWARD, 3, grid);
    expect(end.x).toBeCloseTo(9 + WALKER_RADIUS, 2);
    expect(end.z - start.z).toBeGreaterThan(0.6);
  });

  it("slides around a cabin corner and carries on", () => {
    const grid = walkGridOf(testShip([gridPart("c", "cabin-1st", 0, 8, 1)]));
    // Aimed just inside the cabin's port face; the corner rounds it clear.
    const end = walk(at(12, 1.6, -0.2), FORWARD, 6, grid);
    expect(end.x).toBeLessThan(8);
  });

  it("is blocked by a pool, a deck chair and a bridge", () => {
    for (const type of ["pool", "deckchair", "bridge-3"] as const) {
      const grid = walkGridOf(testShip([gridPart("x", type, 0, 8, 1)]));
      const end = walk(at(12, 1.5), FORWARD, 5, grid);
      expect(end.x).toBeGreaterThanOrEqual(9 + WALKER_RADIUS - 1e-6);
    }
  });

  it("cannot step off a roof edge", () => {
    const grid = walkGridOf(
      testShip([
        gridPart("a", "cabin-1st", 0, 8, 1),
        gridPart("b", "cabin-1st", 0, 9, 1),
      ])
    );
    const roof = at(8.5, 1.5, TO_STERN, 1);
    for (const yaw of [TO_BOW, TO_STERN, TO_STARBOARD, -TO_STARBOARD]) {
      const end = walk({ ...roof, yaw }, FORWARD, 4, grid);
      expect(end.level).toBe(1);
      expect(end.x).toBeGreaterThanOrEqual(8 + WALKER_RADIUS - 1e-6);
      expect(end.x).toBeLessThanOrEqual(10 - WALKER_RADIUS + 1e-6);
      expect(end.z).toBeGreaterThanOrEqual(1 + WALKER_RADIUS - 1e-6);
      expect(end.z).toBeLessThanOrEqual(2 - WALKER_RADIUS + 1e-6);
    }
  });

  it("cannot walk into a wing column without a deck", () => {
    const grid = walkGridOf(testShip());
    const end = walk(at(8, 0.6, TO_STARBOARD), FORWARD, 3, grid);
    expect(end.z).toBeGreaterThanOrEqual(WALKER_RADIUS - 1e-6);
  });

  it("is stopped by a funnel", () => {
    const strip = [3, 4, 5, 6, 7].map((x) =>
      gridPart(`d${x}`, "deck-1x1", 0, x, 1)
    );
    const ship = testShip([
      ...strip,
      attachPart("f", "funnel", "d5", "funnel"),
    ]);
    const grid = walkGridOf(ship);
    expect(grid.blockers).toHaveLength(1);
    const start = at(3.5, 1.5, TO_STERN, 1);
    const end = walk(start, FORWARD, 4, grid);
    // The funnel's circle is centred on 5.5 with radius 0.45.
    expect(end.x).toBeCloseTo(5.5 - 0.45 - WALKER_RADIUS, 2);
  });

  it("walks past a funnel on the level below, where it does not stand", () => {
    const ship = testShip([
      gridPart("d5", "deck-1x1", 0, 5, 1),
      attachPart("f", "funnel", "d5", "funnel"),
    ]);
    const grid = walkGridOf(ship);
    const end = walk(at(3.5, 2.5, TO_STERN, 0), FORWARD, 3, grid);
    expect(end.x).toBeGreaterThan(6);
  });

  it("slides around a funnel's circle", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 5, 1),
      gridPart("b", "deck-1x1", 0, 4, 1),
      gridPart("c", "deck-1x1", 0, 4, 2),
      gridPart("d", "deck-1x1", 0, 5, 2),
      gridPart("e", "deck-1x1", 0, 6, 1),
      gridPart("f", "deck-1x1", 0, 6, 2),
      attachPart("f1", "funnel", "a", "funnel"),
    ]);
    const grid = walkGridOf(ship);
    // Head-on but slightly off centre: slides past and out the far side.
    const end = walk(at(4.1, 1.6, TO_STERN, 1), FORWARD, 4, grid);
    expect(end.x).toBeGreaterThan(6);
  });
});

describe("stepWalker: stairs", () => {
  const roof = [5, 6, 7].map((x) => gridPart(`d${x}`, "deck-1x1", 0, x, 1));
  const withStairs = testShip([...roof, gridPart("s", "stairs", 0, 4, 1, 0)]);
  const grid = walkGridOf(withStairs);

  it("climbs the stairs onto a deck block", () => {
    const end = walk(at(2.5, 1.5, TO_STERN), FORWARD, 3, grid);
    expect(end.level).toBe(1);
    expect(end.x).toBeGreaterThan(5);
  });

  it("goes down the stairs again and ends on the main deck", () => {
    const up = walk(at(2.5, 1.5, TO_STERN), FORWARD, 3, grid);
    const down = walk({ ...up, yaw: TO_BOW }, FORWARD, 3, grid);
    expect(down.level).toBe(0);
    expect(down.x).toBeLessThan(4);
  });

  it("does not let you climb onto the block from beside it", () => {
    const end = walk(at(6.5, 0.5, TO_STARBOARD + Math.PI), FORWARD, 3, grid);
    expect(end.level).toBe(0);
    expect(end.z).toBeLessThanOrEqual(1 - WALKER_RADIUS + 1e-6);
  });

  it("does not drop you off the roof's far edge", () => {
    const up = walk(at(2.5, 1.5, TO_STERN), FORWARD, 8, grid);
    expect(up.level).toBe(1);
    expect(up.x).toBeCloseTo(8 - WALKER_RADIUS, 2);
  });

  it("does nothing for stairs that face nothing", () => {
    const bare = walkGridOf(testShip([gridPart("s", "stairs", 0, 4, 1, 0)]));
    const end = walk(at(2.5, 1.5, TO_STERN), FORWARD, 3, bare);
    expect(end.level).toBe(0);
    expect(end.x).toBeGreaterThan(5);
  });

  it("climbs a cabin roof and keeps walking it", () => {
    const cabinRoof = walkGridOf(
      testShip([
        gridPart("c1", "cabin-1st", 0, 5, 1),
        gridPart("c2", "cabin-1st", 0, 6, 1),
        gridPart("s", "stairs", 0, 4, 1, 0),
      ])
    );
    const end = walk(at(2.5, 1.5, TO_STERN), FORWARD, 3, cabinRoof);
    expect(end.level).toBe(1);
  });
});

describe("stepWalker: never leaves the walkable region", () => {
  /** A small deterministic generator, so a failure replays. */
  function lcg(seed: number): () => number {
    let value = seed;
    return () => {
      value = (value * 1664525 + 1013904223) % 4294967296;
      return value / 4294967296;
    };
  }

  function wander(ship: Ship, start: WalkState, seed: number) {
    const grid = walkGridOf(ship);
    const random = lcg(seed);
    let state = start;
    let input: WalkInput = STOPPED;
    for (let i = 0; i < 6000; i++) {
      if (i % 40 === 0) {
        input = {
          forward: random() * 2 - 1,
          strafe: random() * 2 - 1,
          turn: random() * 2 - 1,
        };
      }
      state = stepWalker(state, input, grid);
      const cellX = Math.floor(state.x);
      const cellZ = Math.floor(state.z);
      if (!grid.isWalkable(cellX, cellZ, state.level)) {
        throw new Error(`Left the deck at step ${i}: ${JSON.stringify(state)}`);
      }
    }
    return state;
  }

  it("on a ship with stairs, cabins and a funnel", () => {
    const ship = testShip([
      ...[5, 6, 7, 8].flatMap((x) =>
        [0, 1, 2].map((z) => gridPart(`d${x}${z}`, "deck-1x1", 0, x, z))
      ),
      gridPart("s", "stairs", 0, 4, 1, 0),
      gridPart("s2", "stairs", 0, 9, 2, 180),
      gridPart("c", "cabin-1st", 0, 12, 1),
      gridPart("p", "pool", 0, 14, 2),
      attachPart("f", "funnel", "d71", "funnel"),
    ]);
    for (const seed of [1, 2, 3, 4]) {
      wander(ship, at(2.5, 1.5, TO_STERN), seed);
    }
  });

  it("on the Titanic", () => {
    const ship = findTemplate("titanic")!.build();
    const grid = walkGridOf(ship);
    let start: WalkState | undefined;
    for (let x = 0; x < grid.length && !start; x++) {
      for (let z = 0; z < grid.beam && !start; z++) {
        if (grid.isWalkable(x, z, 0)) start = at(x + 0.5, z + 0.5);
      }
    }
    for (const seed of [11, 12, 13]) wander(ship, start!, seed);
  });
});

describe("stepWalker: a real ship's stairs", () => {
  it("climbs onto the Titanic's forecastle and back", () => {
    const base = findTemplate("titanic")!.build();
    const grid0 = walkGridOf(base);
    // Find an open main-deck cell beside a level-0 block with an open roof.
    const rotations = [
      { rotation: 0, dx: 1, dz: 0 },
      { rotation: 180, dx: -1, dz: 0 },
    ] as const;
    let stairs: PlacedPart | undefined;
    let faced: { x: number; z: number } | undefined;
    let ship: Ship = base;
    search: for (let x = 1; x < grid0.length - 1; x++) {
      for (let z = 0; z < grid0.beam; z++) {
        for (const { rotation, dx, dz } of rotations) {
          const candidate = gridPart(
            "walk-stairs",
            "stairs",
            0,
            x,
            z,
            rotation
          );
          if (!canPlace(base, candidate).ok) continue;
          const target = { x: x + dx, z: z + dz };
          if (!grid0.isWalkable(target.x, target.z, 1)) continue;
          if (grid0.isWalkable(target.x, target.z, 0)) continue;
          stairs = candidate;
          faced = target;
          ship = { ...base, parts: [...base.parts, candidate] };
          break search;
        }
      }
    }
    expect(stairs).toBeDefined();
    const grid = walkGridOf(ship);
    const { x, z } = stairs!.anchor as { x: number; z: number };
    expect(grid.stepLevel(x, z, 0, faced!.x, faced!.z)).toBe(1);
    // Walk from the stairs onto the roof and back down.
    const toward = faced!.x > x ? TO_STERN : TO_BOW;
    const start = at(x + 0.5 - (faced!.x - x) * 0.4, z + 0.5, toward);
    const up = walk(start, FORWARD, 1.2, grid);
    expect(up.level).toBe(1);
    const down = walk({ ...up, yaw: toward + Math.PI }, FORWARD, 1.5, grid);
    expect(down.level).toBe(0);
  });
});

describe("stepWalker: jumping", () => {
  const flat = walkGridOf(testShip());
  const JUMP: WalkInput = { forward: 0, strafe: 0, turn: 0, jump: true };
  const STILL: WalkInput = { forward: 0, strafe: 0, turn: 0 };

  /** Runs `seconds`, jumping on the first step only, tracking the highest lift. */
  function leap(
    start: WalkState,
    grid: WalkGrid,
    seconds: number,
    forward = 0
  ): { end: WalkState; peak: number } {
    let state = start;
    let peak = 0;
    for (let i = 0; i < Math.round(seconds / SIM_STEP_S); i++) {
      state = stepWalker(
        state,
        { forward, strafe: 0, turn: 0, jump: i === 0 },
        grid
      );
      peak = Math.max(peak, state.lift ?? 0);
    }
    return { end: state, peak };
  }

  it("leaves the ground a little over a level and lands again", () => {
    const { end, peak } = leap(at(12, 2), flat, 2);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.3);
    expect(end.lift).toBe(0);
    expect(end.rise).toBe(0);
    expect(end.level).toBe(0);
  });

  it("cannot jump again in the air", () => {
    let state = stepWalker(at(12, 2), JUMP, flat);
    for (let i = 0; i < 5; i++) state = stepWalker(state, JUMP, flat);
    const rising = state.rise ?? 0;
    expect(rising).toBeLessThan(4);
    expect(stepWalker(state, JUMP, flat).rise).toBeLessThan(rising);
  });

  it("stays put on the ground without a jump", () => {
    const end = stepWalker(at(12, 2), STILL, flat);
    expect(end.lift).toBe(0);
    expect(end.rise).toBe(0);
  });

  it("hops over a deck chair that would stop a walker", () => {
    const grid = walkGridOf(testShip([gridPart("c", "deckchair", 0, 6, 1)]));
    const blocked = walk(at(4.5, 1.5, TO_STERN), FORWARD, 3, grid);
    expect(blocked.x).toBeLessThan(6);
    const { end } = leap(at(4.5, 1.5, TO_STERN), grid, 3, 1);
    expect(end.x).toBeGreaterThan(7);
    expect(end.level).toBe(0);
    expect(end.lift).toBe(0);
  });

  it("jumps up onto a cabin roof, one level, but cannot walk up", () => {
    const grid = walkGridOf(testShip([gridPart("c", "cabin-1st", 0, 6, 1)]));
    expect(walk(at(4.5, 1.5, TO_STERN), FORWARD, 3, grid).x).toBeLessThan(6);
    const { end } = leap(at(5.7, 1.5, TO_STERN), grid, 3, 1);
    expect(end.level).toBe(1);
    expect(Math.floor(end.x)).toBeGreaterThanOrEqual(6);
    expect(end.lift).toBe(0);
  });

  it("cannot jump onto a roof two levels up", () => {
    const grid = walkGridOf(
      testShip([
        gridPart("a", "cabin-1st", 0, 6, 1),
        gridPart("b", "cabin-2nd", 1, 6, 1),
      ])
    );
    const { end } = leap(at(4.5, 1.5, TO_STERN), grid, 3, 1);
    expect(end.level).toBe(0);
    expect(end.x).toBeLessThan(6);
  });

  it("stays railed in on a roof when walking, and drops off the edge by jumping", () => {
    const grid = walkGridOf(testShip([gridPart("d", "deck-1x1", 0, 5, 1)]));
    const roof = at(5.5, 1.5, TO_STERN, 1);
    expect(walk(roof, FORWARD, 2, grid).level).toBe(1);
    const { end } = leap(roof, grid, 3, 1);
    expect(end.level).toBe(0);
    expect(end.x).toBeGreaterThan(6);
    expect(end.lift).toBe(0);
  });

  it("cannot leap off the ship into the sea", () => {
    const { end } = leap(at(12, 0.5, TO_STARBOARD), flat, 3, 1);
    expect(end.z).toBeGreaterThan(0.2);
    expect(end.level).toBe(0);
  });

  it("stands on a deck chair it lands on", () => {
    const grid = walkGridOf(testShip([gridPart("c", "deckchair", 0, 5, 1)]));
    const start = at(5.5, 1.5, TO_STERN);
    const { end } = leap({ ...start }, grid, 0.2);
    expect(end.lift).toBeGreaterThan(0);
  });
});
