import {
  attachPointsOf,
  openAttachPoints,
  stringTarget,
  UNDERWATER_MOUNT_Y,
} from "../attach";
import { CATALOG, CATEGORIES, partsInCategory, visibleParts } from "../catalog";
import { gridLength } from "../grid";
import { SHIP_KINDS } from "../kinds";
import { canPlace, cascadeIds, removeParts, validateShip } from "../placement";
import { shipSchema } from "../../persist/schema";
import {
  HULL_ID,
  type AttachPartDef,
  type PartType,
  type PlacedPart,
} from "../types";
import { attachPart, gridPart, testShip } from "../../testing";

const LIGHT_TYPES: PartType[] = [
  "string-lights",
  "nav-lights",
  "floodlight",
  "underwater-light",
];

const BRIDGE = gridPart("br", "bridge", 0, 1, 0);
const DECK = gridPart("a", "deck-1x1", 0, 4, 0);
const FORE_MAST = attachPart("m1", "mast", HULL_ID, "mast-fore");
const AFT_MAST = attachPart("m2", "radar-mast", HULL_ID, "mast-aft");

const canPlaceOn = (
  parts: PlacedPart[],
  type: PartType,
  parentId: string,
  pointId: string
) =>
  canPlace(testShip(parts), {
    type,
    anchor: { kind: "attach", parentId, pointId },
    rotation: 0,
  }).ok;

describe("lights catalog", () => {
  it("lists a Lights category before Decorations with the four parts", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(ids).toContain("lights");
    expect(ids.indexOf("lights")).toBeLessThan(ids.indexOf("decor"));
    expect(partsInCategory("lights").map((d) => d.type)).toEqual(LIGHT_TYPES);
  });

  it("offers every light to every ship kind", () => {
    for (const type of LIGHT_TYPES) {
      expect(CATALOG[type].kinds).toBeUndefined();
      for (const kind of SHIP_KINDS) {
        expect(visibleParts(kind, false).map((d) => d.type)).toContain(type);
      }
    }
  });

  it("teaches port is red and starboard is green", () => {
    expect(CATALOG["nav-lights"].description).toMatch(
      /red.*port.*green.*starboard/
    );
  });

  it("makes the floodlight a deck decor part like the deck lamp", () => {
    const def = CATALOG.floodlight;
    expect(def.placement).toBe("grid");
    expect(def.placement === "grid" && def.role).toBe("decor");
  });
});

describe("string lights", () => {
  it("need a second mast or funnel to string to", () => {
    expect(openAttachPoints(testShip([FORE_MAST]), stringDef())).toEqual([]);
    const ship = testShip([FORE_MAST, AFT_MAST]);
    const points = openAttachPoints(ship, stringDef());
    expect(points.map((p) => p.parentId).sort()).toEqual(["m1", "m2"]);
  });

  it("hang below the mast top, and target the other mast's hang height", () => {
    const ship = testShip([FORE_MAST, AFT_MAST]);
    const fore = attachPointsOf(ship, "m1").find((p) => p.id === "string");
    expect(fore?.position.y).toBeCloseTo(7 * 0.85);
    const target = stringTarget(ship, FORE_MAST);
    expect(target?.y).toBeCloseTo(6 * 0.85);
  });

  it("also string between funnels and masts", () => {
    const parts = [DECK, attachPart("f", "funnel", "a", "funnel"), FORE_MAST];
    const ship = testShip(parts);
    expect(attachPointsOf(ship, "f").map((p) => p.type)).toEqual([
      "string-mount",
    ]);
    expect(canPlaceOn(parts, "string-lights", "f", "string")).toBe(true);
    expect(canPlaceOn(parts, "string-lights", "m1", "string")).toBe(true);
  });

  it("allow only one string per pole, and sit beside a wireless aerial", () => {
    const parts = [
      FORE_MAST,
      AFT_MAST,
      attachPart("s1", "string-lights", "m1", "string"),
    ];
    expect(canPlaceOn(parts, "string-lights", "m1", "string")).toBe(false);
    expect(canPlaceOn(parts, "wireless-aerial", "m1", "aerial")).toBe(true);
  });

  it("are removed with their mast", () => {
    const ship = testShip([
      FORE_MAST,
      AFT_MAST,
      attachPart("s1", "string-lights", "m1", "string"),
    ]);
    expect(cascadeIds(ship, ["m1"])).toEqual(["m1", "s1"]);
  });

  it("are dropped when the other mast goes, as the point vanishes", () => {
    const ship = testShip([
      FORE_MAST,
      AFT_MAST,
      attachPart("s1", "string-lights", "m1", "string"),
    ]);
    const ids = cascadeIds(ship, ["m2"]);
    expect(ids).toEqual(["m2", "s1"]);
    expect(validateShip(removeParts(ship, ids)).ok).toBe(true);
  });
});

describe("navigation lights", () => {
  it("sit on a bridge roof, one set per bridge", () => {
    expect(canPlaceOn([BRIDGE], "nav-lights", "br", "nav")).toBe(true);
    const placed = [BRIDGE, attachPart("n", "nav-lights", "br", "nav")];
    expect(canPlaceOn(placed, "nav-lights", "br", "nav")).toBe(false);
  });

  it("share the bridge roof with a searchlight", () => {
    const placed = [BRIDGE, attachPart("n", "nav-lights", "br", "nav")];
    expect(canPlaceOn(placed, "searchlight", "br", "light")).toBe(true);
  });

  it("have nowhere to go without a bridge", () => {
    expect(openAttachPoints(testShip([DECK]), navDef())).toEqual([]);
  });
});

describe("floodlight", () => {
  it("goes on the main deck or a deck block like a deck lamp", () => {
    const ship = testShip([DECK]);
    const cell = (level: number, x: number) =>
      canPlace(ship, {
        type: "floodlight",
        anchor: { kind: "grid", level, x, z: 0 },
        rotation: 0,
      }).ok;
    expect(cell(0, 0)).toBe(true);
    expect(cell(1, 4)).toBe(true);
    expect(cell(1, 0)).toBe(false);
  });
});

describe("underwater lights", () => {
  it("are offered on both hull sides, every other cell, clear of the ends", () => {
    const ship = testShip([], 8, 4);
    const length = gridLength(ship);
    const points = attachPointsOf(ship, HULL_ID).filter(
      (p) => p.type === "hull-light-mount"
    );
    const cells = [...new Set(points.map((p) => p.position.x - 0.5))];
    expect(cells[0]).toBe(1);
    expect(cells.every((c, i) => i === 0 || c - cells[i - 1] === 2)).toBe(true);
    expect(cells[cells.length - 1]).toBeLessThan(length - 1);
    expect(points).toHaveLength(cells.length * 2);
    const port = points.find((p) => p.id === "uw:port:3");
    expect(port?.side).toBe("port");
    expect(port?.position).toEqual({ x: 3.5, y: UNDERWATER_MOUNT_Y, z: 4 });
    const starboard = points.find((p) => p.id === "uw:starboard:3");
    expect(starboard?.position.z).toBe(0);
  });

  it("sit below the waterline and take one light per spot", () => {
    expect(UNDERWATER_MOUNT_Y).toBeLessThan(-1.2);
    const parts = [attachPart("u", "underwater-light", HULL_ID, "uw:port:3")];
    expect(canPlaceOn([], "underwater-light", HULL_ID, "uw:port:3")).toBe(true);
    expect(canPlaceOn(parts, "underwater-light", HULL_ID, "uw:port:3")).toBe(
      false
    );
    expect(canPlaceOn(parts, "underwater-light", HULL_ID, "uw:port:1")).toBe(
      true
    );
  });

  it("cannot go on a spot past the hull's end", () => {
    const ship = testShip([], 3, 3);
    const past = `uw:port:${gridLength(ship)}`;
    const result = canPlace(ship, {
      type: "underwater-light",
      anchor: { kind: "attach", parentId: HULL_ID, pointId: past },
      rotation: 0,
    });
    expect(result.ok).toBe(false);
  });
});

describe("saving", () => {
  it("round-trips every light part through the save schema", () => {
    const ship = testShip([
      BRIDGE,
      DECK,
      FORE_MAST,
      AFT_MAST,
      attachPart("s1", "string-lights", "m1", "string"),
      attachPart("n1", "nav-lights", "br", "nav"),
      attachPart("u1", "underwater-light", HULL_ID, "uw:port:3"),
      gridPart("fl", "floodlight", 1, 4, 0),
    ]);
    const parsed = shipSchema.safeParse(JSON.parse(JSON.stringify(ship)));
    expect(parsed.success).toBe(true);
  });
});

function stringDef(): AttachPartDef {
  return CATALOG["string-lights"] as AttachPartDef;
}

function navDef(): AttachPartDef {
  return CATALOG["nav-lights"] as AttachPartDef;
}
