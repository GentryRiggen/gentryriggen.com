import {
  canPlace,
  cascadeIds,
  emptyShip,
  place,
  previewHullLength,
  removeParts,
  removeWithCascade,
  setHullLength,
  validateShip,
  type PartCandidate,
} from "../placement";
import { HULL_ID, type PartType, type Rotation } from "../types";
import { attachPart, gridPart, testShip } from "../../testing";

function gridCandidate(
  type: PartType,
  level: number,
  x: number,
  z: number,
  rotation: Rotation = 0
): PartCandidate {
  return { type, anchor: { kind: "grid", level, x, z }, rotation };
}

function attachCandidate(
  type: PartType,
  parentId: string,
  pointId: string
): PartCandidate {
  return { type, anchor: { kind: "attach", parentId, pointId }, rotation: 0 };
}

const fail = (reason: string) => ({ ok: false, reason });
const OK = { ok: true };

/** Two-level stack at (2, 0) with a davit and a boat on the top block. */
function boatDeckShip() {
  return testShip([
    gridPart("a", "deck-1x1", 0, 2, 0),
    gridPart("b", "deck-1x1", 1, 2, 0),
    attachPart("dv", "davit", "b", "davit:2:0"),
    attachPart("lb", "lifeboat-standard", "dv", "boat"),
  ]);
}

describe("canPlace — grid parts", () => {
  it("allows a block on the main deck", () => {
    expect(canPlace(testShip(), gridCandidate("deck-1x1", 0, 0, 0))).toEqual(
      OK
    );
  });

  it("rejects cells outside the hull", () => {
    const ship = testShip(); // 24 x 4
    expect(canPlace(ship, gridCandidate("deck-1x1", 0, 24, 0))).toEqual(
      fail("Outside the hull")
    );
    expect(canPlace(ship, gridCandidate("deck-1x1", 0, 0, 4))).toEqual(
      fail("Outside the hull")
    );
    expect(canPlace(ship, gridCandidate("deck-1x1", 4, 0, 0))).toEqual(
      fail("Outside the hull")
    );
    expect(canPlace(ship, gridCandidate("deck-2x1", 0, 23, 0))).toEqual(
      fail("Outside the hull")
    );
    expect(canPlace(ship, gridCandidate("deck-2x1", 0, 0, 3, 90))).toEqual(
      fail("Outside the hull")
    );
  });

  it("rejects overlapping parts (rule 2)", () => {
    const ship = testShip([gridPart("a", "deck-2x1", 0, 4, 1)]);
    expect(canPlace(ship, gridCandidate("cabin-3rd", 0, 5, 1))).toEqual(
      fail("That space is taken")
    );
  });

  it("requires support under every cell above level 0 (rule 1)", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 4, 1)]);
    expect(canPlace(ship, gridCandidate("deck-1x1", 1, 4, 1))).toEqual(OK);
    expect(canPlace(ship, gridCandidate("deck-1x1", 1, 6, 1))).toEqual(
      fail("Needs a deck beneath every cell")
    );
    expect(canPlace(ship, gridCandidate("deck-2x1", 1, 4, 1))).toEqual(
      fail("Needs a deck beneath every cell")
    );
  });

  it("refuses to build over a bridge, funnel or davit (rule 6)", () => {
    const fullBeam = [0, 1, 2, 3].map((z) =>
      gridPart(`l${z}`, "deck-1x1", 0, 1, z)
    );
    const withBridge = testShip([
      ...fullBeam,
      gridPart("br", "bridge", 1, 1, 0),
    ]);
    expect(canPlace(withBridge, gridCandidate("deck-1x1", 2, 1, 2))).toEqual(
      fail("Can't build on top of the bridge")
    );

    const withFunnel = testShip([
      gridPart("a", "deck-2x1", 0, 4, 1),
      attachPart("f", "funnel", "a", "funnel"),
    ]);
    expect(canPlace(withFunnel, gridCandidate("deck-1x1", 1, 5, 1))).toEqual(
      fail("Can't build over a funnel")
    );

    expect(
      canPlace(boatDeckShip(), gridCandidate("deck-1x1", 2, 2, 0))
    ).toEqual(fail("Can't build over a davit"));
  });

  it("keeps the bridge in the forward half (rule 3)", () => {
    const ship = testShip(); // length 24, half = 12
    expect(canPlace(ship, gridCandidate("bridge", 0, 11, 0))).toEqual(OK);
    expect(canPlace(ship, gridCandidate("bridge", 0, 12, 0))).toEqual(
      fail("The bridge must be in the forward half")
    );
    expect(canPlace(ship, gridCandidate("bridge", 0, 8, 0, 90))).toEqual(OK);
    expect(canPlace(ship, gridCandidate("bridge", 0, 9, 0, 90))).toEqual(
      fail("The bridge must be in the forward half")
    );
  });

  it("rejects a 2x1 whose anchor cell is over a funnel's block, at 0 and 180", () => {
    const ship = testShip([
      gridPart("base", "deck-1x1", 0, 4, 1),
      gridPart("side", "deck-1x1", 0, 5, 1),
      attachPart("f", "funnel", "base", "funnel"),
    ]);
    expect(validateShip(ship)).toEqual(OK);
    for (const rotation of [0, 180] as const) {
      expect(
        canPlace(ship, gridCandidate("deck-2x1", 1, 4, 1, rotation))
      ).toEqual(fail("Can't build over a funnel"));
    }
  });

  it("applies the forward-half rule to a bridge at 180 and 270", () => {
    const ship = testShip(); // length 24, half = 12
    expect(canPlace(ship, gridCandidate("bridge", 0, 11, 0, 180))).toEqual(OK);
    expect(canPlace(ship, gridCandidate("bridge", 0, 12, 0, 180))).toEqual(
      fail("The bridge must be in the forward half")
    );
    expect(canPlace(ship, gridCandidate("bridge", 0, 8, 0, 270))).toEqual(OK);
    expect(canPlace(ship, gridCandidate("bridge", 0, 9, 0, 270))).toEqual(
      fail("The bridge must be in the forward half")
    );
  });

  it("keeps the bridge on top of its stack (rule 3)", () => {
    // Hand-built, inconsistent ship: something floats above the target cells.
    const ship = testShip([gridPart("float", "deck-1x1", 1, 2, 2)]);
    expect(canPlace(ship, gridCandidate("bridge", 0, 2, 0))).toEqual(
      fail("The bridge must be on top of its stack")
    );
  });

  it("rejects a grid part given an attach anchor", () => {
    expect(
      canPlace(testShip(), attachCandidate("deck-1x1", HULL_ID, "mast-fore"))
    ).toEqual(fail("Place this on the deck grid"));
  });
});

describe("canPlace — attach parts (rules 4 and 5)", () => {
  it("puts a funnel on a deck block, not on a cabin", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 4, 1),
      gridPart("c", "cabin-1st", 0, 6, 1),
    ]);
    expect(canPlace(ship, attachCandidate("funnel", "a", "funnel"))).toEqual(
      OK
    );
    expect(canPlace(ship, attachCandidate("funnel", "c", "funnel"))).toEqual(
      fail("Needs a free funnel mount on a deck block")
    );
  });

  it("allows one part per attach point", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 4, 1),
      attachPart("f", "funnel", "a", "funnel"),
    ]);
    expect(canPlace(ship, attachCandidate("funnel", "a", "funnel"))).toEqual(
      fail("That spot is taken")
    );
  });

  it("matches masts to their own mount", () => {
    const ship = testShip();
    expect(
      canPlace(ship, attachCandidate("mast-fore", HULL_ID, "mast-fore"))
    ).toEqual(OK);
    expect(
      canPlace(ship, attachCandidate("mast-fore", HULL_ID, "mast-aft"))
    ).toEqual(fail("Needs a free mast mount"));
  });

  it("puts davits only on boat-deck edges at level 1 or higher", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 0),
      gridPart("b", "deck-1x1", 1, 2, 0),
    ]);
    expect(canPlace(ship, attachCandidate("davit", "a", "davit:2:0"))).toEqual(
      fail("Needs a free boat-deck edge")
    );
    expect(canPlace(ship, attachCandidate("davit", "b", "davit:2:0"))).toEqual(
      OK
    );
  });

  it("hangs one lifeboat per davit and only from davits", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 0),
      gridPart("b", "deck-1x1", 1, 2, 0),
      attachPart("dv", "davit", "b", "davit:2:0"),
    ]);
    expect(
      canPlace(ship, attachCandidate("lifeboat-collapsible", "dv", "boat"))
    ).toEqual(OK);
    expect(
      canPlace(
        boatDeckShip(),
        attachCandidate("lifeboat-standard", "dv", "boat")
      )
    ).toEqual(fail("That spot is taken"));
    expect(
      canPlace(ship, attachCandidate("lifeboat-standard", HULL_ID, "mast-fore"))
    ).toEqual(fail("Needs a free davit"));
  });

  it("rejects an attach part given a grid anchor", () => {
    expect(canPlace(testShip(), gridCandidate("funnel", 0, 0, 0))).toEqual(
      fail("Needs a free funnel mount on a deck block")
    );
  });
});

describe("place", () => {
  it("appends a valid part without mutating the input", () => {
    const ship = testShip();
    const result = place(ship, gridPart("a", "deck-1x1", 0, 0, 0));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ship.parts).toHaveLength(1);
    expect(ship.parts).toHaveLength(0);
  });

  it("returns the rule's reason for an invalid part", () => {
    expect(place(testShip(), gridPart("a", "deck-1x1", 1, 0, 0))).toEqual(
      fail("Needs a deck beneath every cell")
    );
  });

  it("rejects duplicate ids", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 0, 0)]);
    expect(place(ship, gridPart("a", "deck-1x1", 0, 1, 0))).toEqual(
      fail("Duplicate part id")
    );
  });

  it("rejects the reserved hull id", () => {
    expect(place(testShip(), gridPart(HULL_ID, "deck-1x1", 0, 0, 0))).toEqual(
      fail("Reserved part id")
    );
  });
});

describe("cascade removal", () => {
  it("removes everything supported by or attached to a part", () => {
    const ship = testShip([
      ...boatDeckShip().parts,
      gridPart("other", "deck-1x1", 0, 10, 1),
    ]);
    expect(cascadeIds(ship, ["a"])).toEqual(["a", "b", "dv", "lb"]);
    expect(removeWithCascade(ship, "a").parts.map((p) => p.id)).toEqual([
      "other",
    ]);
  });

  it("removes a 2x1 block when either supporting cell goes", () => {
    const ship = testShip([
      gridPart("l", "deck-1x1", 0, 4, 1),
      gridPart("r", "deck-1x1", 0, 5, 1),
      gridPart("top", "deck-2x1", 1, 4, 1),
    ]);
    expect(cascadeIds(ship, ["r"])).toEqual(["r", "top"]);
  });

  it("removing the middle of a 3-level stack cascades upward only", () => {
    const ship = testShip([
      gridPart("bottom", "deck-1x1", 0, 2, 0),
      gridPart("middle", "deck-1x1", 1, 2, 0),
      gridPart("top", "deck-1x1", 2, 2, 0),
      attachPart("dv", "davit", "top", "davit:2:0"),
      attachPart("lb", "lifeboat-standard", "dv", "boat"),
    ]);
    expect(validateShip(ship)).toEqual(OK);
    expect(cascadeIds(ship, ["middle"])).toEqual(["middle", "top", "dv", "lb"]);
  });

  it("removing a leaf removes only the leaf", () => {
    expect(cascadeIds(boatDeckShip(), ["lb"])).toEqual(["lb"]);
  });

  it("removeParts drops exactly the given ids", () => {
    expect(removeParts(boatDeckShip(), ["lb", "dv"]).parts).toHaveLength(2);
  });
});

describe("hull length", () => {
  it("previews and removes parts beyond the new stern, with cascade", () => {
    const ship = testShip([
      gridPart("fwd", "deck-1x1", 0, 2, 1),
      gridPart("aft", "deck-1x1", 0, 20, 1),
      gridPart("aftTop", "deck-1x1", 1, 20, 1),
      gridPart("edge", "deck-2x1", 0, 11, 2), // covers x 11-12
      attachPart("mast", "mast-aft", HULL_ID, "mast-aft"),
    ]);
    expect(previewHullLength(ship, 4)).toEqual(["aft", "aftTop", "edge"]);
    const shrunk = setHullLength(ship, 4);
    expect(shrunk.hull.lengthSegments).toBe(4);
    expect(shrunk.parts.map((p) => p.id)).toEqual(["fwd", "mast"]);
  });

  it("drops a bridge that falls out of the forward half", () => {
    const fullBeam = [0, 1, 2, 3].map((z) =>
      gridPart(`l${z}`, "deck-1x1", 0, 10, z)
    );
    const ship = testShip(
      [...fullBeam, gridPart("br", "bridge", 1, 10, 0)],
      12
    );
    expect(validateShip(ship)).toEqual(OK);
    expect(previewHullLength(ship, 4)).toEqual(["br"]);
    const shrunk = setHullLength(ship, 4);
    expect(shrunk.parts.map((p) => p.id)).toEqual(["l0", "l1", "l2", "l3"]);
    expect(validateShip(shrunk)).toEqual(OK);
  });

  it("keeps a bridge that stays in the forward half", () => {
    const ship = testShip([gridPart("br", "bridge", 0, 2, 0)], 12);
    expect(validateShip(ship)).toEqual(OK);
    expect(previewHullLength(ship, 4)).toEqual([]);
    expect(setHullLength(ship, 4).parts.map((p) => p.id)).toEqual(["br"]);
  });

  it("growing keeps every part", () => {
    const ship = boatDeckShip();
    expect(previewHullLength(ship, 12)).toEqual([]);
    expect(setHullLength(ship, 12).parts).toHaveLength(4);
  });
});

describe("validateShip", () => {
  it("accepts a ship built through valid placements", () => {
    expect(validateShip(boatDeckShip())).toEqual(OK);
    expect(validateShip(emptyShip())).toEqual(OK);
  });

  it("rejects a hull outside 4-12 segments", () => {
    expect(validateShip(testShip([], 3)).ok).toBe(false);
    expect(validateShip(testShip([], 13)).ok).toBe(false);
  });

  it("rejects parts listed before their parent", () => {
    const [a, b, dv, lb] = boatDeckShip().parts;
    expect(validateShip(testShip([a, b, lb, dv])).ok).toBe(false);
  });

  it("rejects floating blocks and duplicate ids", () => {
    expect(
      validateShip(testShip([gridPart("a", "deck-1x1", 1, 0, 0)])).ok
    ).toBe(false);
    expect(
      validateShip(
        testShip([
          gridPart("a", "deck-1x1", 0, 0, 0),
          gridPart("a", "deck-1x1", 0, 1, 0),
        ])
      ).ok
    ).toBe(false);
  });
});
