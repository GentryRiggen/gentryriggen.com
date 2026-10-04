import { attachPointsOf, isPointTaken, openAttachPoints } from "../attach";
import { getPartDef } from "../catalog";
import {
  canPlace,
  cascadeIds,
  removeParts,
  validateShip,
  type PartCandidate,
} from "../placement";
import { computeStats } from "../stats";
import {
  HULL_ID,
  type AttachPartDef,
  type PartType,
  type PlacedPart,
} from "../types";
import { parseShip } from "../../persist/schema";
import { attachPart, gridPart, testShip } from "../../testing";

function attachCandidate(
  type: PartType,
  parentId: string,
  pointId: string
): PartCandidate {
  return { type, anchor: { kind: "attach", parentId, pointId }, rotation: 0 };
}

/** Four 1×1 deck blocks forming a 2×2 square at level 0, x 4-5, z 1-2. */
function squareParts(): PlacedPart[] {
  return [
    gridPart("a", "deck-1x1", 0, 4, 1),
    gridPart("b", "deck-1x1", 0, 5, 1),
    gridPart("c", "deck-1x1", 0, 4, 2),
    gridPart("d", "deck-1x1", 0, 5, 2),
  ];
}

const LARGE_POINT = "funnel-lg:4:1";

function withPad() {
  return testShip([
    ...squareParts(),
    attachPart("pad", "helipad", "a", LARGE_POINT),
  ]);
}

describe("helipad and helicopter", () => {
  it("exposes one heli point at the pad's centre top", () => {
    const points = attachPointsOf(withPad(), "pad");
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ id: "heli", type: "heli-mount" });
    expect(points[0].position.x).toBe(5);
    expect(points[0].position.z).toBe(2);
    expect(points[0].position.y).toBeGreaterThan(1);
  });

  it("exposes no heli point for other parts or a missing pad", () => {
    expect(attachPointsOf(testShip(squareParts()), "a")).not.toContainEqual(
      expect.objectContaining({ type: "heli-mount" })
    );
    expect(attachPointsOf(testShip(), "pad")).toEqual([]);
  });

  it("lets a helicopter land once, on the pad", () => {
    const ship = withPad();
    const def = getPartDef("helicopter") as AttachPartDef;
    expect(openAttachPoints(ship, def)).toEqual([
      expect.objectContaining({ parentId: "pad" }),
    ]);
    const landed = {
      ...ship,
      parts: [...ship.parts, attachPart("heli", "helicopter", "pad", "heli")],
    };
    expect(validateShip(landed).ok).toBe(true);
    expect(isPointTaken(landed, "pad", "heli")).toBe(true);
    expect(
      canPlace(landed, attachCandidate("helicopter", "pad", "heli")).ok
    ).toBe(false);
  });

  it("can't put a helicopter anywhere but a helipad", () => {
    const ship = withPad();
    expect(
      canPlace(ship, attachCandidate("helicopter", "a", "funnel")).ok
    ).toBe(false);
    expect(
      canPlace(ship, attachCandidate("helicopter", HULL_ID, "mast-fore")).ok
    ).toBe(false);
  });

  it("removes the helicopter with its helipad", () => {
    const pad = withPad();
    const ship = {
      ...pad,
      parts: [...pad.parts, attachPart("heli", "helicopter", "pad", "heli")],
    };
    const ids = cascadeIds(ship, ["pad"]);
    expect(ids).toEqual(["pad", "heli"]);
    const after = removeParts(ship, ids);
    expect(after.parts.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(validateShip(after).ok).toBe(true);
  });

  it("claims the 2×2 so a turret can't share the pad's blocks", () => {
    const ship = withPad();
    expect(
      canPlace(ship, attachCandidate("turret-small", "a", "funnel")).ok
    ).toBe(false);
    expect(
      canPlace(ship, attachCandidate("turret-large", "a", LARGE_POINT)).ok
    ).toBe(false);
  });
});

describe("turrets", () => {
  it("conflict with funnels and masts on the same block top", () => {
    const funnelShip = testShip([
      gridPart("a", "deck-1x1", 0, 4, 1),
      attachPart("f", "funnel", "a", "funnel"),
    ]);
    expect(
      canPlace(funnelShip, attachCandidate("turret-small", "a", "funnel")).ok
    ).toBe(false);
    const mastShip = testShip([
      gridPart("a", "deck-1x1", 0, 4, 1),
      attachPart("m", "mast", "a", "mast"),
    ]);
    expect(
      canPlace(mastShip, attachCandidate("turret-small", "a", "funnel")).ok
    ).toBe(false);
  });

  it("block a funnel and a mast once a turret is on the block", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 4, 1),
      attachPart("t", "turret-small", "a", "funnel"),
    ]);
    expect(validateShip(ship).ok).toBe(true);
    expect(canPlace(ship, attachCandidate("funnel", "a", "funnel")).ok).toBe(
      false
    );
    expect(canPlace(ship, attachCandidate("mast", "a", "mast")).ok).toBe(false);
    expect(canPlace(ship, attachCandidate("radar-mast", "a", "mast")).ok).toBe(
      false
    );
  });

  it("small turrets sit on any open deck block top", () => {
    const def = getPartDef("turret-small") as AttachPartDef;
    expect(openAttachPoints(testShip(squareParts()), def)).toHaveLength(4);
  });

  it("large turrets use the 2×2 mount and conflict with a large funnel", () => {
    const ship = testShip([
      ...squareParts(),
      attachPart("t", "turret-large", "a", LARGE_POINT),
    ]);
    expect(validateShip(ship).ok).toBe(true);
    expect(
      canPlace(ship, attachCandidate("funnel-large", "a", LARGE_POINT)).ok
    ).toBe(false);
    expect(
      canPlace(ship, attachCandidate("turret-small", "b", "funnel")).ok
    ).toBe(false);
  });
});

describe("radar mast", () => {
  it("goes on the hull's mast spots and on block tops", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 4, 1)]);
    for (const [parent, point] of [
      [HULL_ID, "mast-fore"],
      [HULL_ID, "mast-aft"],
      ["a", "mast"],
    ]) {
      expect(
        canPlace(ship, attachCandidate("radar-mast", parent, point)).ok
      ).toBe(true);
    }
  });

  it("shares mast spots with the plain mast", () => {
    const ship = testShip([attachPart("m", "mast", HULL_ID, "mast-fore")]);
    expect(
      canPlace(ship, attachCandidate("radar-mast", HULL_ID, "mast-fore")).ok
    ).toBe(false);
    const def = getPartDef("radar-mast") as AttachPartDef;
    expect(openAttachPoints(ship, def).map((o) => o.point.id)).toEqual([
      "mast-aft",
    ]);
  });
});

describe("RIB boat", () => {
  function davitShip() {
    return testShip([
      gridPart("a", "deck-1x1", 0, 2, 0),
      attachPart("dav", "davit", "a", "davit:2:0"),
    ]);
  }

  it("hangs from a davit and seats 15", () => {
    const ship = davitShip();
    expect(getPartDef("rib-boat")).toMatchObject({ seats: 15 });
    expect(canPlace(ship, attachCandidate("rib-boat", "dav", "boat")).ok).toBe(
      true
    );
    const loaded = {
      ...ship,
      parts: [...ship.parts, attachPart("rib", "rib-boat", "dav", "boat")],
    };
    expect(computeStats(loaded).lifeboatSeats).toBe(15);
    expect(
      canPlace(loaded, attachCandidate("lifeboat-standard", "dav", "boat")).ok
    ).toBe(false);
  });

  it("is removed with its davit", () => {
    const base = davitShip();
    const ship = {
      ...base,
      parts: [...base.parts, attachPart("rib", "rib-boat", "dav", "boat")],
    };
    expect(cascadeIds(ship, ["dav"])).toEqual(["dav", "rib"]);
  });
});

describe("saves", () => {
  it("still validates a ship saved before the navy parts", () => {
    const old = testShip([
      ...squareParts(),
      attachPart("f", "funnel-large", "a", LARGE_POINT),
      attachPart("m", "mast", HULL_ID, "mast-fore"),
    ]);
    expect(parseShip(JSON.parse(JSON.stringify(old))).ok).toBe(true);
  });

  it("round-trips a ship using every navy part", () => {
    const ship = testShip([
      ...squareParts(),
      gridPart("e", "deck-1x1", 0, 2, 0),
      gridPart("g", "deck-1x1", 0, 6, 1),
      attachPart("pad", "helipad", "a", LARGE_POINT),
      attachPart("heli", "helicopter", "pad", "heli"),
      attachPart("turret", "turret-small", "g", "funnel"),
      attachPart("radar", "radar-mast", HULL_ID, "mast-fore"),
      attachPart("dav", "davit", "e", "davit:2:0"),
      attachPart("rib", "rib-boat", "dav", "boat"),
    ]);
    expect(parseShip(JSON.parse(JSON.stringify(ship))).ok).toBe(true);
  });
});
