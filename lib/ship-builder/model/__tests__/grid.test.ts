import { getPartDef } from "../catalog";
import {
  beamOf,
  buildOccupancy,
  cellKey,
  DEFAULT_BEAM,
  footprintCells,
  gridLength,
  inBounds,
  isForwardHalf,
  isInsideHull,
  MAX_BEAM,
  MIN_BEAM,
  partCells,
  rotatedFootprint,
  topLevel,
  WING_REACH,
} from "../grid";
import type { GridPartDef } from "../types";
import { attachPart, gridPart, testShip } from "../../testing";

const deck2 = getPartDef("deck-2x1") as GridPartDef;

describe("grid", () => {
  it("is three cells per hull segment", () => {
    expect(gridLength(testShip([], 4))).toBe(12);
    expect(gridLength(testShip([], 12))).toBe(36);
  });

  it("rotates footprints by swapping axes at 90 and 270", () => {
    expect(rotatedFootprint({ x: 2, z: 1 }, 0)).toEqual({ x: 2, z: 1 });
    expect(rotatedFootprint({ x: 2, z: 1 }, 90)).toEqual({ x: 1, z: 2 });
    expect(rotatedFootprint({ x: 2, z: 1 }, 180)).toEqual({ x: 2, z: 1 });
    expect(rotatedFootprint({ x: 2, z: 1 }, 270)).toEqual({ x: 1, z: 2 });
  });

  it("lists footprint cells from the anchor corner", () => {
    const anchor = { kind: "grid", level: 1, x: 3, z: 2 } as const;
    expect(footprintCells(deck2, anchor, 0)).toEqual([
      { level: 1, x: 3, z: 2 },
      { level: 1, x: 4, z: 2 },
    ]);
    expect(footprintCells(deck2, anchor, 90)).toEqual([
      { level: 1, x: 3, z: 2 },
      { level: 1, x: 3, z: 3 },
    ]);
  });

  it("checks bounds on every axis", () => {
    const ship = testShip([], 4);
    expect(inBounds(ship, { level: 0, x: 0, z: 0 })).toBe(true);
    expect(inBounds(ship, { level: 3, x: 11, z: 3 })).toBe(true);
    expect(inBounds(ship, { level: 4, x: 0, z: 0 })).toBe(false);
    expect(inBounds(ship, { level: -1, x: 0, z: 0 })).toBe(false);
    expect(inBounds(ship, { level: 0, x: 12, z: 0 })).toBe(false);
    expect(inBounds(ship, { level: 0, x: 0, z: 6 })).toBe(false);
    expect(inBounds(ship, { level: 0, x: 0, z: -3 })).toBe(false);
    expect(inBounds(ship, { level: 0, x: -1, z: 0 })).toBe(false);
  });

  it("reads the beam from the ship, 3 to 7 cells wide", () => {
    expect([MIN_BEAM, DEFAULT_BEAM, MAX_BEAM]).toEqual([3, 4, 7]);
    expect(beamOf(testShip())).toBe(DEFAULT_BEAM);
    expect(beamOf(testShip([], 8, 7))).toBe(7);
  });

  it("keeps inner columns of a wide hull in bounds", () => {
    expect(inBounds(testShip([], 4, 7), { level: 0, x: 0, z: 6 })).toBe(true);
  });

  it("reaches two wing columns past each hull edge, at every level", () => {
    expect(WING_REACH).toBe(2);
    for (const beam of [3, 4, 7]) {
      const ship = testShip([], 4, beam);
      for (const level of [0, 3]) {
        expect(inBounds(ship, { level, x: 0, z: -2 })).toBe(true);
        expect(inBounds(ship, { level, x: 0, z: -3 })).toBe(false);
        expect(inBounds(ship, { level, x: 0, z: beam + 1 })).toBe(true);
        expect(inBounds(ship, { level, x: 0, z: beam + 2 })).toBe(false);
      }
    }
  });

  it("separates inside-hull cells from wing cells", () => {
    const ship = testShip([], 4, 3);
    expect(isInsideHull(ship, { level: 0, x: 0, z: 0 })).toBe(true);
    expect(isInsideHull(ship, { level: 2, x: 11, z: 2 })).toBe(true);
    expect(isInsideHull(ship, { level: 0, x: 0, z: -1 })).toBe(false);
    expect(isInsideHull(ship, { level: 0, x: 0, z: 3 })).toBe(false);
    expect(isInsideHull(ship, { level: 0, x: 12, z: 1 })).toBe(false);
    expect(isInsideHull(ship, { level: 4, x: 0, z: 1 })).toBe(false);
  });

  it("treats cells below half the length as the forward half", () => {
    const ship = testShip([], 4);
    expect(isForwardHalf(ship, 5)).toBe(true);
    expect(isForwardHalf(ship, 6)).toBe(false);
  });

  it("maps occupied cells to parts and ignores attach parts", () => {
    const block = gridPart("a", "deck-2x1", 0, 0, 0);
    const funnel = attachPart("f", "funnel", "a", "funnel");
    const occ = buildOccupancy(testShip([block, funnel]));
    expect(occ.size).toBe(2);
    expect(occ.get(cellKey({ level: 0, x: 1, z: 0 }))).toBe(block);
    expect(partCells(funnel)).toEqual([]);
  });

  it("finds the top occupied level of a column", () => {
    const occ = buildOccupancy(
      testShip([
        gridPart("a", "deck-1x1", 0, 2, 1),
        gridPart("b", "deck-1x1", 1, 2, 1),
      ])
    );
    expect(topLevel(occ, 2, 1)).toBe(1);
    expect(topLevel(occ, 0, 0)).toBe(-1);
  });
});
