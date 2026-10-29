import { KIT_MODEL_URLS } from "../kitFiles";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { meshPositions, readGlb } from "@/assets/glbFile";
import funnelSpec from "@/assets/parts/funnel.json";
import {
  FUNNEL_DIMS,
  FUNNEL_LARGE_DIMS,
  GLB_MARK_CLEARANCE,
  GLB_PARTS,
} from "../glbRegistry";
import { funnelRadiusAt, type FunnelDims } from "../funnelGeometry";
import { SHIP_MODEL_URLS, shipModelUrl } from "../shipModels";

jest.mock("@react-three/drei", () => ({ useGLTF: { preload: jest.fn() } }));

/** FunnelMarkDecals' own gap off the body it is given. */
const DECAL_OFFSET = 0.01;
/** The least daylight wanted between a mark and the glb body. */
const MIN_GAP = 0.004;

function publicFile(url: string): string {
  return join(process.cwd(), "public", url);
}

describe("ship models", () => {
  it("points every model at a committed file", () => {
    for (const url of SHIP_MODEL_URLS) {
      expect(existsSync(publicFile(url))).toBe(true);
    }
  });

  it("lists each registry entry's file and each detail-kit file once", () => {
    const urls = Object.values(GLB_PARTS).map((e) =>
      shipModelUrl(e.model, e.variant)
    );
    expect([...SHIP_MODEL_URLS].sort()).toEqual(
      [...new Set([...urls, ...KIT_MODEL_URLS])].sort()
    );
  });

  it("uses the funnel spec's variants and sizes", () => {
    expect(
      funnelSpec.variants.map(({ name, dims }) => ({ name, dims }))
    ).toEqual([
      { name: GLB_PARTS.funnel?.variant, dims: FUNNEL_DIMS },
      { name: GLB_PARTS["funnel-large"]?.variant, dims: FUNNEL_LARGE_DIMS },
    ]);
  });

  it("draws every registered part from a variant its spec lists", () => {
    for (const entry of Object.values(GLB_PARTS)) {
      const spec = JSON.parse(
        readFileSync(
          join(process.cwd(), "assets", "parts", `${entry.model}.json`),
          "utf8"
        )
      );
      expect(spec.variants.map((v: { name: string }) => v.name)).toContain(
        entry.variant
      );
    }
  });

  const FUNNELS: { dims: FunnelDims; url: string }[] = [
    { dims: FUNNEL_DIMS, url: shipModelUrl("funnel", "funnel") },
    { dims: FUNNEL_LARGE_DIMS, url: shipModelUrl("funnel", "funnel-large") },
  ];
  it.each(FUNNELS)(
    "$url keeps the marks clear of its plate seams",
    ({ dims, url }) => {
      // FunnelMesh's mark: centred at 55% height, 1.3x the radius square.
      const height = dims.bodyHeight * 0.55;
      const radius = funnelRadiusAt(dims, height);
      const half = (radius * 1.3) / 2;
      const decal = radius + GLB_MARK_CLEARANCE + DECAL_OFFSET;
      const body = meshPositions(readGlb(publicFile(url)), "body");
      let nearest = Infinity;
      for (const [x, y, z] of body) {
        if (Math.abs(y - height) > half || Math.abs(x) > half) continue;
        nearest = Math.min(nearest, decal - Math.abs(z));
      }
      expect(nearest).toBeGreaterThanOrEqual(MIN_GAP);
      // ...but not floating far off the plates either.
      expect(nearest).toBeLessThan(0.02);
    }
  );
});
