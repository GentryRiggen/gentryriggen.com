import {
  attachPointsOf,
  claimsOf,
  isPointTaken,
  openAttachPoints,
  propCount,
  PROP_MOUNT_Y,
} from "../attach";
import { getPartDef } from "../catalog";
import { MAX_SEGMENTS } from "../grid";
import {
  canPlace,
  cascadeIds,
  removeParts,
  setHullSize,
  validateShip,
  type PartCandidate,
} from "../placement";
import {
  HULL_ID,
  type AttachPartDef,
  type PartType,
  type PlacedPart,
} from "../types";
import { parseShip } from "../../persist/schema";
import { attachPart, gridPart, testShip } from "../../testing";

const OK = { ok: true };

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

const largeFunnelPointIds = (ship: ReturnType<typeof testShip>) =>
  ship.parts.flatMap((part) =>
    attachPointsOf(ship, part.id)
      .filter((p) => p.type === "large-funnel-mount")
      .map((p) => `${part.id}/${p.id}`)
  );

describe("segments", () => {
  it("allows 20 segments and rejects 21", () => {
    expect(MAX_SEGMENTS).toBe(20);
    expect(parseShip(testShip([], 20)).ok).toBe(true);
    expect(parseShip(testShip([], 21)).ok).toBe(false);
    expect(validateShip(testShip([], 21)).ok).toBe(false);
  });
});

describe("large funnel points", () => {
  it("appears for a 2×2 of 1×1 deck blocks, at the square's centre top", () => {
    const ship = testShip(squareParts());
    expect(largeFunnelPointIds(ship)).toEqual(["a/funnel-lg:4:1"]);
    const point = attachPointsOf(ship, "a").find(
      (p) => p.id === "funnel-lg:4:1"
    );
    expect(point?.position).toEqual({ x: 5, y: 1, z: 2 });
    expect(point?.claims).toEqual([
      "top:0:4:1",
      "top:0:5:1",
      "top:0:4:2",
      "top:0:5:2",
    ]);
  });

  it("appears for two 2×1 blocks", () => {
    const ship = testShip([
      gridPart("a", "deck-2x1", 0, 4, 1),
      gridPart("b", "deck-2x1", 0, 4, 2),
    ]);
    expect(largeFunnelPointIds(ship)).toEqual(["a/funnel-lg:4:1"]);
  });

  it("appears for a mix of 1×1 and 2×1 blocks", () => {
    const ship = testShip([
      gridPart("a", "deck-2x1", 0, 4, 1),
      gridPart("b", "deck-1x1", 0, 4, 2),
      gridPart("c", "deck-1x1", 0, 5, 2),
    ]);
    expect(largeFunnelPointIds(ship)).toEqual(["a/funnel-lg:4:1"]);
  });

  it("is exposed once per square, including overlapping squares", () => {
    const ship = testShip([
      ...squareParts(),
      gridPart("e", "deck-1x1", 0, 6, 1),
      gridPart("f", "deck-1x1", 0, 6, 2),
    ]);
    expect(largeFunnelPointIds(ship).sort()).toEqual([
      "a/funnel-lg:4:1",
      "b/funnel-lg:5:1",
    ]);
  });

  it("does not appear over cabins or the bridge", () => {
    const cabins = testShip([
      gridPart("a", "cabin-1st", 0, 4, 1),
      gridPart("b", "deck-1x1", 0, 5, 1),
      gridPart("c", "deck-1x1", 0, 4, 2),
      gridPart("d", "deck-1x1", 0, 5, 2),
    ]);
    expect(largeFunnelPointIds(cabins)).toEqual([]);
    const bridge = testShip([
      gridPart("a", "deck-1x1", 0, 1, 0),
      gridPart("b", "deck-1x1", 0, 1, 1),
      gridPart("c", "deck-1x1", 0, 1, 2),
      gridPart("d", "deck-1x1", 0, 1, 3),
      gridPart("br", "bridge", 1, 1, 0),
      gridPart("e", "deck-1x1", 1, 0, 0),
    ]);
    expect(largeFunnelPointIds(bridge)).toEqual([]);
  });

  it("does not appear when the blocks are at different levels", () => {
    const ship = testShip([
      ...squareParts(),
      gridPart("up", "deck-1x1", 1, 4, 1),
    ]);
    expect(largeFunnelPointIds(ship)).toEqual([]);
  });

  it("disappears when any block is covered", () => {
    const ship = testShip([
      ...squareParts(),
      gridPart("up", "deck-1x1", 1, 5, 2),
    ]);
    expect(largeFunnelPointIds(ship)).toEqual([]);
  });

  it("cascades the funnel when a block under it is removed", () => {
    const ship = testShip([
      ...squareParts(),
      attachPart("lf", "funnel-large", "a", "funnel-lg:4:1"),
    ]);
    expect(validateShip(ship)).toEqual(OK);
    expect(cascadeIds(ship, ["d"])).toEqual(["d", "lf"]);
    expect(removeParts(ship, cascadeIds(ship, ["d"])).parts).toHaveLength(3);
  });

  it("cascades the funnel when a hull resize drops a block under it", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 11, 1),
      gridPart("b", "deck-1x1", 0, 12, 1),
      gridPart("c", "deck-1x1", 0, 11, 2),
      gridPart("d", "deck-1x1", 0, 12, 2),
      attachPart("lf", "funnel-large", "a", "funnel-lg:11:1"),
    ]);
    expect(validateShip(ship)).toEqual(OK);
    const smaller = setHullSize(ship, { lengthSegments: 4 });
    expect(smaller.parts.map((p) => p.id)).toEqual(["a", "c"]);
  });
});

describe("funnel claims", () => {
  it("blocks a small funnel on a block under a large funnel", () => {
    const ship = testShip([
      ...squareParts(),
      attachPart("lf", "funnel-large", "a", "funnel-lg:4:1"),
    ]);
    expect(canPlace(ship, attachCandidate("funnel", "b", "funnel"))).toEqual({
      ok: false,
      reason: "That spot is taken",
    });
    expect(
      openAttachPoints(ship, getPartDef("funnel") as AttachPartDef)
    ).toEqual([]);
  });

  it("blocks a large funnel over a block that holds a small funnel", () => {
    const ship = testShip([
      ...squareParts(),
      attachPart("sf", "funnel", "d", "funnel"),
    ]);
    expect(
      canPlace(ship, attachCandidate("funnel-large", "a", "funnel-lg:4:1"))
    ).toEqual({ ok: false, reason: "That spot is taken" });
  });

  it("blocks two large funnels over overlapping squares", () => {
    const ship = testShip([
      ...squareParts(),
      gridPart("e", "deck-1x1", 0, 6, 1),
      gridPart("f", "deck-1x1", 0, 6, 2),
      attachPart("lf", "funnel-large", "a", "funnel-lg:4:1"),
    ]);
    expect(
      canPlace(ship, attachCandidate("funnel-large", "b", "funnel-lg:5:1"))
    ).toEqual({ ok: false, reason: "That spot is taken" });
  });

  it("allows large funnels over disjoint squares", () => {
    const ship = testShip([
      ...squareParts(),
      gridPart("e", "deck-1x1", 0, 6, 1),
      gridPart("f", "deck-1x1", 0, 7, 1),
      gridPart("g", "deck-1x1", 0, 6, 2),
      gridPart("h", "deck-1x1", 0, 7, 2),
      attachPart("lf", "funnel-large", "a", "funnel-lg:4:1"),
    ]);
    expect(
      canPlace(ship, attachCandidate("funnel-large", "e", "funnel-lg:6:1"))
    ).toEqual(OK);
  });

  it("still lets a small funnel go on an untouched neighbour block", () => {
    const ship = testShip([
      ...squareParts(),
      gridPart("e", "deck-1x1", 0, 6, 1),
      attachPart("lf", "funnel-large", "a", "funnel-lg:4:1"),
    ]);
    expect(canPlace(ship, attachCandidate("funnel", "e", "funnel"))).toEqual(
      OK
    );
  });

  it("stops anything being built over a large funnel's blocks", () => {
    const ship = testShip([
      ...squareParts(),
      attachPart("lf", "funnel-large", "a", "funnel-lg:4:1"),
    ]);
    for (const [x, z] of [
      [4, 1],
      [5, 1],
      [4, 2],
      [5, 2],
    ]) {
      expect(
        canPlace(ship, {
          type: "deck-1x1",
          anchor: { kind: "grid", level: 1, x, z },
          rotation: 0,
        })
      ).toEqual({ ok: false, reason: "Can't build over a funnel" });
    }
  });

  it("stops building over a small funnel's 2×1 block on either cell", () => {
    const ship = testShip([
      gridPart("a", "deck-2x1", 0, 4, 1),
      attachPart("sf", "funnel", "a", "funnel"),
    ]);
    for (const x of [4, 5]) {
      expect(
        canPlace(ship, {
          type: "deck-1x1",
          anchor: { kind: "grid", level: 1, x, z: 1 },
          rotation: 0,
        }).ok
      ).toBe(false);
    }
  });
});

/** Davits at x 2 and 3 on the starboard edge of level 1, plus extras. */
function davitPairParts(): PlacedPart[] {
  return [
    gridPart("a2", "deck-1x1", 0, 2, 0),
    gridPart("a3", "deck-1x1", 0, 3, 0),
    gridPart("b2", "deck-1x1", 1, 2, 0),
    gridPart("b3", "deck-1x1", 1, 3, 0),
    attachPart("dv2", "davit", "b2", "davit:2:0"),
    attachPart("dv3", "davit", "b3", "davit:3:0"),
  ];
}

describe("large lifeboat", () => {
  it("is offered on the forward davit of an adjacent pair", () => {
    const ship = testShip(davitPairParts());
    const big = attachPointsOf(ship, "dv2").find((p) => p.id === "big-boat");
    expect(big).toMatchObject({ type: "big-boat-mount", side: "starboard" });
    expect(big?.position.x).toBeCloseTo(3);
    expect(big?.position.y).toBeCloseTo(2.8);
    expect(big?.position.z).toBeCloseTo(-0.6);
    expect(big?.claims).toEqual(["davit:dv2", "davit:dv3"]);
    expect(attachPointsOf(ship, "dv3").map((p) => p.id)).toEqual(["boat"]);
  });

  it("is not offered for a lone davit or davits two cells apart", () => {
    const lone = testShip(davitPairParts().slice(0, 5));
    expect(attachPointsOf(lone, "dv2").map((p) => p.id)).toEqual(["boat"]);
    const apart = testShip([
      gridPart("a2", "deck-1x1", 0, 2, 0),
      gridPart("a4", "deck-1x1", 0, 4, 0),
      gridPart("b2", "deck-1x1", 1, 2, 0),
      gridPart("b4", "deck-1x1", 1, 4, 0),
      attachPart("dv2", "davit", "b2", "davit:2:0"),
      attachPart("dv4", "davit", "b4", "davit:4:0"),
    ]);
    expect(attachPointsOf(apart, "dv2").map((p) => p.id)).toEqual(["boat"]);
  });

  it("is not offered between davits on opposite sides or levels", () => {
    const sides = testShip([
      gridPart("a2", "deck-1x1", 0, 2, 0),
      gridPart("a3", "deck-1x1", 0, 3, 3),
      gridPart("b2", "deck-1x1", 1, 2, 0),
      gridPart("b3", "deck-1x1", 1, 3, 3),
      attachPart("dv2", "davit", "b2", "davit:2:0"),
      attachPart("dv3", "davit", "b3", "davit:3:3"),
    ]);
    expect(attachPointsOf(sides, "dv2").map((p) => p.id)).toEqual(["boat"]);
    const levels = testShip([
      gridPart("a2", "deck-1x1", 0, 2, 0),
      gridPart("a3", "deck-1x1", 0, 3, 0),
      gridPart("b2", "deck-1x1", 1, 2, 0),
      gridPart("b3", "deck-1x1", 1, 3, 0),
      gridPart("c3", "deck-1x1", 2, 3, 0),
      attachPart("dv2", "davit", "b2", "davit:2:0"),
      attachPart("dv3", "davit", "c3", "davit:3:0"),
    ]);
    expect(attachPointsOf(levels, "dv2").map((p) => p.id)).toEqual(["boat"]);
  });

  it("can be placed and validates", () => {
    const ship = testShip([
      ...davitPairParts(),
      attachPart("big", "lifeboat-large", "dv2", "big-boat"),
    ]);
    expect(validateShip(ship)).toEqual(OK);
  });

  it("cascades when either davit is removed", () => {
    const ship = testShip([
      ...davitPairParts(),
      attachPart("big", "lifeboat-large", "dv2", "big-boat"),
    ]);
    expect(cascadeIds(ship, ["dv3"])).toEqual(["dv3", "big"]);
    expect(cascadeIds(ship, ["dv2"])).toEqual(["dv2", "big"]);
  });

  it("blocks small boats on either davit once a large boat hangs there", () => {
    const ship = testShip([
      ...davitPairParts(),
      attachPart("big", "lifeboat-large", "dv2", "big-boat"),
    ]);
    for (const davit of ["dv2", "dv3"]) {
      expect(
        canPlace(ship, attachCandidate("lifeboat-standard", davit, "boat"))
      ).toEqual({ ok: false, reason: "That spot is taken" });
    }
    expect(
      openAttachPoints(ship, getPartDef("lifeboat-standard") as AttachPartDef)
    ).toEqual([]);
  });

  it("blocks a large boat when either davit already holds a small one", () => {
    for (const davit of ["dv2", "dv3"]) {
      const ship = testShip([
        ...davitPairParts(),
        attachPart("sm", "lifeboat-standard", davit, "boat"),
      ]);
      expect(
        canPlace(ship, attachCandidate("lifeboat-large", "dv2", "big-boat"))
      ).toEqual({ ok: false, reason: "That spot is taken" });
    }
  });

  it("allows a large boat on one pair of a davit row but not an overlapping pair", () => {
    const ship = testShip([
      gridPart("a2", "deck-1x1", 0, 2, 0),
      gridPart("a3", "deck-1x1", 0, 3, 0),
      gridPart("a4", "deck-1x1", 0, 4, 0),
      gridPart("b2", "deck-1x1", 1, 2, 0),
      gridPart("b3", "deck-1x1", 1, 3, 0),
      gridPart("b4", "deck-1x1", 1, 4, 0),
      attachPart("dv2", "davit", "b2", "davit:2:0"),
      attachPart("dv3", "davit", "b3", "davit:3:0"),
      attachPart("dv4", "davit", "b4", "davit:4:0"),
      attachPart("big", "lifeboat-large", "dv2", "big-boat"),
    ]);
    expect(validateShip(ship)).toEqual(OK);
    expect(
      canPlace(ship, attachCandidate("lifeboat-large", "dv3", "big-boat"))
    ).toEqual({ ok: false, reason: "That spot is taken" });
    expect(
      canPlace(ship, attachCandidate("lifeboat-standard", "dv4", "boat"))
    ).toEqual(OK);
  });
});

describe("propeller points", () => {
  it.each([
    [3, 2],
    [4, 3],
    [5, 4],
    [6, 4],
    [7, 4],
  ])("beam %i has %i propeller points", (beam, count) => {
    expect(propCount(beam)).toBe(count);
    const points = attachPointsOf(testShip([], 8, beam), HULL_ID).filter(
      (p) => p.type === "prop-mount"
    );
    expect(points.map((p) => p.id)).toEqual(
      Array.from({ length: count }, (_, i) => `prop:${i}`)
    );
    for (const point of points) {
      expect(point.position.y).toBe(PROP_MOUNT_Y);
      expect(point.position.x).toBeCloseTo(23.5);
    }
  });

  it("spreads the points evenly across the beam", () => {
    const zs = attachPointsOf(testShip([], 8, 4), HULL_ID)
      .filter((p) => p.type === "prop-mount")
      .map((p) => p.position.z);
    expect(zs).toEqual([1, 2, 3]);
  });

  it("takes a propeller on each point, once", () => {
    const ship = testShip([attachPart("p0", "propeller", HULL_ID, "prop:0")]);
    expect(isPointTaken(ship, HULL_ID, "prop:0")).toBe(true);
    expect(isPointTaken(ship, HULL_ID, "prop:1")).toBe(false);
    expect(
      canPlace(ship, attachCandidate("propeller", HULL_ID, "prop:0")).ok
    ).toBe(false);
    expect(
      canPlace(ship, attachCandidate("propeller", HULL_ID, "prop:1"))
    ).toEqual(OK);
    expect(
      openAttachPoints(ship, getPartDef("propeller") as AttachPartDef).map(
        (o) => o.point.id
      )
    ).toEqual(["prop:1", "prop:2"]);
  });

  it("drops propellers whose point vanishes when the beam narrows", () => {
    const ship = testShip(
      [attachPart("p3", "propeller", HULL_ID, "prop:3")],
      8,
      5
    );
    expect(validateShip(ship)).toEqual(OK);
    expect(setHullSize(ship, { beam: 4 }).parts).toEqual([]);
  });
});

describe("claims", () => {
  it("defaults to one key unique to the point", () => {
    const point = {
      id: "mast-fore",
      type: "mast-mount" as const,
      position: { x: 0, y: 0, z: 0 },
    };
    expect(claimsOf(HULL_ID, point)).toEqual(["hull/mast-fore"]);
  });
});

describe("existing saves", () => {
  it("still validate with no new parts", () => {
    const ship = testShip([
      gridPart("a", "deck-2x1", 0, 4, 1),
      attachPart("f", "funnel", "a", "funnel"),
      ...davitPairParts(),
      attachPart("lb", "lifeboat-standard", "dv2", "boat"),
      attachPart("mf", "mast-fore", HULL_ID, "mast-fore"),
    ]);
    expect(validateShip(ship)).toEqual(OK);
    expect(parseShip(JSON.parse(JSON.stringify(ship))).ok).toBe(true);
  });
});
