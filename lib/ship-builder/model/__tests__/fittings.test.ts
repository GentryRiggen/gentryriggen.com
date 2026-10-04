import {
  aerialTarget,
  attachPointsOf,
  isPointTaken,
  openAttachPoints,
} from "../attach";
import { CATALOG, getPartDef, visibleParts } from "../catalog";
import { gridLength } from "../grid";
import { sternLength } from "../hullEnds";
import {
  canPlace,
  cascadeIds,
  removeParts,
  validateShip,
  type PartCandidate,
} from "../placement";
import {
  HULL_ID,
  type AttachPartDef,
  type PartType,
  type PlacedPart,
} from "../types";
import { attachPart, gridPart, testShip } from "../../testing";

function candidate(type: PartType, parentId: string, pointId: string) {
  return {
    type,
    anchor: { kind: "attach" as const, parentId, pointId },
    rotation: 0 as const,
  } satisfies PartCandidate;
}

const canPlaceOn = (
  parts: PlacedPart[],
  type: PartType,
  parentId: string,
  pointId: string
) => canPlace(testShip(parts), candidate(type, parentId, pointId)).ok;

const pointIds = (parts: PlacedPart[], parentId: string) =>
  attachPointsOf(testShip(parts), parentId).map((p) => p.id);

/** A bridge at level 0, a deck block, and a mast on each hull mount. */
const BRIDGE = gridPart("br", "bridge", 0, 1, 0);
const DECK = gridPart("a", "deck-1x1", 0, 4, 0);
const FORE_MAST = attachPart("m1", "mast", HULL_ID, "mast-fore");
const AFT_MAST = attachPart("m2", "radar-mast", HULL_ID, "mast-aft");

describe("catalog entries", () => {
  it("lists the dome and aerial for liners only, the rest for every kind", () => {
    expect(CATALOG.dome.kinds).toEqual(["liner"]);
    expect(CATALOG["wireless-aerial"].kinds).toEqual(["liner"]);
    for (const type of ["searchlight", "crows-nest", "stern-flag"] as const) {
      expect(CATALOG[type].kinds).toBeUndefined();
    }
    const navy = visibleParts("navy", false).map((d) => d.type);
    expect(navy).not.toContain("dome");
    expect(navy).toContain("searchlight");
  });

  it("puts the dome on the same mount as a funnel", () => {
    expect((getPartDef("dome") as AttachPartDef).attachTo).toBe("funnel-mount");
  });
});

describe("searchlight points", () => {
  it("appear on a bridge roof centre, and nothing else on a bridge", () => {
    const ship = testShip([BRIDGE]);
    const points = attachPointsOf(ship, "br");
    expect(points).toEqual([
      {
        id: "light",
        type: "searchlight-mount",
        position: { x: 1.5, y: 0.8, z: 2 },
      },
    ]);
  });

  it("appear on a mast and a radar mast near the top", () => {
    const ship = testShip([FORE_MAST, AFT_MAST]);
    const mast = attachPointsOf(ship, "m1").find((p) => p.id === "light");
    const radar = attachPointsOf(ship, "m2").find((p) => p.id === "light");
    expect(mast?.type).toBe("searchlight-mount");
    expect(mast?.position.y).toBeCloseTo(6.6);
    expect(radar?.position.y).toBeCloseTo(5.6);
  });

  it("follow a mast standing on a deck block", () => {
    const ship = testShip([DECK, attachPart("m", "mast", "a", "mast")]);
    const light = attachPointsOf(ship, "m").find((p) => p.id === "light");
    expect(light?.position).toEqual({ x: 4.5, y: 1 + 6.6, z: 0.5 });
  });

  it("are not on decks, the hull or cabins", () => {
    const parts = [DECK, gridPart("c", "cabin-1st", 0, 5, 0)];
    expect(pointIds(parts, "a")).not.toContain("light");
    expect(pointIds(parts, "c")).not.toContain("light");
    expect(pointIds(parts, HULL_ID)).not.toContain("light");
  });

  it("take a searchlight on the bridge and on a mast, one each", () => {
    const parts = [BRIDGE, FORE_MAST];
    expect(canPlaceOn(parts, "searchlight", "br", "light")).toBe(true);
    expect(canPlaceOn(parts, "searchlight", "m1", "light")).toBe(true);
    const lit = [
      ...parts,
      attachPart("s1", "searchlight", "br", "light"),
      attachPart("s2", "searchlight", "m1", "light"),
    ];
    expect(validateShip(testShip(lit)).ok).toBe(true);
    expect(canPlaceOn(lit, "searchlight", "br", "light")).toBe(false);
    expect(canPlaceOn(lit, "searchlight", "m1", "light")).toBe(false);
  });

  it("cascade away with their bridge or their mast", () => {
    const ship = testShip([
      BRIDGE,
      FORE_MAST,
      attachPart("s1", "searchlight", "br", "light"),
      attachPart("s2", "searchlight", "m1", "light"),
    ]);
    expect(cascadeIds(ship, ["br"])).toEqual(["br", "s1"]);
    expect(cascadeIds(ship, ["m1"])).toEqual(["m1", "s2"]);
    expect(validateShip(removeParts(ship, cascadeIds(ship, ["br"]))).ok).toBe(
      true
    );
  });
});

describe("crow's nest", () => {
  it("is offered on a mast at 60% of its height, not on a radar mast", () => {
    const ship = testShip([FORE_MAST, AFT_MAST]);
    const nest = attachPointsOf(ship, "m1").find((p) => p.id === "nest");
    expect(nest).toMatchObject({ type: "nest-mount" });
    expect(nest?.position.y).toBeCloseTo(4.2);
    expect(pointIds([FORE_MAST, AFT_MAST], "m2")).not.toContain("nest");
    expect(canPlaceOn([FORE_MAST], "crows-nest", "m1", "nest")).toBe(true);
    expect(canPlaceOn([AFT_MAST], "crows-nest", "m2", "nest")).toBe(false);
  });

  it("takes one nest per mast and cascades with the mast", () => {
    const parts = [FORE_MAST, attachPart("n", "crows-nest", "m1", "nest")];
    const ship = testShip(parts);
    expect(isPointTaken(ship, "m1", "nest")).toBe(true);
    expect(canPlaceOn(parts, "crows-nest", "m1", "nest")).toBe(false);
    expect(cascadeIds(ship, ["m1"])).toEqual(["m1", "n"]);
  });

  it("coexists with a searchlight and an aerial on the same mast", () => {
    const parts = [
      FORE_MAST,
      AFT_MAST,
      attachPart("n", "crows-nest", "m1", "nest"),
      attachPart("s", "searchlight", "m1", "light"),
      attachPart("w", "wireless-aerial", "m1", "aerial"),
    ];
    expect(validateShip(testShip(parts)).ok).toBe(true);
  });
});

describe("stern flag", () => {
  it("has one hull point on the centreline, aft of the last cell", () => {
    const ship = testShip();
    const flag = attachPointsOf(ship, HULL_ID).find((p) => p.id === "flag");
    expect(flag).toMatchObject({ type: "flag-mount" });
    expect(flag?.position.z).toBe(2);
    expect(flag?.position.x).toBeGreaterThan(gridLength(ship));
    expect(flag?.position.x).toBeLessThan(
      gridLength(ship) + sternLength(ship.hull.stern)
    );
  });

  it("is placed once and only on the hull", () => {
    expect(canPlaceOn([], "stern-flag", HULL_ID, "flag")).toBe(true);
    expect(canPlaceOn([DECK], "stern-flag", "a", "funnel")).toBe(false);
    const flagged = [attachPart("f", "stern-flag", HULL_ID, "flag")];
    expect(validateShip(testShip(flagged)).ok).toBe(true);
    expect(canPlaceOn(flagged, "stern-flag", HULL_ID, "flag")).toBe(false);
    expect(pointIds([DECK], "a")).not.toContain("flag");
  });
});

describe("dome", () => {
  it("sits on a block top, like a funnel", () => {
    expect(canPlaceOn([DECK], "dome", "a", "funnel")).toBe(true);
    expect(canPlaceOn([DECK], "dome", "a", "mast")).toBe(false);
    expect(canPlaceOn([], "dome", HULL_ID, "mast-fore")).toBe(false);
  });

  it("conflicts with a funnel on the same block top, either way round", () => {
    const withFunnel = [DECK, attachPart("f", "funnel", "a", "funnel")];
    expect(canPlaceOn(withFunnel, "dome", "a", "funnel")).toBe(false);
    const withDome = [DECK, attachPart("d", "dome", "a", "funnel")];
    expect(canPlaceOn(withDome, "funnel", "a", "funnel")).toBe(false);
    expect(canPlaceOn(withDome, "mast", "a", "mast")).toBe(false);
  });

  it("cascades with its block", () => {
    const ship = testShip([DECK, attachPart("d", "dome", "a", "funnel")]);
    expect(cascadeIds(ship, ["a"])).toEqual(["a", "d"]);
  });
});

describe("wireless aerial", () => {
  it("has no point while a mast is alone", () => {
    expect(pointIds([FORE_MAST], "m1")).not.toContain("aerial");
    expect(canPlaceOn([FORE_MAST], "wireless-aerial", "m1", "aerial")).toBe(
      false
    );
    expect(
      openAttachPoints(
        testShip([FORE_MAST]),
        CATALOG["wireless-aerial"] as AttachPartDef
      )
    ).toEqual([]);
  });

  it("appears on both masts, radar mast included, once there are two", () => {
    const parts = [FORE_MAST, AFT_MAST];
    expect(pointIds(parts, "m1")).toContain("aerial");
    expect(pointIds(parts, "m2")).toContain("aerial");
    const aerial = attachPointsOf(testShip(parts), "m1").find(
      (p) => p.id === "aerial"
    );
    expect(aerial).toMatchObject({ type: "aerial-mount" });
    expect(aerial?.position.y).toBeCloseTo(7);
    expect(canPlaceOn(parts, "wireless-aerial", "m1", "aerial")).toBe(true);
  });

  it("targets the nearest other mast's top", () => {
    const near = attachPart("m3", "mast", "a", "mast");
    const ship = testShip([DECK, FORE_MAST, AFT_MAST, near]);
    const fore = ship.parts.find((p) => p.id === "m1") as PlacedPart;
    expect(aerialTarget(ship, fore)).toEqual({ x: 4.5, y: 1 + 7, z: 0.5 });
    const aft = ship.parts.find((p) => p.id === "m2") as PlacedPart;
    expect(aerialTarget(ship, aft)).toEqual({ x: 4.5, y: 8, z: 0.5 });
  });

  it("goes when the other mast is removed", () => {
    const ship = testShip([
      FORE_MAST,
      AFT_MAST,
      attachPart("w", "wireless-aerial", "m1", "aerial"),
    ]);
    expect(validateShip(ship).ok).toBe(true);
    expect(cascadeIds(ship, ["m2"])).toEqual(["m2", "w"]);
    expect(validateShip(removeParts(ship, cascadeIds(ship, ["m2"]))).ok).toBe(
      true
    );
  });

  it("goes when its own mast is removed", () => {
    const ship = testShip([
      FORE_MAST,
      AFT_MAST,
      attachPart("w", "wireless-aerial", "m1", "aerial"),
    ]);
    expect(cascadeIds(ship, ["m1"])).toEqual(["m1", "w"]);
  });

  it("survives while some other mast remains", () => {
    const third = attachPart("m3", "mast", "a", "mast");
    const ship = testShip([
      DECK,
      FORE_MAST,
      AFT_MAST,
      third,
      attachPart("w", "wireless-aerial", "m1", "aerial"),
    ]);
    expect(cascadeIds(ship, ["m2"])).toEqual(["m2"]);
  });
});

describe("old saves", () => {
  it("still validate with masts, a bridge and a funnel and no fittings", () => {
    const ship = testShip([
      BRIDGE,
      DECK,
      FORE_MAST,
      AFT_MAST,
      attachPart("f", "funnel", "a", "funnel"),
    ]);
    expect(validateShip(ship).ok).toBe(true);
  });
});
