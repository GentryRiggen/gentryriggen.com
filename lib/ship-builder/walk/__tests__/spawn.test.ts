import { TEMPLATES } from "../../templates";
import { findTemplate } from "../../templates";
import { attachPart, gridPart, testShip } from "../../testing";
import { spawnOf } from "../spawn";
import { stepWalker } from "../step";
import { WALKER_RADIUS, ATTACH_BLOCK_RADIUS, type WalkState } from "../types";
import { walkGridOf } from "../walkGrid";

function expectStandable(ship: Parameters<typeof spawnOf>[0], s: WalkState) {
  const grid = walkGridOf(ship);
  expect(grid.isWalkable(Math.floor(s.x), Math.floor(s.z), s.level)).toBe(true);
  for (const circle of grid.blockersAt(s.level)) {
    expect(Math.hypot(s.x - circle.x, s.z - circle.z)).toBeGreaterThanOrEqual(
      circle.radius + WALKER_RADIUS - 1e-3
    );
  }
}

describe("spawnOf", () => {
  it("spawns mid-ship on the centreline of an empty deck, facing the bow", () => {
    const spawn = spawnOf(testShip())!;
    expect(spawn).toMatchObject({ level: 0, yaw: 0, time: 0 });
    expect(Math.abs(spawn.x - 12)).toBeLessThanOrEqual(1);
    expect(Math.abs(spawn.z - 2)).toBeLessThanOrEqual(1);
  });

  it("prefers the open deck nearest the bridge", () => {
    const ship = testShip([gridPart("b", "bridge-3", 0, 5, 1)]);
    const spawn = spawnOf(ship)!;
    expect(spawn.level).toBe(0);
    expect(Math.hypot(spawn.x - 5.5, spawn.z - 2.5)).toBeLessThan(1.5);
    expectStandable(ship, spawn);
  });

  it("turns away from a wall right in front of the bow-facing start", () => {
    // Cabins fill everything bow-ward of mid-ship, so the bow heading is a wall.
    const wall = Array.from({ length: 12 }, (_, x) => x).flatMap((x) =>
      [0, 1, 2, 3].map((z) => gridPart(`w${x}${z}`, "cabin-1st", 0, x, z))
    );
    const ship = testShip(wall);
    const spawn = spawnOf(ship)!;
    expect(spawn.yaw).not.toBe(0);
    const grid = walkGridOf(ship);
    let state = spawn;
    for (let i = 0; i < 90; i++) {
      state = stepWalker(state, { forward: 1, strafe: 0, turn: 0 }, grid);
    }
    expect(Math.hypot(state.x - spawn.x, state.z - spawn.z)).toBeGreaterThan(
      1.5
    );
  });

  it("avoids blocked cells", () => {
    const blocked = [10, 11, 12, 13].flatMap((x) =>
      [0, 1, 2, 3].map((z) => gridPart(`c${x}${z}`, "cabin-1st", 0, x, z))
    );
    // A pool where the middle would be, and a funnel on top of a deck block.
    const ship = testShip([
      ...blocked,
      gridPart("d", "deck-1x1", 0, 9, 1),
      attachPart("f", "funnel", "d", "funnel"),
    ]);
    const spawn = spawnOf(ship)!;
    expectStandable(ship, spawn);
    expect(spawn.level).toBe(0);
  });

  it("keeps clear of a funnel's circle", () => {
    const ship = testShip([
      gridPart("d", "deck-1x1", 0, 12, 1),
      attachPart("f", "funnel", "d", "funnel"),
    ]);
    const spawn = spawnOf(ship)!;
    expectStandable(ship, spawn);
    expect(ATTACH_BLOCK_RADIUS).toBeGreaterThan(0);
  });

  it("skips a pocket the walker could not leave", () => {
    // One open cell walled in by cabins, next to the bridge.
    const wall = [
      [4, 1],
      [6, 1],
      [5, 0],
      [5, 2],
    ].map(([x, z]) => gridPart(`w${x}${z}`, "cabin-1st", 0, x, z));
    const ship = testShip([...wall, gridPart("b", "bridge-3", 0, 5, 3)]);
    const spawn = spawnOf(ship)!;
    expect([Math.floor(spawn.x), Math.floor(spawn.z)]).not.toEqual([5, 1]);
  });

  it("returns null when every deck cell is blocked", () => {
    // Pools tile the whole 24 x 4 main deck.
    const pools = Array.from({ length: 12 }, (_, i) => i * 2).flatMap((x) =>
      [0, 2].map((z) => gridPart(`p${x}${z}`, "pool", 0, x, z))
    );
    expect(spawnOf(testShip(pools))).toBeNull();
  });

  it("falls back to a roof when the main deck is built over", () => {
    const decks = Array.from({ length: 24 }, (_, x) =>
      [0, 1, 2, 3].map((z) => gridPart(`d${x}${z}`, "deck-1x1", 0, x, z))
    ).flat();
    const ship = testShip(decks);
    const spawn = spawnOf(ship)!;
    expect(spawn.level).toBe(1);
    expectStandable(ship, spawn);
  });

  it("is deterministic and tied to the ship it is given", () => {
    const ship = testShip([gridPart("b", "bridge-3", 0, 5, 1)]);
    expect(spawnOf(ship)).toEqual(spawnOf(ship));
  });

  it.each(
    Object.values(TEMPLATES)
      .flat()
      .map((t) => [t.id, t] as const)
  )("gives %s a standable spawn it can walk away from", (_id, template) => {
    const ship = template.build();
    const grid = walkGridOf(ship);
    const spawn = spawnOf(ship, grid)!;
    expect(spawn).not.toBeNull();
    expectStandable(ship, spawn);
    let state = spawn;
    for (let i = 0; i < 300; i++) {
      state = stepWalker(state, { forward: 1, strafe: 0, turn: 0.2 }, grid);
    }
    expectStandable(ship, state);
  });

  it("puts the Titanic on its main deck", () => {
    const spawn = spawnOf(findTemplate("titanic")!.build())!;
    expect(spawn.level).toBe(0);
  });
});
