import { validateShip } from "../../model/placement";
import { attachPart, gridPart, testShip } from "../../testing";
import { findTemplate } from "../../templates";
import { ATTACH_BLOCK_RADIUS } from "../types";
import { walkGridOf } from "../walkGrid";

describe("walkGridOf: floors", () => {
  it("lets you walk the open main deck inside the hull at level 0", () => {
    const grid = walkGridOf(testShip());
    expect(grid.floorLevel(0, 0)).toBe(0);
    expect(grid.floorLevel(23, 3)).toBe(0);
    expect(grid.isWalkable(10, 2, 0)).toBe(true);
  });

  it("has no floor past the hull's length or beam, nor in wing columns", () => {
    const grid = walkGridOf(testShip());
    expect(grid.floorLevel(-1, 1)).toBeNull();
    expect(grid.floorLevel(24, 1)).toBeNull();
    expect(grid.floorLevel(5, -1)).toBeNull();
    expect(grid.floorLevel(5, 4)).toBeNull();
    expect(grid.isBlocked(5, -1, 0)).toBe(true);
  });

  it("blocks a cabin and makes its roof the column's floor", () => {
    const grid = walkGridOf(testShip([gridPart("c", "cabin-1st", 0, 5, 1)]));
    expect(grid.isBlocked(5, 1, 0)).toBe(true);
    expect(grid.floorLevel(5, 1)).toBe(1);
    expect(grid.isWalkable(5, 1, 1)).toBe(true);
  });

  it("makes a deck block's roof walkable, even a wing column's", () => {
    const grid = walkGridOf(
      testShip([
        gridPart("d0", "deck-1x1", 0, 5, 0),
        gridPart("d1", "deck-1x1", 0, 5, -1),
      ])
    );
    expect(grid.floorLevel(5, 0)).toBe(1);
    expect(grid.floorLevel(5, -1)).toBe(1);
    expect(grid.floorLevel(6, -1)).toBeNull();
  });

  it("walks a stacked roof, and still the deck under an overhang", () => {
    const grid = walkGridOf(
      testShip([
        gridPart("a", "deck-1x1", 0, 5, 0),
        gridPart("b", "deck-1x1", 1, 5, 0),
        gridPart("c", "deck-1x1", 1, 5, 1),
      ])
    );
    expect(grid.floorLevel(5, 0)).toBe(2);
    expect(grid.floorLevel(5, 1)).toBe(2);
    expect(grid.isWalkable(5, 1, 0)).toBe(true);
    expect(grid.isWalkable(5, 1, 1)).toBe(false);
  });

  it.each([
    ["a pool", gridPart("x", "pool", 0, 5, 1)],
    ["a container", gridPart("x", "container", 0, 5, 1)],
    ["a bridge", gridPart("x", "bridge-3", 0, 5, 1)],
    ["a deck chair", gridPart("x", "deckchair", 0, 5, 1)],
    ["a ventilator", gridPart("x", "ventilator", 0, 5, 1)],
  ])("blocks %s and gives nothing to stand on", (_name, part) => {
    const grid = walkGridOf(testShip([part]));
    expect(grid.isBlocked(5, 1, 0)).toBe(true);
    expect(grid.floorLevel(5, 1)).toBeNull();
  });

  it("gives no roof to a deck chair standing on a deck block", () => {
    const grid = walkGridOf(
      testShip([
        gridPart("d", "deck-1x1", 0, 5, 1),
        gridPart("chair", "deckchair", 1, 5, 1),
      ])
    );
    expect(grid.isBlocked(5, 1, 1)).toBe(true);
    expect(grid.floorLevel(5, 1)).toBeNull();
  });

  it("returns the same grid for the same ship", () => {
    const ship = testShip([gridPart("c", "cabin-1st", 0, 5, 1)]);
    expect(walkGridOf(ship)).toBe(walkGridOf(ship));
  });
});

describe("walkGridOf: stairs", () => {
  const stairsUp = (faced: ReturnType<typeof gridPart>[]) =>
    walkGridOf(testShip([...faced, gridPart("s", "stairs", 0, 4, 1, 0)]));

  it("links a stairs cell up to the deck block it faces, and back down", () => {
    const grid = stairsUp([gridPart("d", "deck-1x1", 0, 5, 1)]);
    expect(grid.stepLevel(4, 1, 0, 5, 1)).toBe(1);
    expect(grid.stepLevel(5, 1, 1, 4, 1)).toBe(0);
    expect(grid.stairs).toHaveLength(2);
  });

  it("links to a cabin roof too", () => {
    const grid = stairsUp([gridPart("c", "cabin-1st", 0, 5, 1)]);
    expect(grid.stepLevel(4, 1, 0, 5, 1)).toBe(1);
  });

  it("keeps the stairs cell itself walkable at its own level", () => {
    const grid = stairsUp([gridPart("d", "deck-1x1", 0, 5, 1)]);
    expect(grid.isWalkable(4, 1, 0)).toBe(true);
    expect(grid.floorLevel(4, 1)).toBe(0);
  });

  it("does nothing when the stairs face nothing", () => {
    const grid = stairsUp([]);
    expect(grid.stairs).toHaveLength(0);
    expect(grid.stepLevel(4, 1, 0, 5, 1)).toBe(0);
  });

  it("does not link when the faced stack is taller than one block", () => {
    const grid = stairsUp([
      gridPart("d", "deck-1x1", 0, 5, 1),
      gridPart("d2", "deck-1x1", 1, 5, 1),
    ]);
    expect(grid.stairs).toHaveLength(0);
    expect(grid.stepLevel(4, 1, 0, 5, 1)).toBeNull();
  });

  it("does not link to a faced block that is not a deck or cabin", () => {
    const grid = stairsUp([gridPart("p", "bridge-3", 0, 5, 1)]);
    expect(grid.stairs).toHaveLength(0);
  });

  it("does not link when something stands on the roof it would reach", () => {
    const grid = stairsUp([
      gridPart("d", "deck-1x1", 0, 5, 1),
      gridPart("chair", "deckchair", 1, 5, 1),
    ]);
    expect(grid.stairs).toHaveLength(0);
  });

  it("offers no other level change", () => {
    const grid = stairsUp([gridPart("d", "deck-1x1", 0, 5, 1)]);
    // Beside the deck block, not through the stairs.
    expect(grid.stepLevel(5, 0, 0, 5, 1)).toBeNull();
    expect(grid.stepLevel(5, 2, 0, 5, 1)).toBeNull();
    // Roof edge: the open deck below is not reachable by stepping off.
    expect(grid.stepLevel(5, 1, 1, 6, 1)).toBeNull();
    expect(grid.stepLevel(5, 1, 1, 5, 0)).toBeNull();
  });

  it("only steps between orthogonal neighbours", () => {
    const grid = stairsUp([gridPart("d", "deck-1x1", 0, 5, 1)]);
    expect(grid.stepLevel(4, 1, 0, 5, 2)).toBeNull();
    expect(grid.stepLevel(4, 1, 0, 4, 1)).toBeNull();
  });
});

describe("walkGridOf: attach parts", () => {
  const deckWith = (parts: ReturnType<typeof attachPart>[]) =>
    testShip([gridPart("d", "deck-1x1", 0, 5, 1), ...parts]);

  it("puts a blocking circle at a funnel's resolved position", () => {
    const grid = walkGridOf(
      deckWith([attachPart("f", "funnel", "d", "funnel")])
    );
    expect(grid.blockers).toEqual([
      { x: 5.5, z: 1.5, level: 1, radius: ATTACH_BLOCK_RADIUS },
    ]);
    expect(grid.blockersAt(1)).toHaveLength(1);
    expect(grid.blockersAt(0)).toHaveLength(0);
  });

  it("blocks for masts, turrets and a davit", () => {
    const ship = testShip([
      gridPart("d", "deck-1x1", 0, 5, 0),
      gridPart("e", "deck-1x1", 0, 8, 1),
      attachPart("m", "mast", "d", "mast"),
      attachPart("t", "turret-small", "e", "funnel"),
      attachPart("v", "davit", "d", "davit:5:0"),
    ]);
    expect(walkGridOf(ship).blockers).toHaveLength(3);
  });

  it("does not block for a nav light, searchlight or a flag", () => {
    const ship = testShip([
      gridPart("b", "bridge-3", 0, 5, 1),
      attachPart("n", "nav-lights", "b", "nav"),
      attachPart("s", "searchlight", "b", "light"),
      attachPart("flag", "stern-flag", "hull", "flag"),
    ]);
    expect(validateShip(ship)).toEqual({ ok: true });
    expect(walkGridOf(ship).blockers).toEqual([]);
  });
});

describe("walkGridOf: real ships", () => {
  const gridOf = (id: string) => walkGridOf(findTemplate(id)!.build());

  it("lets you walk the Titanic's open well deck", () => {
    const grid = gridOf("titanic");
    const openDeck: [number, number][] = [];
    for (let x = 0; x < grid.length; x++) {
      for (let z = 0; z < grid.beam; z++) {
        if (grid.isWalkable(x, z, 0)) openDeck.push([x, z]);
      }
    }
    expect(openDeck.length).toBeGreaterThan(10);
  });

  it("blocks each of the Titanic's funnels", () => {
    const grid = gridOf("titanic");
    expect(grid.blockers.length).toBeGreaterThanOrEqual(4);
    for (const blocker of grid.blockers) {
      expect(Number.isFinite(blocker.x + blocker.z + blocker.level)).toBe(true);
    }
  });

  it("walls off a cruise ship's pools and walks its roofs", () => {
    const ship = findTemplate("ocean-breeze")!.build();
    const grid = walkGridOf(ship);
    for (const part of ship.parts) {
      if (part.type !== "pool" || part.anchor.kind !== "grid") continue;
      const { level, x, z } = part.anchor;
      expect(grid.isBlocked(x, z, level)).toBe(true);
    }
    let walkable = 0;
    for (let x = 0; x < grid.length; x++) {
      for (let z = 0; z < grid.beam; z++) {
        if (grid.floorLevel(x, z) !== null) walkable++;
      }
    }
    expect(walkable).toBeGreaterThan(10);
  });
});
