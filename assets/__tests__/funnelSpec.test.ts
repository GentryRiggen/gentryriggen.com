import { Box3, CylinderGeometry } from "three";
import {
  buildFunnelBands,
  buildFunnelCap,
  buildFunnelOpening,
  buildSteamPipe,
  type FunnelDims,
} from "@/components/ship-builder/scene/funnelGeometry";
import spec from "../parts/funnel.json";

// The variant dims are copied from the `funnel` and `funnel-large` cases in
// components/ship-builder/scene/PartMesh.tsx.
function funnelBounds(dims: FunnelDims): Box3 {
  const body = new CylinderGeometry(
    dims.topRadius,
    dims.baseRadius,
    dims.bodyHeight,
    16
  );
  body.translate(0, dims.bodyHeight / 2, 0);
  const parts = [
    body,
    buildFunnelBands(dims),
    buildFunnelCap(dims),
    buildFunnelOpening(dims),
    buildSteamPipe(dims),
  ];
  const box = new Box3();
  for (const part of parts) {
    part.computeBoundingBox();
    box.union(part.boundingBox as Box3);
    part.dispose();
  }
  return box;
}

describe("funnel spec", () => {
  it.each(spec.variants)(
    "$name expectedBounds match the procedural funnel",
    ({ dims, expectedBounds }) => {
      const box = funnelBounds(dims);
      const actualMin = box.min.toArray();
      const actualMax = box.max.toArray();
      for (let i = 0; i < 3; i++) {
        expect(expectedBounds.min[i]).toBeCloseTo(actualMin[i], 3);
        expect(expectedBounds.max[i]).toBeCloseTo(actualMax[i], 3);
      }
    }
  );
});
