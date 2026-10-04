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
  shouldReframe,
  shouldFrame,
  type FrameRequest,
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

describe("shouldReframe", () => {
  it("ignores single-segment hull edits", () => {
    expect(shouldReframe(4, 5)).toBe(false);
    expect(shouldReframe(8, 7)).toBe(false);
    expect(shouldReframe(4, 6)).toBe(false);
  });

  it("reframes when the hull length jumps from the previous length", () => {
    expect(shouldReframe(4, 12)).toBe(true);
    expect(shouldReframe(12, 4)).toBe(true);
    expect(shouldReframe(4, 7)).toBe(true);
  });
});

describe("shouldFrame", () => {
  const view: FrameRequest["camera"] = { view: "side", nonce: 0 };

  it("always frames the first request", () => {
    expect(shouldFrame(null, { camera: view, lengthSegments: 4 })).toBe(true);
  });

  it("does not reframe as single + clicks accumulate", () => {
    let seen: FrameRequest = { camera: view, lengthSegments: 4 };
    for (const lengthSegments of [5, 6, 7]) {
      const next = { camera: view, lengthSegments };
      expect(shouldFrame(seen, next)).toBe(false);
      seen = next;
    }
  });

  it("reframes when the length jumps in one step", () => {
    const seen = { camera: view, lengthSegments: 4 };
    expect(shouldFrame(seen, { camera: view, lengthSegments: 12 })).toBe(true);
  });

  it("reframes when a new preset is requested", () => {
    const seen = { camera: view, lengthSegments: 4 };
    const next: FrameRequest = {
      camera: { view: "top", nonce: 1 },
      lengthSegments: 4,
    };
    expect(shouldFrame(seen, next)).toBe(true);
  });
});
