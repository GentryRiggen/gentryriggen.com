import { analyzeShip } from "../analysis";
import { getPartDef } from "../catalog";
import { computeStats } from "../stats";
import { HULL_ID, type AttachPartDef } from "../types";
import { attachPart, gridPart, testShip } from "../../testing";

const funnelDef = getPartDef("funnel") as AttachPartDef;

describe("analyzeShip", () => {
  it("returns the same analysis for the same ship object", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 4, 1)]);
    const first = analyzeShip(ship);
    expect(analyzeShip(ship)).toBe(first);
    expect(analyzeShip(ship).occupancy).toBe(first.occupancy);
    expect(analyzeShip(ship).stats).toBe(first.stats);
  });

  it("returns a fresh analysis for an edited ship", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 4, 1)]);
    const edited = {
      ...ship,
      parts: [...ship.parts, gridPart("b", "deck-1x1", 0, 5, 1)],
    };
    const before = analyzeShip(ship);
    const after = analyzeShip(edited);
    expect(after).not.toBe(before);
    expect(after.occupancy.size).toBe(2);
    expect(before.occupancy.size).toBe(1);
  });

  it("matches computeStats", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 4, 1),
      attachPart("f", "funnel", "a", "funnel"),
      attachPart("p", "propeller", HULL_ID, "prop:0"),
    ]);
    expect(analyzeShip(ship).stats).toEqual(computeStats(ship));
  });

  it("caches open attach points per part type", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 4, 1)]);
    const analysis = analyzeShip(ship);
    const open = analysis.openAttachPoints(funnelDef);
    expect(open.map((o) => [o.parentId, o.point.id])).toEqual([
      ["a", "funnel"],
    ]);
    expect(analysis.openAttachPoints(funnelDef)).toBe(open);
  });

  it("keeps a cached occupancy read-only", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 4, 1)]);
    expect(() => analyzeShip(ship).occupancy.clear()).toThrow(/read-only/);
  });

  it("does not go stale when a ship's parts grow in place", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 4, 1)]);
    const before = analyzeShip(ship);
    ship.parts.push(gridPart("b", "deck-1x1", 0, 5, 1));
    const after = analyzeShip(ship);
    expect(after).not.toBe(before);
    expect(after.occupancy.size).toBe(2);
  });
});
