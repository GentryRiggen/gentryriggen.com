import { existsSync } from "node:fs";
import { join } from "node:path";
import { meshPositions, readGlb } from "@/assets/glbFile";
import funnelSpec from "@/assets/parts/funnel.json";
import { GLB_MARK_CLEARANCE } from "../FunnelMesh";
import { funnelRadiusAt } from "../funnelGeometry";
import {
  FUNNEL_MODELS,
  funnelModelUrl,
  SHIP_MODEL_URLS,
  shipModelUrl,
} from "../shipModels";

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

  it("uses the funnel spec's variants and sizes", () => {
    expect(FUNNEL_MODELS).toEqual(
      funnelSpec.variants.map(({ name, dims }) => ({
        dims,
        url: shipModelUrl("funnel", name),
      }))
    );
  });

  it("finds a model only for the exact classic sizes", () => {
    expect(funnelModelUrl(FUNNEL_MODELS[1].dims)).toBe(FUNNEL_MODELS[1].url);
    expect(
      funnelModelUrl({ ...FUNNEL_MODELS[0].dims, bodyHeight: 2.7 })
    ).toBeNull();
  });

  it.each(FUNNEL_MODELS)(
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
