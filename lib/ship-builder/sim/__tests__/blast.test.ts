import { buildOccupancy, gridLength, partCells } from "../../model/grid";
import type { Ship } from "../../model/types";
import { findTemplate } from "../../templates";
import { blastPiecesOf, BLAST_REACH, MAX_THROWN } from "../blast";

function templateShip(id: string): Ship {
  const template = findTemplate(id);
  if (!template) throw new Error(`no template ${id}`);
  return template.build();
}

describe("blastPiecesOf", () => {
  const ship = templateShip("titanic");
  const length = gridLength(ship);

  it("throws parts near the blast and leaves the far end alone", () => {
    const pieces = blastPiecesOf(ship, length / 2);
    expect(pieces.length).toBeGreaterThan(0);
    expect(pieces.length).toBeLessThan(ship.parts.length);
    const thrown = new Set(pieces.map((p) => p.partId));
    const near = pieces.filter(
      (p) => Math.abs(p.x - length / 2) <= BLAST_REACH
    );
    expect(near.length).toBeGreaterThan(0);
    // Nothing near the bow goes with a blast amidships.
    const bowPart = ship.parts.find((part) =>
      partCells(part).some((cell) => cell.x === 0)
    );
    if (bowPart) expect(thrown.has(bowPart.id)).toBe(false);
  });

  it("is the same list every time for the same ship and spot", () => {
    expect(blastPiecesOf(ship, 12)).toEqual(blastPiecesOf(ship, 12));
  });

  it("leaves nothing hanging from or stacked on a thrown part", () => {
    const pieces = blastPiecesOf(ship, length / 2, buildOccupancy(ship));
    const thrown = new Set(pieces.map((p) => p.partId));
    for (const part of ship.parts) {
      if (thrown.has(part.id)) continue;
      if (part.anchor.kind === "attach") {
        expect(thrown.has(part.anchor.parentId)).toBe(false);
      }
      for (const cell of partCells(part)) {
        const below = ship.parts.filter(
          (other) =>
            thrown.has(other.id) &&
            partCells(other).some(
              (c) => c.x === cell.x && c.z === cell.z && c.level < cell.level
            )
        );
        expect(below).toEqual([]);
      }
    }
  });

  it("never throws more than the cap, even off a huge ship", () => {
    const huge = templateShip("wonder-of-the-seas");
    const pieces = blastPiecesOf(huge, gridLength(huge) / 2);
    expect(pieces.length).toBeGreaterThan(0);
    expect(pieces.length).toBeLessThanOrEqual(MAX_THROWN);
  });

  it("throws nothing from an empty ship", () => {
    expect(blastPiecesOf({ ...ship, parts: [] }, 5)).toEqual([]);
  });
});
