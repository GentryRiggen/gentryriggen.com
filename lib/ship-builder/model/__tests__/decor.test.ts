import { attachPointsOf } from "../attach";
import { CATALOG, CATEGORIES, partsInCategory } from "../catalog";
import { facingCell } from "../grid";
import {
  canPlace,
  cascadeIds,
  removeParts,
  validateShip,
  type PartCandidate,
} from "../placement";
import { parseShip } from "../../persist/schema";
import { gridPart, testShip } from "../../testing";
import type { PartType, Rotation } from "../types";

function candidate(
  type: PartType,
  level: number,
  x: number,
  z: number,
  rotation: Rotation = 0
): PartCandidate {
  return { type, anchor: { kind: "grid", level, x, z }, rotation };
}

const DECOR_TYPES = [
  "deckchair",
  "bench",
  "deck-lamp",
  "ventilator",
  "stairs",
] as const;
const NON_STAIRS = ["deckchair", "bench", "deck-lamp", "ventilator"] as const;

describe("decor catalog", () => {
  it("lists the deck items under Decorations, after the builder categories", () => {
    expect(partsInCategory("decor").map((d) => d.type)).toEqual(
      expect.arrayContaining([...DECOR_TYPES])
    );
    const ids = CATEGORIES.map((c) => c.id);
    expect(ids.indexOf("decor")).toBeGreaterThan(ids.indexOf("naval"));
    expect(ids[ids.length - 1]).toBe("decor");
  });

  it("makes every deck item a light 1×1 decor part; only the ventilator is liner-only", () => {
    for (const type of DECOR_TYPES) {
      const def = CATALOG[type];
      expect(def).toMatchObject({
        placement: "grid",
        role: "decor",
        footprint: { x: 1, z: 1 },
        mass: 0.05,
      });
      expect(def.kinds).toEqual(type === "ventilator" ? ["liner"] : undefined);
    }
  });
});

describe("decor placement", () => {
  it.each(NON_STAIRS)("%s stands on the open main deck", (type) => {
    expect(canPlace(testShip(), candidate(type, 0, 2, 1)).ok).toBe(true);
  });

  it.each(NON_STAIRS)("%s stands on a deck block", (type) => {
    const ship = testShip([gridPart("d", "deck-1x1", 0, 2, 1)]);
    expect(canPlace(ship, candidate(type, 1, 2, 1)).ok).toBe(true);
  });

  it.each(["cabin-1st", "bridge", "pool", "container"] as const)(
    "is refused on a %s",
    (below) => {
      const ship = testShip([gridPart("b", below, 0, 2, 1)]);
      expect(canPlace(ship, candidate("deckchair", 1, 2, 1)).ok).toBe(false);
    }
  );

  it("is refused in a wing column at deck level", () => {
    expect(canPlace(testShip(), candidate("bench", 0, 2, -1)).ok).toBe(false);
    expect(canPlace(testShip(), candidate("bench", 0, 2, 4)).ok).toBe(false);
  });

  it("is refused when it would overhang a block's side", () => {
    const ship = testShip([gridPart("d", "deck-1x1", 0, 2, 1)]);
    // Level 1 beside the block, with nothing beneath it.
    expect(canPlace(ship, candidate("bench", 1, 2, 2)).ok).toBe(false);
    expect(canPlace(ship, candidate("bench", 1, 3, 1)).ok).toBe(false);
  });

  it("is refused where a funnel or davit already claims the deck top", () => {
    const ship = testShip([
      gridPart("d", "deck-1x1", 0, 2, 1),
      {
        id: "f",
        type: "funnel",
        anchor: { kind: "attach", parentId: "d", pointId: "funnel" },
        rotation: 0,
      },
    ]);
    expect(canPlace(ship, candidate("deckchair", 1, 2, 1)).ok).toBe(false);
  });

  it("takes the top of a deck block away from funnels and masts", () => {
    const ship = testShip([
      gridPart("d", "deck-1x1", 0, 2, 1),
      gridPart("c", "deckchair", 1, 2, 1),
    ]);
    expect(attachPointsOf(ship, "d").map((p) => p.type)).not.toContain(
      "funnel-mount"
    );
  });
});

describe("nothing builds on decor", () => {
  it.each(["deck-1x1", "cabin-1st", "deckchair", "container"] as const)(
    "refuses a %s on top of a deck chair",
    (type) => {
      const ship = testShip([gridPart("c", "deckchair", 0, 2, 1)]);
      expect(canPlace(ship, candidate(type, 1, 2, 1)).ok).toBe(false);
    }
  );

  it("exposes no attach points", () => {
    const ship = testShip([
      gridPart("d", "deck-1x1", 0, 2, 1),
      gridPart("c", "deckchair", 1, 2, 1),
    ]);
    expect(attachPointsOf(ship, "c")).toEqual([]);
  });
});

describe("decor does not support its neighbours", () => {
  // Each case has a control: the same layout with a real block in place of
  // the decor item, which does hold its neighbour up.
  const withNeighbour = (
    beside: PartType,
    placeAt: { level: number; x: number; z: number },
    base: PartType[] = []
  ) =>
    testShip([
      ...base.map((type, i) => gridPart(`base${i}`, type, 0, 2, 1)),
      gridPart("beside", beside, placeAt.level, placeAt.x, placeAt.z),
    ]);

  it("won't carry a wing block placed beside it", () => {
    const wing = candidate("deck-1x1", 0, 2, -1);
    const block = withNeighbour("deck-1x1", { level: 0, x: 2, z: 0 });
    expect(canPlace(block, wing).ok).toBe(true);
    const chair = withNeighbour("deckchair", { level: 0, x: 2, z: 0 });
    expect(canPlace(chair, wing).ok).toBe(false);
  });

  it("doesn't bridge a wing block's overhang chain", () => {
    const far = candidate("deck-1x1", 0, 2, 5);
    const block = testShip([
      gridPart("a", "deck-1x1", 0, 2, 3),
      gridPart("b", "deck-1x1", 0, 2, 4),
    ]);
    expect(canPlace(block, far).ok).toBe(true);
    const chair = testShip([
      gridPart("a", "deck-1x1", 0, 2, 3),
      gridPart("b", "deckchair", 0, 2, 4),
    ]);
    expect(canPlace(chair, far).ok).toBe(false);
  });

  it("doesn't hold up a block beside it on an upper level", () => {
    const beside = candidate("deck-1x1", 1, 2, 2);
    const base = testShip([
      gridPart("d", "deck-1x1", 0, 2, 1),
      gridPart("n", "deck-1x1", 1, 2, 1),
    ]);
    expect(canPlace(base, beside).ok).toBe(true);
    const chair = testShip([
      gridPart("d", "deck-1x1", 0, 2, 1),
      gridPart("n", "deckchair", 1, 2, 1),
    ]);
    expect(canPlace(chair, beside).ok).toBe(false);
  });

  it("cascades a block that was only held up through a chair's neighbour", () => {
    // validateShip replays in order, so a hand-edited save that leans on a
    // chair for support is rejected.
    const leaning = testShip([
      gridPart("c", "deckchair", 0, 2, 0),
      gridPart("w", "deck-1x1", 0, 2, -1),
    ]);
    expect(validateShip(leaning).ok).toBe(false);
  });
});

describe("stairs facing", () => {
  it("faces +x at 0, +z at 90, -x at 180 and -z at 270", () => {
    const cell = { level: 0, x: 4, z: 2 };
    expect(facingCell(cell, 0)).toEqual({ level: 0, x: 5, z: 2 });
    expect(facingCell(cell, 90)).toEqual({ level: 0, x: 4, z: 3 });
    expect(facingCell(cell, 180)).toEqual({ level: 0, x: 3, z: 2 });
    expect(facingCell(cell, 270)).toEqual({ level: 0, x: 4, z: 1 });
  });

  const rotations: Rotation[] = [0, 90, 180, 270];

  it.each(rotations)(
    "at %i° needs a deck block in the cell it faces, and only there",
    (rotation) => {
      const faced = facingCell({ level: 0, x: 4, z: 2 }, rotation);
      const withBlock = testShip([
        gridPart("d", "deck-1x1", faced.level, faced.x, faced.z),
      ]);
      expect(
        canPlace(withBlock, candidate("stairs", 0, 4, 2, rotation)).ok
      ).toBe(true);
      for (const other of rotations.filter((r) => r !== rotation)) {
        expect(
          canPlace(withBlock, candidate("stairs", 0, 4, 2, other)).ok
        ).toBe(false);
      }
      expect(
        canPlace(testShip(), candidate("stairs", 0, 4, 2, rotation)).ok
      ).toBe(false);
    }
  );

  it("climbs against a cabin too, but not a bridge, pool, container or chair", () => {
    const climbs = (type: PartType) =>
      canPlace(
        testShip([gridPart("b", type, 0, 5, 2)]),
        candidate("stairs", 0, 4, 2, 0)
      ).ok;
    expect(climbs("cabin-2nd")).toBe(true);
    for (const type of ["bridge", "pool", "container", "deckchair"] as const) {
      expect(climbs(type)).toBe(false);
    }
  });

  it("climbs a second level from a deck block, against the next block up", () => {
    const ship = testShip([
      gridPart("d1", "deck-1x1", 0, 4, 2),
      gridPart("d2", "deck-1x1", 0, 5, 2),
      gridPart("d3", "deck-1x1", 1, 5, 2),
    ]);
    expect(canPlace(ship, candidate("stairs", 1, 4, 2, 0)).ok).toBe(true);
  });

  it("cascades away when the block it climbs against is removed", () => {
    const ship = testShip([
      gridPart("d", "deck-1x1", 0, 5, 2),
      gridPart("s", "stairs", 0, 4, 2, 0),
    ]);
    expect(validateShip(ship).ok).toBe(true);
    expect(cascadeIds(ship, ["d"])).toEqual(["d", "s"]);
    expect(removeParts(ship, cascadeIds(ship, ["d"])).parts).toEqual([]);
  });

  it("does not cascade when an unrelated block goes", () => {
    const ship = testShip([
      gridPart("d", "deck-1x1", 0, 5, 2),
      gridPart("other", "deck-1x1", 0, 8, 2),
      gridPart("s", "stairs", 0, 4, 2, 0),
    ]);
    expect(cascadeIds(ship, ["other"])).toEqual(["other"]);
  });
});

describe("decor cascades", () => {
  it("goes with the deck block under it", () => {
    const ship = testShip([
      gridPart("d", "deck-1x1", 0, 2, 1),
      gridPart("c", "bench", 1, 2, 1),
    ]);
    expect(cascadeIds(ship, ["d"])).toEqual(["d", "c"]);
  });

  it("stays when only a neighbour block goes", () => {
    const ship = testShip([
      gridPart("d", "deck-1x1", 0, 2, 1),
      gridPart("n", "deck-1x1", 0, 3, 1),
      gridPart("c", "bench", 1, 2, 1),
    ]);
    expect(cascadeIds(ship, ["n"])).toEqual(["n"]);
  });

  it("is dropped when a resize leaves it outside the hull", () => {
    const ship = testShip([gridPart("c", "bench", 0, 2, 3)], 8, 4);
    expect(
      cascadeIds({ ...ship, hull: { ...ship.hull, beam: 3 } }, [])
    ).toEqual(["c"]);
  });
});

describe("old saves", () => {
  it("still validate and parse without any decor", () => {
    const ship = testShip([
      gridPart("d", "deck-1x1", 0, 2, 1),
      gridPart("c", "cabin-1st", 1, 2, 1),
    ]);
    expect(validateShip(ship).ok).toBe(true);
    expect(parseShip(JSON.parse(JSON.stringify(ship))).ok).toBe(true);
  });

  it("round-trips a ship with decor", () => {
    const ship = testShip([
      gridPart("d", "deck-1x1", 0, 5, 2),
      gridPart("s", "stairs", 0, 4, 2, 0),
      gridPart("l", "deck-lamp", 0, 1, 1),
    ]);
    expect(validateShip(ship).ok).toBe(true);
    expect(parseShip(JSON.parse(JSON.stringify(ship))).ok).toBe(true);
  });
});
