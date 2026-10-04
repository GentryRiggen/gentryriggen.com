import { attachPointsOf, isPointTaken, openAttachPoints } from "../attach";
import { getPartDef, visibleParts } from "../catalog";
import { sternLength } from "../hullEnds";
import { gridLength } from "../grid";
import { containerColor, PAINT_COLORS } from "../paint";
import { canPlace, validateShip, type PartCandidate } from "../placement";
import { computeStats } from "../stats";
import { HULL_ID, type AttachPartDef, type PartType } from "../types";
import { parseShip } from "../../persist/schema";
import { attachPart, gridPart, testShip } from "../../testing";

function candidate(
  type: PartType,
  level: number,
  x: number,
  z: number
): PartCandidate {
  return { type, anchor: { kind: "grid", level, x, z }, rotation: 0 };
}

describe("container placement", () => {
  it("goes on the main deck inside the hull", () => {
    expect(canPlace(testShip(), candidate("container", 0, 2, 1)).ok).toBe(true);
  });

  it("is refused in a wing column at deck level", () => {
    const wing = canPlace(testShip(), candidate("container", 0, 2, -1));
    expect(wing.ok).toBe(false);
  });

  it("stacks on another container", () => {
    const ship = testShip([gridPart("c1", "container", 0, 2, 1)]);
    expect(canPlace(ship, candidate("container", 1, 2, 1)).ok).toBe(true);
  });

  it("stacks on a hatch cover", () => {
    const ship = testShip([gridPart("h1", "hatch-cover", 0, 2, 1)]);
    expect(canPlace(ship, candidate("container", 1, 2, 1)).ok).toBe(true);
    expect(canPlace(ship, candidate("container", 1, 2, 2)).ok).toBe(true);
  });

  it.each(["deck-1x1", "cabin-1st"] as const)("is refused on a %s", (type) => {
    const ship = testShip([gridPart("b1", type, 0, 2, 1)]);
    const result = canPlace(ship, candidate("container", 1, 2, 1));
    expect(result.ok).toBe(false);
  });

  it.each(["deck-1x1", "cabin-1st", "hatch-cover"] as const)(
    "refuses a %s on top of a container",
    (type) => {
      const ship = testShip([gridPart("c1", "container", 0, 2, 1)]);
      const result = canPlace(ship, candidate(type, 1, 2, 1));
      expect(result).toEqual({
        ok: false,
        reason: "Only containers stack on containers",
      });
    }
  );

  it("still needs support: no floating container", () => {
    expect(canPlace(testShip(), candidate("container", 1, 2, 1)).ok).toBe(
      false
    );
  });

  it("still allows the usual overhang from a supported neighbour", () => {
    const ship = testShip([gridPart("h1", "hatch-cover", 0, 2, 1)]);
    // Hangs one cell past the cover's far edge, held by its other cell.
    expect(canPlace(ship, candidate("container", 1, 3, 1)).ok).toBe(true);
  });

  it("cannot be built over a crane", () => {
    const ship = testShip([
      gridPart("h1", "hatch-cover", 0, 2, 1),
      attachPart("k1", "cargo-crane", "h1", "funnel"),
    ]);
    expect(canPlace(ship, candidate("container", 1, 2, 1)).ok).toBe(false);
  });
});

describe("cargo attach points", () => {
  it("exposes nothing on a container, stacked or not", () => {
    const ship = testShip([
      gridPart("c1", "container", 0, 0, 0),
      gridPart("c2", "container", 1, 0, 0),
    ]);
    expect(attachPointsOf(ship, "c1")).toEqual([]);
    expect(attachPointsOf(ship, "c2")).toEqual([]);
  });

  it("still exposes funnel and mast points on a hatch cover", () => {
    const ship = testShip([gridPart("h1", "hatch-cover", 0, 2, 1)]);
    const ids = attachPointsOf(ship, "h1").map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["funnel", "mast"]));
  });

  it("lets the crane use a hatch cover top, once", () => {
    const def = getPartDef("cargo-crane") as AttachPartDef;
    const ship = testShip([gridPart("h1", "hatch-cover", 0, 2, 1)]);
    const spots = openAttachPoints(ship, def).filter(
      (s) => s.parentId === "h1"
    );
    expect(spots.map((s) => s.point.id)).toEqual(["funnel"]);
    const crowded = testShip([
      ...ship.parts,
      attachPart("k1", "cargo-crane", "h1", "funnel"),
    ]);
    expect(isPointTaken(crowded, "h1", "funnel")).toBe(true);
    expect(validateShip(crowded)).toEqual({ ok: true });
  });
});

describe("hatch cover", () => {
  it("is a 2x2 deck-role part that renders low", () => {
    const def = getPartDef("hatch-cover");
    expect(def).toMatchObject({
      placement: "grid",
      role: "deck",
      footprint: { x: 2, z: 2 },
      height: 0.3,
    });
  });

  it("holds a stack of containers up to the level cap", () => {
    const ship = testShip([
      gridPart("h1", "hatch-cover", 0, 2, 1),
      gridPart("c1", "container", 1, 2, 1),
      gridPart("c2", "container", 2, 2, 1),
      gridPart("c3", "container", 3, 2, 1),
    ]);
    expect(validateShip(ship)).toEqual({ ok: true });
    expect(canPlace(ship, candidate("container", 4, 2, 1)).ok).toBe(false);
  });
});

describe("TEU", () => {
  it("counts 2 per container and 0 without any", () => {
    expect(computeStats(testShip()).teu).toBe(0);
    const ship = testShip([
      gridPart("c1", "container", 0, 0, 0),
      gridPart("c2", "container", 1, 0, 0),
      gridPart("c3", "container", 0, 2, 0),
    ]);
    expect(computeStats(ship).teu).toBe(6);
  });
});

describe("freefall lifeboat", () => {
  it("has one hull point on the stern centreline at deck level", () => {
    const ship = testShip();
    const points = attachPointsOf(ship, HULL_ID).filter(
      (p) => p.type === "freefall-mount"
    );
    expect(points).toHaveLength(1);
    const [point] = points;
    expect(point.id).toBe("freefall");
    expect(point.position.y).toBe(0);
    expect(point.position.z).toBe(ship.hull.beam / 2);
    expect(point.position.x).toBeGreaterThan(gridLength(ship) - 1);
    expect(point.position.x).toBeLessThan(
      gridLength(ship) + sternLength(ship.hull.stern)
    );
  });

  it("seats 40 and counts as a lifeboat", () => {
    expect(getPartDef("lifeboat-freefall")).toMatchObject({ seats: 40 });
    const ship = testShip([
      attachPart("f1", "lifeboat-freefall", HULL_ID, "freefall"),
    ]);
    expect(validateShip(ship)).toEqual({ ok: true });
    const stats = computeStats(ship);
    expect(stats.lifeboatSeats).toBe(40);
    expect(stats.lifeboats).toBe(1);
  });

  it("takes only the one spot", () => {
    const ship = testShip([
      attachPart("f1", "lifeboat-freefall", HULL_ID, "freefall"),
    ]);
    const second = canPlace(ship, {
      type: "lifeboat-freefall",
      anchor: { kind: "attach", parentId: HULL_ID, pointId: "freefall" },
      rotation: 0,
    });
    expect(second.ok).toBe(false);
  });
});

describe("container colour", () => {
  const paints: string[] = PAINT_COLORS.map((c) => c.id);

  it("is deterministic per id and always a real paint", () => {
    expect(containerColor("abc")).toBe(containerColor("abc"));
    expect(paints).toContain(containerColor("abc"));
  });

  it("varies across ids", () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, i) => containerColor(`container-${i}`))
    );
    expect(seen.size).toBeGreaterThan(3);
  });

  it("keeps an explicit paint", () => {
    expect(containerColor("abc", "pink")).toBe("pink");
  });
});

describe("catalog and old saves", () => {
  it("lists the cargo parts for cargo ships only", () => {
    const cargo = visibleParts("cargo", false).map((d) => d.type);
    expect(cargo).toEqual(
      expect.arrayContaining([
        "container",
        "hatch-cover",
        "cargo-crane",
        "lifeboat-freefall",
      ])
    );
    expect(visibleParts("liner", false).map((d) => d.type)).not.toContain(
      "container"
    );
  });

  it("still validates a saved ship without cargo parts", () => {
    const old = testShip([
      gridPart("a", "deck-2x1", 0, 2, 1),
      gridPart("b", "cabin-1st", 0, 5, 1),
      attachPart("f", "funnel", "a", "funnel"),
    ]);
    const parsed = parseShip(JSON.parse(JSON.stringify(old)));
    expect(parsed.ok).toBe(true);
  });

  it("round-trips a cargo ship through the schema", () => {
    const ship = testShip([
      gridPart("h1", "hatch-cover", 0, 2, 1),
      gridPart("c1", "container", 1, 2, 1),
    ]);
    expect(parseShip(JSON.parse(JSON.stringify(ship))).ok).toBe(true);
  });
});
