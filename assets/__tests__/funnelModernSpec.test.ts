import { Box3 } from "three";
import {
  buildModernFunnelBody,
  buildModernFunnelGrille,
} from "@/components/ship-builder/scene/funnelGeometry";
import { FUNNEL_RAKE_RADIANS } from "@/components/ship-builder/scene/effectAnchors";
import spec from "../parts/funnel-modern.json";

// ModernFunnel turns itself by the rake, so the spec holds the upright bounds.
function uprightBounds(): Box3 {
  const box = new Box3();
  for (const part of [buildModernFunnelBody(), buildModernFunnelGrille()]) {
    part.computeBoundingBox();
    box.union(part.boundingBox as Box3);
    part.dispose();
  }
  return box;
}

describe("funnel-modern spec", () => {
  it("expectedBounds match the upright procedural funnel", () => {
    const box = uprightBounds();
    const { expectedBounds } = spec.variants[0];
    for (let i = 0; i < 3; i++) {
      expect(expectedBounds.min[i]).toBeCloseTo(box.min.toArray()[i], 2);
      expect(expectedBounds.max[i]).toBeCloseTo(box.max.toArray()[i], 2);
    }
  });

  it("uses the game's funnel rake and keeps its bounds", () => {
    expect(spec.rakeRadians).toBe(FUNNEL_RAKE_RADIANS);
    expect(spec.boundsFixed).toBe(true);
  });
});
