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
import { createTitanicModel, recipeFor } from "../shipModel";
import type { Mesh } from "three";

// The canvases the textures draw need a browser: stand-ins here.
jest.mock("../textures", () => {
  const tex = () => new (jest.requireActual("three").Texture)();
  return {
    acquireShipTextures: () => ({
      plateNormal: tex(),
      weathering: tex(),
      planks: tex(),
      names: tex(),
      dispose() {},
    }),
    releaseShipTextures() {},
    acquireDazzleTexture: () => tex(),
    releaseDazzleTexture() {},
  };
});

/**
 * The walk-hidden list (1.17): her model's pool-glass block, its glass
 * dome and her deck-11 roof's middle cells under the hall, all of it in
 * the tail of her paint mesh (no mesh of its own, so no draw call; the
 * scene stops the draw range before it), which the room kit's pool hall
 * replaces while walking on her. Every other ship's list is empty (no mesh), and her
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

describe("the walk-hidden tail", () => {
  it("is her paint mesh's last triangles, with no mesh of its own", () => {
    const d = buildShipPart(recipeFor(concordia), "whole", null, "low");
    const m = createTitanicModel(concordia, { quality: "low", breakX: null });
    try {
      const meshes: Mesh[] = [];
      m.handles.whole.traverse((o) => {
        if (o.name === "walk-hidden") throw new Error("a walk-hidden mesh");
        if (o.userData.walkHiddenFrom !== undefined) meshes.push(o as Mesh);
      });
      expect(meshes).toHaveLength(1);
      const paint = meshes[0];
      expect(paint.name).toBe("paint");
      const idx = paint.geometry.index!;
      expect(idx.count).toBe(
        (d.paint.triangleCount + d.walkHidden.triangleCount) * 3
      );
      expect(paint.userData.walkHiddenFrom).toBe(d.paint.triangleCount * 3);
    } finally {
      m.dispose();
    }
  });

  it("has none on a ship without a walk-hidden block", () => {
    const m = createTitanicModel(titanic, { quality: "low", breakX: null });
    try {
      let n = 0;
      m.handles.whole.traverse((o) => {
        if (o.userData.walkHiddenFrom !== undefined) n += 1;
      });
      expect(n).toBe(0);
    } finally {
      m.dispose();
    }
  });
});
