import { gridPart, testShip } from "../../testing";
import { joinedSides, NO_JOINED_SIDES, sidesKey } from "../blockSides";
import type { PlacedPart } from "../types";

const joins = (parts: PlacedPart[], index = 0) => {
  const ship = testShip(parts);
  return joinedSides(ship, parts[index]);
};

describe("joinedSides", () => {
  it("joins nothing for a lone block", () => {
    expect(joins([gridPart("a", "deck-1x1", 0, 3, 1)])).toEqual(
      NO_JOINED_SIDES
    );
  });

  it("joins the touching sides of a row, bow toward smaller x", () => {
    const parts = [
      gridPart("a", "deck-1x1", 0, 3, 1),
      gridPart("b", "cabin-1st", 0, 4, 1),
      gridPart("c", "deck-1x1", 0, 5, 1),
    ];
    expect(joins(parts, 0)).toEqual({ ...NO_JOINED_SIDES, stern: true });
    expect(joins(parts, 1)).toEqual({
      ...NO_JOINED_SIDES,
      bow: true,
      stern: true,
    });
    expect(joins(parts, 2)).toEqual({ ...NO_JOINED_SIDES, bow: true });
  });

  it("joins starboard toward smaller z and port toward larger z", () => {
    const parts = [
      gridPart("a", "deck-1x1", 0, 3, 1),
      gridPart("b", "deck-1x1", 0, 3, 2),
    ];
    expect(joins(parts, 0).port).toBe(true);
    expect(joins(parts, 0).starboard).toBe(false);
    expect(joins(parts, 1).starboard).toBe(true);
  });

  it("needs every cell along a side to be matched", () => {
    // A 2x1 deck rotated 90 spans z 1..2 at x 3; one neighbour covers half.
    const parts = [
      gridPart("a", "deck-2x1", 0, 3, 1, 90),
      gridPart("b", "deck-1x1", 0, 4, 1),
    ];
    expect(joins(parts, 0).stern).toBe(false);
    const full = [
      gridPart("a", "deck-2x1", 0, 3, 1, 90),
      gridPart("b", "deck-1x1", 0, 4, 1),
      gridPart("c", "deck-1x1", 0, 4, 2),
    ];
    expect(joins(full, 0).stern).toBe(true);
    expect(joins(full, 1)).toEqual({
      ...NO_JOINED_SIDES,
      bow: true,
      port: true,
    });
  });

  it("handles an unrotated 2x1 along the length", () => {
    const parts = [
      gridPart("a", "deck-2x1", 0, 3, 1),
      gridPart("b", "deck-1x1", 0, 5, 1),
      gridPart("c", "deck-1x1", 0, 3, 2),
    ];
    expect(joins(parts, 0)).toEqual({ ...NO_JOINED_SIDES, stern: true });
  });

  it("joins the top only when every cell has a block above", () => {
    const half = [
      gridPart("a", "deck-2x1", 0, 3, 1),
      gridPart("b", "cabin-1st", 1, 3, 1),
    ];
    expect(joins(half, 0).top).toBe(false);
    const whole = [...half, gridPart("c", "cabin-1st", 1, 4, 1)];
    expect(joins(whole, 0).top).toBe(true);
    expect(joins(whole, 1).top).toBe(false);
  });

  it("does not join across levels sideways", () => {
    const parts = [
      gridPart("a", "deck-1x1", 0, 3, 1),
      gridPart("b", "cabin-1st", 1, 4, 1),
    ];
    expect(joins(parts, 0)).toEqual(NO_JOINED_SIDES);
  });

  it("joins deck, cabin and bridge roles together but not decor or cargo", () => {
    const parts = [
      gridPart("a", "cabin-1st", 0, 3, 1),
      gridPart("b", "deckchair", 0, 4, 1),
      gridPart("c", "cabin-1st", 0, 2, 1),
      gridPart("d", "container", 0, 3, 2),
    ];
    expect(joins(parts, 0)).toEqual({ ...NO_JOINED_SIDES, bow: true });
    expect(joins(parts, 1)).toEqual(NO_JOINED_SIDES);
  });

  it("keeps a bridge apart from full-height blocks", () => {
    const parts = [
      gridPart("a", "bridge", 1, 3, 0, 90),
      gridPart("b", "cabin-1st", 1, 3, 4),
    ];
    expect(joins(parts, 0).port).toBe(false);
    expect(joins(parts, 1).starboard).toBe(false);
  });

  it("gives a ghost candidate its joins against the current ship", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 3, 1)]);
    const ghost = joinedSides(ship, {
      type: "cabin-1st",
      anchor: { kind: "grid", level: 0, x: 4, z: 1 },
      rotation: 0,
    });
    expect(ghost).toEqual({ ...NO_JOINED_SIDES, bow: true });
  });

  it("never joins fittings", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 3, 1)]);
    const sides = joinedSides(ship, {
      type: "funnel",
      anchor: { kind: "attach", parentId: "a", pointId: "top" },
      rotation: 0,
    });
    expect(sides).toEqual(NO_JOINED_SIDES);
  });
});

describe("sidesKey", () => {
  it("tells masks apart", () => {
    expect(sidesKey(NO_JOINED_SIDES)).toBe("00000");
    expect(sidesKey({ ...NO_JOINED_SIDES, top: true })).toBe("00001");
  });
});
