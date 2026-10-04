import {
  attachPointsOf,
  isPointTaken,
  openAttachPoints,
  resolveAttachPoint,
} from "../attach";
import { getPartDef } from "../catalog";
import { HULL_ID, type AttachPartDef } from "../types";
import { validateShip } from "../placement";
import { attachPart, gridPart, testShip } from "../../testing";

/** Rotation-90 deck-2x1 at (level 1, x 4, z 2), covering z 2-3. */
function portRotatedShip() {
  return testShip([
    gridPart("s2", "deck-1x1", 0, 4, 2),
    gridPart("s3", "deck-1x1", 0, 4, 3),
    gridPart("top", "deck-2x1", 1, 4, 2, 90),
  ]);
}

describe("attach points", () => {
  it("gives the hull fore and aft mast mounts that track the stern", () => {
    const short = attachPointsOf(testShip([], 4), HULL_ID);
    expect(short.map((p) => p.id)).toEqual(["mast-fore", "mast-aft"]);
    expect(short[0].position).toEqual({ x: -1, y: 0, z: 2 });
    expect(short[1].position).toEqual({ x: 12.75, y: 0, z: 2 });
    const long = attachPointsOf(testShip([], 8), HULL_ID);
    expect(long[1].position.x).toBe(24.75);
  });

  it("centres the mast mounts on the beam", () => {
    const points = attachPointsOf(testShip([], 4, 5), HULL_ID);
    expect(points.map((p) => p.position.z)).toEqual([2.5, 2.5]);
  });

  it("gives an uncovered deck block a centered funnel mount", () => {
    const ship = testShip([gridPart("a", "deck-2x1", 0, 4, 1)]);
    expect(attachPointsOf(ship, "a")).toEqual([
      {
        id: "funnel",
        type: "funnel-mount",
        position: { x: 5, y: 1, z: 1.5 },
      },
    ]);
  });

  it("removes the funnel mount when something sits on the block", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 4, 1),
      gridPart("b", "deck-1x1", 1, 4, 1),
    ]);
    expect(attachPointsOf(ship, "a")).toEqual([]);
  });

  it("does not give cabins a funnel mount", () => {
    const ship = testShip([gridPart("c", "cabin-1st", 0, 4, 1)]);
    expect(attachPointsOf(ship, "c")).toEqual([]);
  });

  it("puts davit points on outboard edges at level 1 and up", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 0),
      gridPart("b", "deck-1x1", 1, 2, 0),
      gridPart("c", "deck-1x1", 0, 2, 3),
      gridPart("d", "cabin-2nd", 1, 2, 3),
    ]);
    expect(attachPointsOf(ship, "a").map((p) => p.type)).not.toContain(
      "davit-point"
    );
    const starboard = attachPointsOf(ship, "b").find(
      (p) => p.type === "davit-point"
    );
    expect(starboard).toEqual({
      id: "davit:2:0",
      type: "davit-point",
      position: { x: 2.5, y: 2, z: 0 },
      side: "starboard",
    });
    const port = attachPointsOf(ship, "d")[0];
    expect(port).toMatchObject({ id: "davit:2:3", side: "port" });
    expect(port.position.z).toBe(4);
  });

  it("does not put davit points on interior cells, covered cells, or bridges", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 1),
      gridPart("b", "deck-1x1", 1, 2, 1),
      gridPart("c", "deck-1x1", 0, 3, 0),
      gridPart("d", "deck-1x1", 1, 3, 0),
      gridPart("e", "deck-1x1", 2, 3, 0),
    ]);
    expect(
      attachPointsOf(ship, "b").filter((p) => p.type === "davit-point")
    ).toEqual([]);
    expect(
      attachPointsOf(ship, "d").filter((p) => p.type === "davit-point")
    ).toEqual([]);
    expect(attachPointsOf(ship, "e").map((p) => p.id)).toContain("davit:3:0");

    const bridgeShip = testShip([
      gridPart("l0", "deck-1x1", 0, 1, 0),
      gridPart("l1", "deck-1x1", 0, 1, 1),
      gridPart("l2", "deck-1x1", 0, 1, 2),
      gridPart("l3", "deck-1x1", 0, 1, 3),
      gridPart("br", "bridge", 1, 1, 0),
    ]);
    expect(attachPointsOf(bridgeShip, "br")).toEqual([]);
  });

  it("gives a davit one boat mount hanging outboard", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 0),
      gridPart("b", "deck-1x1", 1, 2, 0),
      attachPart("dv", "davit", "b", "davit:2:0"),
    ]);
    const [mount] = attachPointsOf(ship, "dv");
    expect(mount.id).toBe("boat");
    expect(mount.type).toBe("boat-mount");
    expect(mount.side).toBe("starboard");
    expect(mount.position.x).toBeCloseTo(2.5);
    expect(mount.position.y).toBeCloseTo(2.8);
    expect(mount.position.z).toBeCloseTo(-0.6);
  });

  it("places a rotated 2x1's funnel mount and starboard davit point", () => {
    const ship = testShip([
      gridPart("s0", "deck-1x1", 0, 4, 0),
      gridPart("s1", "deck-1x1", 0, 4, 1),
      gridPart("top", "deck-2x1", 1, 4, 0, 90), // covers z 0-1 at x 4
    ]);
    expect(validateShip(ship)).toEqual({ ok: true });
    const points = attachPointsOf(ship, "top");
    expect(points.find((p) => p.type === "funnel-mount")).toEqual({
      id: "funnel",
      type: "funnel-mount",
      position: { x: 4.5, y: 2, z: 1 },
    });
    const davits = points.filter((p) => p.type === "davit-point");
    expect(davits).toEqual([
      expect.objectContaining({ id: "davit:4:0", side: "starboard" }),
    ]);
  });

  it("gives a rotated 2x1 on the port edge one port davit point", () => {
    const ship = portRotatedShip();
    expect(validateShip(ship)).toEqual({ ok: true });
    const davits = attachPointsOf(ship, "top").filter(
      (p) => p.type === "davit-point"
    );
    expect(davits).toEqual([
      expect.objectContaining({ id: "davit:4:3", side: "port" }),
    ]);
  });

  it("hangs a port davit's boat mount outboard of the port edge", () => {
    const ship = testShip([
      ...portRotatedShip().parts,
      attachPart("dv", "davit", "top", "davit:4:3"),
    ]);
    expect(validateShip(ship)).toEqual({ ok: true });
    const [mount] = attachPointsOf(ship, "dv");
    expect(mount.side).toBe("port");
    expect(mount.position.z).toBeCloseTo(4.6);
  });

  describe("davits on wings and other beams", () => {
    /** Two-level stacks at x 5 across the given z columns, ids "b<z>" on top. */
    function rowShip(zs: number[], beam = 4) {
      return testShip(
        [
          ...zs.map((z) => gridPart(`a${z}`, "deck-1x1", 0, 5, z)),
          ...zs.map((z) => gridPart(`b${z}`, "deck-1x1", 1, 5, z)),
        ],
        8,
        beam
      );
    }
    const davitsOf = (ship: ReturnType<typeof rowShip>, id: string) =>
      attachPointsOf(ship, id).filter((p) => p.type === "davit-point");

    it("puts a starboard davit on a wing block two cells out", () => {
      const ship = rowShip([0, -1, -2]);
      expect(validateShip(ship)).toEqual({ ok: true });
      expect(davitsOf(ship, "b-2")).toEqual([
        {
          id: "davit:5:-2",
          type: "davit-point",
          position: { x: 5.5, y: 2, z: -2 },
          side: "starboard",
        },
      ]);
      const withBoat = testShip([
        ...ship.parts,
        attachPart("dv", "davit", "b-2", "davit:5:-2"),
      ]);
      expect(validateShip(withBoat)).toEqual({ ok: true });
      const [mount] = attachPointsOf(withBoat, "dv");
      expect(mount.position.z).toBeCloseTo(-2.6);
    });

    it("puts a port davit on a wing block at beam + 1", () => {
      const ship = rowShip([3, 4, 5]);
      expect(validateShip(ship)).toEqual({ ok: true });
      expect(davitsOf(ship, "b5")).toEqual([
        {
          id: "davit:5:5",
          type: "davit-point",
          position: { x: 5.5, y: 2, z: 6 },
          side: "port",
        },
      ]);
    });

    it("moves the davit off an inner cell once a wing block is outboard", () => {
      const ship = rowShip([0, -1]);
      expect(davitsOf(ship, "b0")).toEqual([]);
      expect(davitsOf(ship, "b-1").map((p) => p.id)).toEqual(["davit:5:-1"]);
    });

    it("uses the port edge of the ship's own beam", () => {
      expect(davitsOf(rowShip([2], 3), "b2")).toEqual([
        expect.objectContaining({ id: "davit:5:2", side: "port" }),
      ]);
      expect(davitsOf(rowShip([3], 6), "b3")).toEqual([]);
      expect(davitsOf(rowShip([5], 6), "b5")).toEqual([
        expect.objectContaining({ position: { x: 5.5, y: 2, z: 6 } }),
      ]);
    });

    it("gives the middle of a 3-wide row no davit", () => {
      expect(davitsOf(rowShip([1], 3), "b1")).toEqual([]);
    });
  });

  it("returns nothing for unknown parents", () => {
    expect(attachPointsOf(testShip(), "missing")).toEqual([]);
  });

  it("resolves anchors and reports taken points", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 1),
      attachPart("f", "funnel", "a", "funnel"),
    ]);
    expect(
      resolveAttachPoint(ship, {
        kind: "attach",
        parentId: "a",
        pointId: "funnel",
      })?.type
    ).toBe("funnel-mount");
    expect(isPointTaken(ship, "a", "funnel")).toBe(true);
    expect(isPointTaken(ship, HULL_ID, "mast-fore")).toBe(false);
  });

  it("lists open points of the right type, honoring allowedPointIds", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 1),
      gridPart("b", "deck-1x1", 0, 3, 1),
      attachPart("f", "funnel", "a", "funnel"),
      attachPart("m", "mast-fore", HULL_ID, "mast-fore"),
    ]);
    const funnelDef = getPartDef("funnel") as AttachPartDef;
    expect(openAttachPoints(ship, funnelDef)).toEqual([
      { parentId: "b", point: expect.objectContaining({ id: "funnel" }) },
    ]);
    const foreDef = getPartDef("mast-fore") as AttachPartDef;
    expect(openAttachPoints(ship, foreDef)).toEqual([]);
    const aftDef = getPartDef("mast-aft") as AttachPartDef;
    expect(openAttachPoints(ship, aftDef).map((o) => o.point.id)).toEqual([
      "mast-aft",
    ]);
  });
});
