import { buildOccupancy, cellKey, partCells } from "../grid";
import { canPlace } from "../placement";
import {
  isGrounded,
  MAX_OVERHANG,
  stepsToSupport,
  supportMap,
} from "../support";
import type { Cell } from "../types";
import { gridPart, testShip } from "../../testing";

const key = (level: number, x: number, z: number) => cellKey({ level, x, z });

/** Level-1 run from x 4 to x 8 at z 1, standing on one block at x 4. */
function cantileverShip() {
  return testShip([
    gridPart("pillar", "deck-1x1", 0, 4, 1),
    gridPart("s4", "deck-1x1", 1, 4, 1),
    gridPart("s5", "deck-1x1", 1, 5, 1),
    gridPart("s6", "deck-1x1", 1, 6, 1),
    gridPart("s7", "deck-1x1", 1, 7, 1),
    gridPart("s8", "deck-1x1", 1, 8, 1),
  ]);
}

describe("isGrounded", () => {
  const ship = testShip([gridPart("a", "deck-1x1", 0, 2, 0)], 8, 4);
  const occupancy = buildOccupancy(ship);
  const grounded = (cell: Cell) => isGrounded(ship, occupancy, cell);

  it("grounds level-0 cells over the hull but not over a wing", () => {
    expect(grounded({ level: 0, x: 5, z: 0 })).toBe(true);
    expect(grounded({ level: 0, x: 5, z: 3 })).toBe(true);
    expect(grounded({ level: 0, x: 5, z: -1 })).toBe(false);
    expect(grounded({ level: 0, x: 5, z: 4 })).toBe(false);
  });

  it("grounds a cell with a part directly below it", () => {
    expect(grounded({ level: 1, x: 2, z: 0 })).toBe(true);
    expect(grounded({ level: 1, x: 3, z: 0 })).toBe(false);
    expect(grounded({ level: 2, x: 2, z: 0 })).toBe(false);
  });
});

describe("supportMap", () => {
  it("measures steps to the nearest grounded cell through occupied cells", () => {
    const ship = cantileverShip();
    const map = supportMap(ship, buildOccupancy(ship));
    expect(map.get(key(0, 4, 1))).toBe(0);
    expect(map.get(key(1, 4, 1))).toBe(0);
    expect(map.get(key(1, 5, 1))).toBe(1);
    expect(map.get(key(1, 6, 1))).toBe(2);
    expect(map.get(key(1, 7, 1))).toBe(3);
    expect(map.get(key(1, 8, 1))).toBe(4);
    expect(map.size).toBe(6);
  });

  it("takes the nearer of two supports", () => {
    const ship = testShip([
      ...cantileverShip().parts,
      gridPart("far", "deck-1x1", 0, 8, 1),
    ]);
    const map = supportMap(ship, buildOccupancy(ship));
    expect(map.get(key(1, 7, 1))).toBe(1);
    expect(map.get(key(1, 6, 1))).toBe(2);
  });

  it("leaves out cells with no path to the ground", () => {
    const ship = testShip([
      gridPart("wing", "deck-1x1", 0, 3, -2),
      gridPart("float", "deck-1x1", 2, 3, 1),
    ]);
    expect(supportMap(ship, buildOccupancy(ship)).size).toBe(0);
  });

  it("does not walk between levels", () => {
    // The level-1 block at x 6 is beside nothing on its own level.
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 5, 1),
      gridPart("b", "deck-1x1", 0, 6, 1),
      gridPart("c", "deck-1x1", 1, 5, 1),
      gridPart("d", "deck-1x1", 1, 7, 1),
    ]);
    const map = supportMap(ship, buildOccupancy(ship));
    expect(map.has(key(1, 7, 1))).toBe(false);
  });
});

describe("stepsToSupport", () => {
  it("agrees with supportMap up to the limit and stops past it", () => {
    const ship = cantileverShip();
    const occupancy = buildOccupancy(ship);
    const map = supportMap(ship, occupancy);
    const occupied = (k: string) => occupancy.has(k);
    for (let x = 4; x <= 8; x++) {
      const cell = { level: 1, x, z: 1 };
      const steps = stepsToSupport(ship, occupied, cell, MAX_OVERHANG);
      const expected = map.get(cellKey(cell))!;
      expect(steps).toBe(expected <= MAX_OVERHANG ? expected : Infinity);
    }
  });
});

describe("canPlace support verdicts", () => {
  /** Small deterministic PRNG so failures reproduce. */
  function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SUPPORT_REASONS = new Set([
    "Too far from a support (max 2 cells)",
    "Needs a deck beneath every cell",
  ]);

  it("match supportMap on the ship plus the candidate", () => {
    const random = mulberry32(0xbeef);
    const int = (min: number, max: number) =>
      min + Math.floor(random() * (max - min + 1));
    let checked = 0;
    for (let round = 0; round < 40; round++) {
      const beam = int(3, 7);
      let ship = testShip([], 4, beam);
      for (let step = 0; step < 120; step++) {
        const part = gridPart(
          `p${step}`,
          random() < 0.7 ? "deck-1x1" : "deck-2x1",
          int(0, 3),
          int(0, 11),
          int(-2, beam + 1),
          random() < 0.5 ? 0 : 90
        );
        const verdict = canPlace(ship, part);
        const withPart = testShip([...ship.parts, part], 4, beam);
        if (verdict.ok || SUPPORT_REASONS.has(verdict.reason)) {
          const map = supportMap(withPart, buildOccupancy(withPart));
          const isHeld = partCells(part).every(
            (cell) => (map.get(cellKey(cell)) ?? Infinity) <= MAX_OVERHANG
          );
          expect(verdict.ok).toBe(isHeld);
          checked += 1;
        }
        if (verdict.ok) ship = withPart;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});
