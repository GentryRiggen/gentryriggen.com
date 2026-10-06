import { spawnOf, WALKER_RADIUS, walkGridOf, type WalkGrid } from "../../walk";
import { PIRATE_TEMPLATES } from "../pirate";

interface Cell {
  x: number;
  z: number;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** A cell the walker can stand in: walkable and clear of every blocker. */
function isClear(grid: WalkGrid, level: number, { x, z }: Cell): boolean {
  return (
    grid.isWalkable(x, z, level) &&
    grid
      .blockersAt(level)
      .every(
        (circle) =>
          Math.hypot(x + 0.5 - circle.x, z + 0.5 - circle.z) >=
          circle.radius + WALKER_RADIUS
      )
  );
}

/** Clear cells on one level, and those not reachable from `start` by steps. */
function deckRegions(grid: WalkGrid, level: number, start: Cell) {
  const clear: Cell[] = [];
  for (let z = 0; z < grid.beam; z++) {
    for (let x = 0; x < grid.length; x++) {
      if (isClear(grid, level, { x, z })) clear.push({ x, z });
    }
  }
  const key = (c: Cell) => `${c.x}:${c.z}`;
  const seen = new Set([key(start)]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const { x, z } = queue[head];
    for (const [dx, dz] of NEIGHBOURS) {
      const next = { x: x + dx, z: z + dz };
      if (seen.has(key(next)) || !isClear(grid, level, next)) continue;
      if (grid.stepLevel(x, z, level, next.x, next.z) !== level) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }
  return { clear, unreached: clear.filter((c) => !seen.has(key(c))) };
}

describe("pirate ships in walk mode", () => {
  it.each(PIRATE_TEMPLATES.map((template) => [template.id, template] as const))(
    "%s has one connected main deck from the spawn",
    (_id, template) => {
      const ship = template.build();
      const grid = walkGridOf(ship);
      const spawn = spawnOf(ship, grid);
      expect(spawn).not.toBeNull();
      const start = { x: Math.floor(spawn!.x), z: Math.floor(spawn!.z) };
      const { clear, unreached } = deckRegions(grid, spawn!.level, start);
      expect(clear.length).toBeGreaterThan(10);
      // No cannon, davit or decor run may cut the deck into pockets, so the
      // threshold is zero unreachable clear cells.
      expect(unreached).toEqual([]);
    }
  );
});
