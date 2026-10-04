import { DECK_Y, footprintBase, modelToWorld } from "../coords";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import type { GridPartDef } from "@/lib/ship-builder/model/types";

describe("modelToWorld", () => {
  it("puts the bow at +X, starboard at +Z, and the deck at DECK_Y", () => {
    expect(modelToWorld(24, 4, { x: 0, y: 0, z: 0 })).toEqual([12, DECK_Y, 2]);
    expect(modelToWorld(24, 4, { x: 24, y: 2, z: 4 })).toEqual([
      -12,
      DECK_Y + 2,
      -2,
    ]);
  });

  it("centres the hull on the beam", () => {
    expect(modelToWorld(24, 3, { x: 0, y: 0, z: 1.5 })[2]).toBe(0);
    expect(modelToWorld(24, 7, { x: 0, y: 0, z: 3.5 })[2]).toBe(0);
    expect(modelToWorld(24, 3, { x: 0, y: 0, z: 0 })[2]).toBe(1.5);
    expect(modelToWorld(24, 7, { x: 0, y: 0, z: 7 })[2]).toBe(-3.5);
  });

  it("puts starboard wing cells (negative z) beyond the hull edge", () => {
    expect(modelToWorld(24, 7, { x: 0, y: 0, z: -1.5 })[2]).toBe(5);
  });
});

describe("footprintBase", () => {
  it("centers a rotated footprint on its cells", () => {
    const def = getPartDef("deck-2x1") as GridPartDef;
    expect(
      footprintBase(def, { kind: "grid", level: 1, x: 3, z: 0 }, 90)
    ).toEqual({
      center: { x: 3.5, y: 1, z: 1 },
      size: { x: 1, z: 2 },
    });
  });
});
