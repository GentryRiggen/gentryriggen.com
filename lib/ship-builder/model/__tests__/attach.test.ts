import {
  attachPointsOf,
  isPointTaken,
  openAttachPoints,
  resolveAttachPoint,
} from "../attach";
import { getPartDef } from "../catalog";
import { HULL_ID, type AttachPartDef } from "../types";
import { attachPart, gridPart, testShip } from "../../testing";

describe("attach points", () => {
  it("gives the hull fore and aft mast mounts that track the stern", () => {
    const short = attachPointsOf(testShip([], 4), HULL_ID);
    expect(short.map((p) => p.id)).toEqual(["mast-fore", "mast-aft"]);
    expect(short[0].position).toEqual({ x: -1, y: 0, z: 2 });
    expect(short[1].position).toEqual({ x: 12.75, y: 0, z: 2 });
    const long = attachPointsOf(testShip([], 8), HULL_ID);
    expect(long[1].position.x).toBe(24.75);
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
