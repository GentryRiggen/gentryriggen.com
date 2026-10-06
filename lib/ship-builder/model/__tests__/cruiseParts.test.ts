import { attachPointsOf, openAttachPoints } from "../attach";
import { getPartDef } from "../catalog";
import { canPlace, validateShip } from "../placement";
import { computeStats } from "../stats";
import { HULL_ID, type AttachPartDef, type PartType } from "../types";
import { attachPart, gridPart, testShip } from "../../testing";

const fail = (reason: string) => ({ ok: false, reason });

/** One edge block at level 0 on the starboard side, at x 4. */
const edgeBlock = () => gridPart("a", "deck-1x1", 0, 4, 0);

function candidate(type: PartType, parentId: string, pointId: string) {
  return {
    type,
    anchor: { kind: "attach" as const, parentId, pointId },
    rotation: 0 as const,
  };
}

describe("edge-mount", () => {
  it("exposes an edge point wherever a davit point is, with a shared claim", () => {
    const ship = testShip([edgeBlock()]);
    const points = attachPointsOf(ship, "a");
    const davit = points.find((p) => p.id === "davit:4:0");
    const edge = points.find((p) => p.id === "edge:4:0");
    expect(edge).toMatchObject({
      type: "edge-mount",
      position: davit?.position,
      side: "starboard",
      claims: ["edge:0:4:0"],
    });
    expect(davit?.claims).toEqual(["edge:0:4:0"]);
  });

  it("lets a raft canister sit on an edge point", () => {
    const ship = testShip([edgeBlock()]);
    expect(canPlace(ship, candidate("raft-canister", "a", "edge:4:0"))).toEqual(
      { ok: true }
    );
  });

  it("will not put a raft on an edge a davit holds, or the reverse", () => {
    const withDavit = testShip([
      edgeBlock(),
      attachPart("d", "davit", "a", "davit:4:0"),
    ]);
    expect(
      canPlace(withDavit, candidate("raft-canister", "a", "edge:4:0"))
    ).toEqual(fail("That spot is taken"));

    const withRaft = testShip([
      edgeBlock(),
      attachPart("r", "raft-canister", "a", "edge:4:0"),
    ]);
    expect(canPlace(withRaft, candidate("davit", "a", "davit:4:0"))).toEqual(
      fail("That spot is taken")
    );
  });

  it("offers neither a davit nor a raft a second spot on a taken edge", () => {
    const ship = testShip([
      edgeBlock(),
      attachPart("r", "raft-canister", "a", "edge:4:0"),
    ]);
    const open = (type: PartType) =>
      openAttachPoints(ship, getPartDef(type) as AttachPartDef).map(
        (o) => o.point.id
      );
    expect(open("davit")).not.toContain("davit:4:0");
    expect(open("raft-canister")).not.toContain("edge:4:0");
  });

  it("keeps edges on different levels and cells apart", () => {
    const ship = testShip([
      edgeBlock(),
      gridPart("b", "deck-1x1", 0, 5, 0),
      attachPart("d", "davit", "a", "davit:4:0"),
    ]);
    expect(canPlace(ship, candidate("raft-canister", "b", "edge:5:0"))).toEqual(
      { ok: true }
    );
  });

  it("blocks building over or outboard of a raft, as for a davit", () => {
    const ship = testShip([
      edgeBlock(),
      attachPart("r", "raft-canister", "a", "edge:4:0"),
    ]);
    expect(canPlace(ship, gridPart("x", "deck-1x1", 1, 4, 0))).toEqual(
      fail("Can't build over a davit, raft, cannon or plank")
    );
    expect(canPlace(ship, gridPart("y", "deck-1x1", 0, 4, -1))).toEqual(
      fail("Can't build outboard of a davit or raft")
    );
  });

  it("counts a raft's seats as lifeboat seats", () => {
    const ship = testShip([
      edgeBlock(),
      attachPart("r", "raft-canister", "a", "edge:4:0"),
    ]);
    const stats = computeStats(ship);
    expect(stats.lifeboats).toBe(1);
    expect(stats.lifeboatSeats).toBe(25);
  });

  it("still validates a saved ship with davits and boats", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 4, 0),
      gridPart("b", "deck-1x1", 0, 5, 0),
      attachPart("d1", "davit", "a", "davit:4:0"),
      attachPart("d2", "davit", "b", "davit:5:0"),
      attachPart("big", "lifeboat-large", "d1", "big-boat"),
    ]);
    expect(validateShip(ship)).toEqual({ ok: true });
  });
});

describe("pool", () => {
  it("is a 2×2 amenity", () => {
    const def = getPartDef("pool");
    expect(def).toMatchObject({
      placement: "grid",
      role: "amenity",
      footprint: { x: 2, z: 2 },
    });
  });

  it("sits on the main deck over the hull", () => {
    const ship = testShip();
    expect(canPlace(ship, gridPart("p", "pool", 0, 4, 1))).toEqual({
      ok: true,
    });
  });

  it("sits on top of deck blocks", () => {
    const ship = testShip([
      gridPart("a", "deck-2x1", 0, 4, 1),
      gridPart("b", "deck-2x1", 0, 4, 2),
    ]);
    expect(canPlace(ship, gridPart("p", "pool", 1, 4, 1))).toEqual({
      ok: true,
    });
  });

  it("needs support like any block", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 4, 1)]);
    expect(canPlace(ship, gridPart("p", "pool", 1, 4, -2)).ok).toBe(false);
    expect(canPlace(ship, gridPart("w", "pool", 0, 4, -2)).ok).toBe(false);
  });

  it("exposes no attach points", () => {
    const ship = testShip([gridPart("p", "pool", 0, 4, 1)]);
    expect(attachPointsOf(ship, "p")).toEqual([]);
  });

  it("lets nothing build on top of it", () => {
    const ship = testShip([gridPart("p", "pool", 0, 4, 1)]);
    expect(canPlace(ship, gridPart("x", "deck-1x1", 1, 4, 1))).toEqual(
      fail("Can't build on top of a pool")
    );
    expect(canPlace(ship, gridPart("y", "pool", 1, 4, 1))).toEqual(
      fail("Can't build on top of a pool")
    );
  });

  it("is not a place for a funnel or davit", () => {
    const ship = testShip([gridPart("p", "pool", 0, 4, 0)]);
    expect(
      openAttachPoints(ship, getPartDef("funnel") as AttachPartDef)
    ).toEqual([]);
    expect(
      openAttachPoints(ship, getPartDef("davit") as AttachPartDef)
    ).toEqual([]);
  });
});

describe("block-top amenities", () => {
  it.each(["waterslide", "climbing-wall"] as const)(
    "puts a %s on a clear deck block and claims its top",
    (type) => {
      const ship = testShip([
        gridPart("a", "deck-1x1", 0, 4, 1),
        attachPart("s", type, "a", "funnel"),
      ]);
      expect(validateShip(ship)).toEqual({ ok: true });
      expect(canPlace(ship, candidate("funnel", "a", "funnel"))).toEqual(
        fail("That spot is taken")
      );
      expect(canPlace(ship, gridPart("x", "deck-1x1", 1, 4, 1))).toEqual(
        fail("Can't build over a funnel or mast")
      );
    }
  );
});

describe("funnel-modern", () => {
  it("gives a strong diesel power of 4 and no stokers", () => {
    const def = getPartDef("funnel-modern");
    expect(def.power).toBe(4);
    expect(def.stokers).toBeUndefined();
  });

  it("counts as a funnel for crew, speed and warnings", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 4, 1),
      attachPart("f", "funnel-modern", "a", "funnel"),
      attachPart("p", "propeller", HULL_ID, "prop:0"),
    ]);
    const stats = computeStats(ship);
    expect(stats.crew).toBe(8 * 60);
    expect(stats.topSpeedKnots).toBeGreaterThan(0);
    expect(stats.warnings.map((w) => w.code)).not.toContain("no-funnels");
  });
});

describe("azipod", () => {
  const withFunnel = [
    gridPart("a", "deck-1x1", 0, 4, 1),
    attachPart("f", "funnel-modern", "a", "funnel"),
  ];

  it("drives the ship like a propeller", () => {
    const ship = testShip([
      ...withFunnel,
      attachPart("z", "azipod", HULL_ID, "prop:0"),
    ]);
    const stats = computeStats(ship);
    expect(stats.topSpeedKnots).toBeGreaterThan(0);
    expect(stats.warnings.map((w) => w.code)).not.toContain("no-propellers");
  });

  it("also counts as a rudder, so no rudder warning", () => {
    const codes = (parts: ReturnType<typeof attachPart>[]) =>
      computeStats(testShip([...withFunnel, ...parts])).warnings.map(
        (w) => w.code
      );
    expect(codes([attachPart("p", "propeller", HULL_ID, "prop:0")])).toContain(
      "no-rudder"
    );
    expect(codes([attachPart("z", "azipod", HULL_ID, "prop:0")])).not.toContain(
      "no-rudder"
    );
  });

  it("takes a propeller spot", () => {
    const ship = testShip([attachPart("z", "azipod", HULL_ID, "prop:0")]);
    expect(
      canPlace(testShip(), candidate("azipod", HULL_ID, "prop:0"))
    ).toEqual({ ok: true });
    expect(canPlace(ship, candidate("propeller", HULL_ID, "prop:0"))).toEqual(
      fail("That spot is taken")
    );
  });
});

describe("cruise cabin and boat", () => {
  it("gives balcony cabins 40 second-class passengers each", () => {
    const ship = testShip([gridPart("c", "cabin-balcony", 0, 4, 1)]);
    expect(computeStats(ship).passengers).toMatchObject({
      second: 40,
      total: 40,
    });
  });

  it("seats 150 in an enclosed lifeboat on a davit", () => {
    const ship = testShip([
      edgeBlock(),
      attachPart("d", "davit", "a", "davit:4:0"),
      attachPart("e", "lifeboat-enclosed", "d", "boat"),
    ]);
    expect(validateShip(ship)).toEqual({ ok: true });
    expect(computeStats(ship).lifeboatSeats).toBe(150);
  });
});
