import {
  CELLS_PER_SEGMENT,
  MAX_SEGMENTS,
  MIN_SEGMENTS,
} from "@/lib/ship-builder/model/grid";
import type { CameraView } from "@/lib/ship-builder/state/store";
import {
  CAMERA_TARGET,
  MAX_POLAR_ANGLE,
  polarAngle,
  viewDistance,
  viewPosition,
} from "../cameraViews";

const VIEWS: CameraView[] = ["side", "top", "three-quarter"];
const LENGTHS = [MIN_SEGMENTS, 8, MAX_SEGMENTS].map(
  (segments) => segments * CELLS_PER_SEGMENT
);

describe("viewPosition", () => {
  it.each(VIEWS)("keeps the %s preset inside the polar clamp", (view) => {
    for (const length of LENGTHS) {
      expect(polarAngle(viewPosition(view, length))).toBeLessThanOrEqual(
        MAX_POLAR_ANGLE
      );
    }
  });

  it("looks at the side from just above the horizon", () => {
    for (const length of LENGTHS) {
      const position = viewPosition("side", length);
      const degrees = (polarAngle(position) * 180) / Math.PI;
      expect(degrees).toBeGreaterThan(80);
      expect(degrees).toBeLessThan(85);
      expect(position[1]).toBeGreaterThan(CAMERA_TARGET[1]);
    }
  });

  it("places the side camera at the framing distance", () => {
    const [x, y, z] = viewPosition("side", 36).map(
      (value, i) => value - CAMERA_TARGET[i]
    );
    expect(Math.hypot(x, y, z)).toBeCloseTo(viewDistance(36));
  });
});
