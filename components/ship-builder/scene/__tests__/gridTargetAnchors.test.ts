import { gridLength } from "@/lib/ship-builder/model/grid";
import { gridPart, testShip } from "@/lib/ship-builder/testing";
import { gridTargetAnchors } from "../gridTargetAnchors";

type Anchors = ReturnType<typeof gridTargetAnchors>;

const at = (anchors: Anchors, level: number, x: number, z: number) =>
  anchors.find((a) => a.level === level && a.x === x && a.z === z);

describe("gridTargetAnchors", () => {
  it("covers the hull only, on an empty ship", () => {
    const ship = testShip([], 4, 4);
    const anchors = gridTargetAnchors(ship);
    expect(anchors).toHaveLength(gridLength(ship) * 4);
    expect(anchors.every((a) => a.level === 0 && a.z >= 0 && a.z < 4)).toBe(
      true
    );
  });

  it("follows the beam", () => {
    expect(gridTargetAnchors(testShip([], 4, 3))).toHaveLength(12 * 3);
    expect(gridTargetAnchors(testShip([], 4, 7))).toHaveLength(12 * 7);
  });

  it("targets the next level above a stack", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 5, 1)], 4, 4);
    const anchors = gridTargetAnchors(ship);
    expect(at(anchors, 1, 5, 1)).toBeDefined();
    expect(at(anchors, 0, 5, 1)).toBeUndefined();
  });

  it("offers no target above the top level", () => {
    const tower = [0, 1, 2, 3].map((level) =>
      gridPart(`t${level}`, "deck-1x1", level, 5, 1)
    );
    const anchors = gridTargetAnchors(testShip(tower, 4, 4));
    expect(anchors.some((a) => a.x === 5 && a.z === 1)).toBe(false);
  });

  it("offers wing targets only beside an occupied cell at that level", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 5, 0)], 4, 4);
    const anchors = gridTargetAnchors(ship);
    expect(at(anchors, 0, 5, -1)).toBeDefined();
    expect(at(anchors, 0, 5, -2)).toBeUndefined();
    expect(at(anchors, 0, 6, -1)).toBeUndefined();
    expect(at(anchors, 0, 5, 4)).toBeUndefined();
  });

  it("extends the wing one more cell outboard of an existing wing block", () => {
    const ship = testShip(
      [gridPart("a", "deck-1x1", 0, 5, 0), gridPart("w", "deck-1x1", 0, 5, -1)],
      4,
      4
    );
    const anchors = gridTargetAnchors(ship);
    expect(at(anchors, 0, 5, -2)).toBeDefined();
    expect(at(anchors, 0, 5, -3)).toBeUndefined();
  });

  it("reaches the port wing past the last hull column", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 5, 6)], 4, 7);
    const anchors = gridTargetAnchors(ship);
    expect(at(anchors, 0, 5, 7)).toBeDefined();
    expect(at(anchors, 0, 5, 8)).toBeUndefined();
  });

  it("marks wing anchors so they can be drawn differently", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 5, 0)], 4, 4);
    const anchors = gridTargetAnchors(ship);
    expect(at(anchors, 0, 5, -1)?.isWing).toBe(true);
    expect(at(anchors, 0, 5, 0)).toBeUndefined();
    expect(at(anchors, 0, 4, 0)?.isWing).toBe(false);
  });
});
