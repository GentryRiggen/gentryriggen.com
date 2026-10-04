import {
  canPlace,
  cascadeIds,
  clampName,
  emptyShip,
  MAX_NAME_LENGTH,
  place,
  previewHullLength,
  previewHullSize,
  removeParts,
  setHullLength,
  setHullSize,
  validateShip,
  type PartCandidate,
} from "../placement";
import { getPartDef } from "../catalog";
import { WING_REACH } from "../grid";
import { HULL_ID, type PartType, type Rotation } from "../types";
import { parseShip } from "../../persist/schema";
import {
  attachPart,
  gridPart,
  hasLoneSurrogate,
  testShip,
} from "../../testing";

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
    expect(canPlace(ship, gridCandidate("deck-1x1", 0, 0, 6))).toEqual(
      fail("Outside the hull")
    );
    expect(canPlace(ship, gridCandidate("deck-1x1", 0, 0, -3))).toEqual(
      fail("Outside the hull")
    );
    expect(canPlace(ship, gridCandidate("deck-1x1", 4, 0, 0))).toEqual(
      fail("Outside the hull")
    );
    expect(canPlace(ship, gridCandidate("deck-2x1", 0, 23, 0))).toEqual(
      fail("Outside the hull")
    );
    expect(canPlace(ship, gridCandidate("deck-2x1", 0, 0, 5, 90))).toEqual(
      fail("Outside the hull")
    );
  });

  it("rejects overlapping parts (rule 2)", () => {
    const ship = testShip([gridPart("a", "deck-2x1", 0, 4, 1)]);
    expect(canPlace(ship, gridCandidate("cabin-3rd", 0, 5, 1))).toEqual(
      fail("That space is taken")
    );
  });

  it("needs something below or beside a block above level 0", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 4, 1)]);
    expect(canPlace(ship, gridCandidate("deck-1x1", 1, 4, 1))).toEqual(OK);
    expect(canPlace(ship, gridCandidate("deck-1x1", 1, 6, 1))).toEqual(
      fail("Needs a deck beneath every cell")
    );
    // v1.1: one cell over a block is enough; the other overhangs by one.
    expect(canPlace(ship, gridCandidate("deck-2x1", 1, 4, 1))).toEqual(OK);
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

describe("canPlace — side support", () => {
  const TOO_FAR = fail("Too far from a support (max 2 cells)");
  const NEEDS_DECK = fail("Needs a deck beneath every cell");

  /** Level-1 block on a level-0 block at (x 4, z 1). */
  const pillar = [
    gridPart("p0", "deck-1x1", 0, 4, 1),
    gridPart("p1", "deck-1x1", 1, 4, 1),
  ];

  it("lets a level-0 wing block hang off a hull block", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 5, 0)]);
    expect(canPlace(ship, gridCandidate("deck-1x1", 0, 5, -1))).toEqual(OK);
    const wider = testShip([
      ...ship.parts,
      gridPart("w1", "deck-1x1", 0, 5, -1),
    ]);
    expect(canPlace(wider, gridCandidate("deck-1x1", 0, 5, -2))).toEqual(OK);
  });

  it("needs a neighbour for a level-0 wing block", () => {
    expect(canPlace(testShip(), gridCandidate("deck-1x1", 0, 5, -1))).toEqual(
      NEEDS_DECK
    );
    const port = testShip([gridPart("a", "deck-1x1", 0, 5, 3)]);
    expect(canPlace(port, gridCandidate("deck-1x1", 0, 5, 4))).toEqual(OK);
    expect(canPlace(port, gridCandidate("deck-1x1", 0, 5, 5))).toEqual(
      NEEDS_DECK
    );
  });

  it("rejects a level-0 wing block three cells out as out of bounds", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 5, 0),
      gridPart("w1", "deck-1x1", 0, 5, -1),
      gridPart("w2", "deck-1x1", 0, 5, -2),
    ]);
    expect(validateShip(ship)).toEqual(OK);
    expect(canPlace(ship, gridCandidate("deck-1x1", 0, 5, -3))).toEqual(
      fail("Outside the hull")
    );
  });

  it("cantilevers up to two cells from a supported block", () => {
    let ship = testShip(pillar);
    for (const x of [5, 6]) {
      expect(canPlace(ship, gridCandidate("deck-1x1", 1, x, 1))).toEqual(OK);
      ship = testShip([...ship.parts, gridPart(`c${x}`, "deck-1x1", 1, x, 1)]);
    }
    expect(canPlace(ship, gridCandidate("deck-1x1", 1, 7, 1))).toEqual(TOO_FAR);
    // A 2x1 whose far cell would be three out fails the same way.
    expect(
      canPlace(
        testShip([...pillar, ship.parts[2]]),
        gridCandidate("deck-2x1", 1, 6, 1)
      )
    ).toEqual(TOO_FAR);
  });

  it("bridges four cells between two pillars", () => {
    const pillars = [
      gridPart("l0", "deck-1x1", 0, 2, 1),
      gridPart("l1", "deck-1x1", 1, 2, 1),
      gridPart("r0", "deck-1x1", 0, 7, 1),
      gridPart("r1", "deck-1x1", 1, 7, 1),
    ];
    const span = [3, 4, 6, 5].map((x) =>
      gridPart(`s${x}`, "deck-1x1", 1, x, 1)
    );
    expect(validateShip(testShip([...pillars, ...span]))).toEqual(OK);
    // x 5 is three cells from the left pillar until x 6 links it to the right.
    const early = testShip([...pillars, span[0], span[1]]);
    expect(canPlace(early, gridCandidate("deck-1x1", 1, 5, 1))).toEqual(
      TOO_FAR
    );
  });

  it("places a 1x4 bridge on a 3-wide ship with its 4th cell in a wing", () => {
    const ship = testShip([], 8, 3);
    expect(canPlace(ship, gridCandidate("bridge", 0, 1, 0))).toEqual(OK);
    const raised = testShip(
      [0, 1, 2].map((z) => gridPart(`b${z}`, "deck-1x1", 0, 1, z)),
      8,
      3
    );
    expect(canPlace(raised, gridCandidate("bridge", 1, 1, 0))).toEqual(OK);
  });

  it.each([
    ["bridge-3", 3],
    ["bridge", 4],
    ["bridge-5", 5],
    ["bridge-6", 6],
    ["bridge-7", 7],
  ] as const)("places %s (%i wide) on a wide hull", (type, width) => {
    expect(getPartDef(type)).toMatchObject({
      role: "bridge",
      footprint: { x: 1, z: width },
    });
    const ship = testShip([], 8, 7);
    expect(canPlace(ship, gridCandidate(type, 0, 1, 0))).toEqual(OK);
  });

  it("fits a 7-wide bridge on a 3-wide hull using both wings", () => {
    const ship = testShip([], 8, 3);
    expect(
      canPlace(ship, gridCandidate("bridge-7", 0, 1, -WING_REACH))
    ).toEqual(OK);
    expect(
      canPlace(ship, gridCandidate("bridge-7", 0, 1, -WING_REACH - 1))
    ).not.toEqual(OK);
    expect(canPlace(ship, gridCandidate("bridge-7", 0, 1, 0))).not.toEqual(OK);
  });

  it("applies the bridge rules to every bridge size", () => {
    const forward = testShip([], 8, 7);
    expect(canPlace(forward, gridCandidate("bridge-6", 0, 12, 0))).toEqual(
      fail("The bridge must be in the forward half")
    );
    const withBridge = testShip([gridPart("br", "bridge-5", 0, 1, 0)], 8, 7);
    expect(canPlace(withBridge, gridCandidate("deck-1x1", 1, 1, 2))).toEqual(
      fail("Can't build on top of the bridge")
    );
  });

  it("still validates an old ship saved with the 4-wide bridge", () => {
    const old = testShip([gridPart("br", "bridge", 0, 1, 0)], 8, 4);
    expect(validateShip(old)).toEqual(OK);
  });

  it("refuses to build outboard of a davit in the same row", () => {
    const BLOCKED = fail("Can't build outboard of a davit");
    const ship = testShip([
      ...boatDeckShip().parts,
      gridPart("w0", "deck-1x1", 0, 2, -1),
    ]);
    expect(validateShip(ship)).toEqual(OK);
    expect(canPlace(ship, gridCandidate("deck-1x1", 1, 2, -1))).toEqual(
      BLOCKED
    );
    // Without the davit the same wing block is fine.
    const bare = removeParts(ship, ["lb", "dv"]);
    expect(canPlace(bare, gridCandidate("deck-1x1", 1, 2, -1))).toEqual(OK);

    const port = testShip([
      gridPart("a", "deck-1x1", 0, 2, 3),
      gridPart("b", "deck-1x1", 1, 2, 3),
      gridPart("w", "deck-1x1", 0, 2, 4),
      attachPart("dv", "davit", "b", "davit:2:3"),
    ]);
    expect(validateShip(port)).toEqual(OK);
    expect(canPlace(port, gridCandidate("deck-1x1", 1, 2, 4))).toEqual(BLOCKED);
    // Inboard of the davit, or on another level or row, is fine.
    expect(canPlace(port, gridCandidate("deck-1x1", 1, 2, 2))).toEqual(OK);
    expect(canPlace(port, gridCandidate("deck-1x1", 0, 2, 5))).toEqual(OK);
  });

  it("keeps the rule-6 checks on cells that have a part below", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 4, 1),
      gridPart("b", "deck-1x1", 0, 5, 1),
      gridPart("c", "deck-1x1", 1, 4, 1),
      attachPart("f", "funnel", "b", "funnel"),
    ]);
    expect(canPlace(ship, gridCandidate("deck-1x1", 1, 5, 1))).toEqual(
      fail("Can't build over a funnel")
    );
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

  it("puts davits on uncovered outer-edge blocks at any level", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 0),
      gridPart("b", "deck-1x1", 1, 2, 0),
      gridPart("c", "deck-1x1", 0, 5, 0),
      gridPart("i", "deck-1x1", 0, 5, 1),
    ]);
    // Covered by "b": no point.
    expect(canPlace(ship, attachCandidate("davit", "a", "davit:2:0"))).toEqual(
      fail("Needs a free boat-deck edge")
    );
    expect(canPlace(ship, attachCandidate("davit", "b", "davit:2:0"))).toEqual(
      OK
    );
    // A lone block on the main deck takes a davit too.
    expect(canPlace(ship, attachCandidate("davit", "c", "davit:5:0"))).toEqual(
      OK
    );
    // Interior blocks still do not.
    expect(canPlace(ship, attachCandidate("davit", "i", "davit:5:1"))).toEqual(
      fail("Needs a free boat-deck edge")
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

describe("clampName", () => {
  it("leaves short names alone", () => {
    expect(clampName("Olympic")).toBe("Olympic");
  });

  it("clamps to MAX_NAME_LENGTH", () => {
    expect(clampName("x".repeat(80))).toBe("x".repeat(MAX_NAME_LENGTH));
  });

  it("drops an emoji that would be split at the limit", () => {
    const clamped = clampName("a".repeat(59) + "😀");
    expect(hasLoneSurrogate(clamped)).toBe(false);
    expect(clamped).toBe("a".repeat(59));
  });

  it("keeps all-emoji names within the schema's UTF-16 limit", () => {
    const clamped = clampName("😀".repeat(60));
    expect(hasLoneSurrogate(clamped)).toBe(false);
    expect(clamped.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
    expect(clamped).toBe("😀".repeat(MAX_NAME_LENGTH / 2));
    expect(parseShip({ ...testShip(), name: clamped }).ok).toBe(true);
  });
});

describe("cascade removal", () => {
  it("removes everything supported by or attached to a part", () => {
    const ship = testShip([
      ...boatDeckShip().parts,
      gridPart("other", "deck-1x1", 0, 10, 1),
    ]);
    expect(cascadeIds(ship, ["a"])).toEqual(["a", "b", "dv", "lb"]);
    const removed = removeParts(ship, cascadeIds(ship, ["a"]));
    expect(removed.parts.map((p) => p.id)).toEqual(["other"]);
  });

  it("keeps a 2x1 block while either supporting cell remains", () => {
    const ship = testShip([
      gridPart("l", "deck-1x1", 0, 4, 1),
      gridPart("r", "deck-1x1", 0, 5, 1),
      gridPart("top", "deck-2x1", 1, 4, 1),
    ]);
    // v1.1: the other cell still holds it up as a one-cell overhang.
    expect(cascadeIds(ship, ["r"])).toEqual(["r"]);
    expect(cascadeIds(ship, ["l", "r"])).toEqual(["l", "r", "top"]);
  });

  it("drops the far end of a bridge when one pillar goes", () => {
    const ship = testShip([
      gridPart("l0", "deck-1x1", 0, 2, 1),
      gridPart("l1", "deck-1x1", 1, 2, 1),
      gridPart("r0", "deck-1x1", 0, 7, 1),
      gridPart("r1", "deck-1x1", 1, 7, 1),
      ...[3, 4, 6, 5].map((x) => gridPart(`s${x}`, "deck-1x1", 1, x, 1)),
    ]);
    expect(validateShip(ship)).toEqual(OK);
    // l1 loses its deck and is now 5 from r1; s3 and s4 are 4 and 3 away.
    expect(cascadeIds(ship, ["l0"])).toEqual(["l0", "l1", "s3", "s4"]);
  });

  it("brings down a wing when its anchor block goes", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 5, 0),
      gridPart("w1", "deck-1x1", 0, 5, -1),
      gridPart("w2", "deck-1x1", 0, 5, -2),
      gridPart("other", "deck-1x1", 0, 9, 0),
    ]);
    expect(cascadeIds(ship, ["a"])).toEqual(["a", "w1", "w2"]);
  });

  it("keeps a block held up by a later neighbour, in a buildable order", () => {
    // p hangs off q; r, placed after p, also holds p up.
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 0),
      gridPart("c", "deck-1x1", 0, 4, 0),
      gridPart("q", "deck-1x1", 1, 2, 0),
      gridPart("p", "deck-1x1", 1, 3, 0),
      gridPart("r", "deck-1x1", 1, 4, 0),
    ]);
    expect(validateShip(ship)).toEqual(OK);
    expect(cascadeIds(ship, ["q"])).toEqual(["q"]);
    const after = removeParts(ship, ["q"]);
    expect(after.parts.map((part) => part.id).sort()).toEqual([
      "a",
      "c",
      "p",
      "r",
    ]);
    expect(validateShip(after)).toEqual(OK);
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

describe("hull size", () => {
  it("narrows the beam from the port side, dropping what falls off", () => {
    const ship = testShip(
      [
        gridPart("stbd", "deck-1x1", 0, 2, 0),
        gridPart("p4", "deck-1x1", 0, 2, 4),
        gridPart("p5", "deck-1x1", 0, 2, 5),
        gridPart("p6", "deck-1x1", 0, 2, 6),
        gridPart("lone", "deck-1x1", 0, 4, 4),
      ],
      8,
      5
    );
    expect(validateShip(ship)).toEqual(OK);
    // Beam 3: z 5+ is out of bounds; z 4 is a wing cell with nothing inboard.
    expect(previewHullSize(ship, { beam: 3 })).toEqual([
      "p4",
      "p5",
      "p6",
      "lone",
    ]);
    const narrowed = setHullSize(ship, { beam: 3 });
    expect(narrowed.hull).toEqual({ lengthSegments: 8, beam: 3 });
    expect(narrowed.parts.map((p) => p.id)).toEqual(["stbd"]);
    expect(validateShip(narrowed)).toEqual(OK);
  });

  it("keeps a block that becomes a supported wing cell", () => {
    const ship = testShip(
      [
        gridPart("a", "deck-1x1", 0, 2, 2),
        gridPart("b", "deck-1x1", 0, 2, 3),
        gridPart("c", "deck-1x1", 0, 2, 4),
      ],
      8,
      5
    );
    expect(previewHullSize(ship, { beam: 3 })).toEqual([]);
    expect(validateShip(setHullSize(ship, { beam: 3 }))).toEqual(OK);
  });

  it("widening drops a davit left inside the hull, with its boat", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 3),
      gridPart("b", "deck-1x1", 1, 2, 3),
      attachPart("dv", "davit", "b", "davit:2:3"),
      attachPart("lb", "lifeboat-standard", "dv", "boat"),
    ]);
    expect(validateShip(ship)).toEqual(OK);
    expect(previewHullSize(ship, { beam: 5 })).toEqual(["dv", "lb"]);
    expect(setHullSize(ship, { beam: 5 }).parts.map((p) => p.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("keeps the masts when their centerline moves", () => {
    const ship = testShip([attachPart("m", "mast-fore", HULL_ID, "mast-fore")]);
    expect(setHullSize(ship, { beam: 7 }).parts).toHaveLength(1);
  });

  it("changes length and beam together", () => {
    const ship = testShip([gridPart("aft", "deck-1x1", 0, 20, 0)]);
    const resized = setHullSize(ship, { lengthSegments: 6, beam: 6 });
    expect(resized.hull).toEqual({ lengthSegments: 6, beam: 6 });
    expect(resized.parts).toEqual([]);
    expect(setHullSize(ship, {}).hull).toEqual(ship.hull);
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

/**
 * 866 parts: four full levels of 1x1 decks on a 12-segment hull, a funnel on
 * every top block, a davit and boat on every top edge cell, and both masts.
 */
function largestShip() {
  const parts = [];
  for (let level = 0; level <= 3; level++) {
    for (let x = 0; x < 36; x++) {
      for (let z = 0; z < 4; z++) {
        parts.push(gridPart(`d${level}:${x}:${z}`, "deck-1x1", level, x, z));
      }
    }
  }
  for (let x = 0; x < 36; x++) {
    for (let z = 0; z < 4; z++) {
      parts.push(attachPart(`f${x}:${z}`, "funnel", `d3:${x}:${z}`, "funnel"));
    }
    for (const z of [0, 3]) {
      const davit = `dv${x}:${z}`;
      parts.push(attachPart(davit, "davit", `d3:${x}:${z}`, `davit:${x}:${z}`));
      parts.push(attachPart(`lb${x}:${z}`, "lifeboat-standard", davit, "boat"));
    }
  }
  parts.push(attachPart("mf", "mast-fore", HULL_ID, "mast-fore"));
  parts.push(attachPart("ma", "mast-aft", HULL_ID, "mast-aft"));
  return testShip(parts, 12);
}

describe("performance on the largest ship", () => {
  // Generous bounds so a loaded CI box doesn't flake; locally these run in
  // about 5 ms and 10 ms.
  it("validates in well under 100 ms", () => {
    const ship = largestShip();
    expect(ship.parts).toHaveLength(866);
    expect(validateShip(ship)).toEqual(OK);
    const start = performance.now();
    validateShip(ship);
    expect(performance.now() - start).toBeLessThan(100);
  });

  it("cascades a bottom-corner removal in well under 100 ms", () => {
    const ship = largestShip();
    const start = performance.now();
    const ids = cascadeIds(ship, ["d0:0:0"]);
    expect(performance.now() - start).toBeLessThan(100);
    expect(ids).toEqual(["d0:0:0"]);
  });
});

describe("validateShip", () => {
  it("accepts a ship built through valid placements", () => {
    expect(validateShip(boatDeckShip())).toEqual(OK);
    expect(validateShip(emptyShip())).toEqual(OK);
  });

  it("starts an empty ship 4 cells wide", () => {
    expect(emptyShip().hull).toEqual({ lengthSegments: 8, beam: 4 });
    expect(emptyShip().v).toBe(2);
  });

  it("rejects a beam outside 3-7 cells or not a whole number", () => {
    expect(validateShip(testShip([], 8, 3))).toEqual(OK);
    expect(validateShip(testShip([], 8, 7))).toEqual(OK);
    for (const beam of [2, 8, 4.5]) {
      expect(validateShip(testShip([], 8, beam))).toEqual(
        fail("Beam out of range")
      );
    }
  });

  it("rejects a hull outside 4-20 segments", () => {
    expect(validateShip(testShip([], 3)).ok).toBe(false);
    expect(validateShip(testShip([], 21)).ok).toBe(false);
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

  it("rejects a rotated attach part", () => {
    const mast = {
      ...attachPart("m", "mast-fore", HULL_ID, "mast-fore"),
      rotation: 270 as const,
    };
    expect(validateShip(testShip([mast]))).toEqual(
      fail("Part m: Attach parts can't be rotated")
    );
  });
});
