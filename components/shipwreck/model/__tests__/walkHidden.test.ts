import { britannic } from "@/lib/shipwreck/ships/britannic";
import { carpathia } from "@/lib/shipwreck/ships/carpathia";
import { concordia } from "@/lib/shipwreck/ships/concordia";
import {
  CONCORDIA_POOL_DOME,
  CONCORDIA_POOL_GLASS,
} from "@/lib/shipwreck/ships/concordiaLayout";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { buildShipPart } from "../buildShip";
import { recipeFor } from "../shipModel";

/**
 * The walk-hidden list (1.17): her model's pool-glass block, its glass
 * dome and her deck-11 roof's middle cells under the hall, all of it in
 * the mesh "walk-hidden", which the room kit's pool hall replaces while
 * walking on her. Every other ship's list is empty (no mesh), and her
 * geometry is the same, only moved.
 */

function tris(d: ReturnType<typeof buildShipPart>): number {
  return (
    d.paint.triangleCount +
    d.deck.triangleCount +
    d.dazzle.triangleCount +
    d.variant.triangleCount +
    d.walkHidden.triangleCount
  );
}

describe("the walk-hidden list", () => {
  const d = buildShipPart(recipeFor(concordia), "whole", null, "high");

  it("holds only her pool hall's block, dome and the roof under it", () => {
    expect(d.walkHidden.triangleCount).toBeGreaterThan(0);
    const { x0, x1, halfWidth } = CONCORDIA_POOL_GLASS;
    const pos = d.walkHidden.pos;
    for (let i = 0; i < pos.length; i += 3) {
      // Three axes (x, z, −y): over the hall's plan, a little slack for
      // the roof's cells; the model's curb ring under the dome runs its
      // long axis across her (to a + 0.15 either side).
      expect(pos[i]).toBeGreaterThan(x0 - 4);
      expect(pos[i]).toBeLessThan(x1 + 4);
      expect(Math.abs(pos[i + 2])).toBeLessThanOrEqual(
        Math.max(halfWidth, CONCORDIA_POOL_DOME.a + 0.15) + 1e-6
      );
    }
    // Up to the dome's crown over deck 13.
    let top = -Infinity;
    for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i]);
    expect(top).toBeCloseTo(47.78 + CONCORDIA_POOL_DOME.c, 3);
  });

  it("moves her geometry, never adds or drops any", () => {
    // Without the walk flags: the same triangles in all.
    const r = recipeFor(concordia);
    const plain = {
      ...r,
      blocks: r.blocks?.map((b) => ({
        ...b,
        walkHidden: undefined,
        walkHiddenRoof: undefined,
      })),
      domes: r.domes.map((x) => ({ ...x, walkHidden: undefined })),
    };
    const before = buildShipPart(plain, "whole", null, "high");
    expect(before.walkHidden.triangleCount).toBe(0);
    expect(tris(d)).toBe(tris(before));
  });

  it("is empty for every other ship", () => {
    for (const spec of [titanic, lusitania, britannic, carpathia])
      expect([
        spec.id,
        buildShipPart(recipeFor(spec), "whole", null, "high").walkHidden
          .triangleCount,
      ]).toEqual([spec.id, 0]);
  });
});
