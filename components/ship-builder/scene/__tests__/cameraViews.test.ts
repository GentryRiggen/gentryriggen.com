import {
  CELLS_PER_SEGMENT,
  DEFAULT_BEAM,
  MAX_BEAM,
  MAX_SEGMENTS,
  MIN_BEAM,
  MIN_SEGMENTS,
  WING_REACH,
} from "@/lib/ship-builder/model/grid";
import { PROW_LENGTH } from "@/lib/ship-builder/model/attach";
import { emptyShip } from "@/lib/ship-builder/model/placement";
import type { CameraView } from "@/lib/ship-builder/state/store";
import {
  BELOW_TARGET,
  CAMERA_TARGET,
  clampTarget,
  panBounds,
  PAN_MARGIN,
  shipBeam,
  MAX_POLAR_ANGLE,
  MAX_VIEW_DISTANCE,
  maxPolarAngleFor,
  polarAngle,
  shouldReframe,
  shouldReframeBeam,
  shouldFrame,
  type FrameRequest,
  viewDistance,
  viewPosition,
  viewTarget,
  type CameraPosition,
} from "../cameraViews";
import { DECK_Y, HULL_DRAFT } from "../coords";

const VIEWS: CameraView[] = ["side", "top", "three-quarter"];
const LENGTHS = [MIN_SEGMENTS, 8, MAX_SEGMENTS].map(
  (segments) => segments * CELLS_PER_SEGMENT
);

const BELOW_FOV_DEGREES = 45;

/** The hull's bounding box: stern at -length/2, prow past +length/2. */
function hullCorners(length: number, beam: number): CameraPosition[] {
  const corners: CameraPosition[] = [];
  for (const x of [-length / 2, length / 2 + PROW_LENGTH])
    for (const y of [-HULL_DRAFT, DECK_Y])
      for (const z of [-beam / 2, beam / 2]) corners.push([x, y, z]);
  return corners;
}

/** Largest |normalised device coordinate| of any point, for a look-at camera. */
function maxNdc(
  position: CameraPosition,
  target: CameraPosition,
  points: CameraPosition[],
  aspect: number
): number {
  const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
  const dot = (a: number[], b: number[]) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (a: number[]) => a.map((v) => v / Math.hypot(a[0], a[1], a[2]));
  const forward = unit(sub(target, position));
  const right = unit([-forward[2], 0, forward[0]]);
  const up = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ];
  const tan = Math.tan((BELOW_FOV_DEGREES / 2) * (Math.PI / 180));
  return Math.max(
    ...points.map((point) => {
      const offset = sub(point, position);
      const depth = dot(offset, forward);
      if (depth <= 0) return Infinity;
      return Math.max(
        Math.abs(dot(offset, right) / depth / (tan * aspect)),
        Math.abs(dot(offset, up) / depth / tan)
      );
    })
  );
}

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

describe("below view", () => {
  it("targets the hull body under the waterline", () => {
    expect(BELOW_TARGET).toEqual([0, -1.2, 0]);
    expect(viewTarget("side")).toBe(CAMERA_TARGET);
    expect(viewTarget("top")).toBe(CAMERA_TARGET);
    expect(viewTarget("three-quarter")).toBe(CAMERA_TARGET);
    expect(viewTarget("below")).toBe(BELOW_TARGET);
  });

  it("sits under the water, toward the stern, within the max distance", () => {
    for (const length of LENGTHS) {
      for (const beam of [MIN_BEAM, MAX_BEAM]) {
        for (const aspect of [0.5, 1, 2]) {
          const position = viewPosition("below", length, aspect, beam);
          expect(position[1]).toBeLessThan(-2);
          expect(position[0]).toBeLessThan(0);
          const [x, y, z] = position.map((v, i) => v - BELOW_TARGET[i]);
          expect(Math.hypot(x, y, z)).toBeLessThanOrEqual(MAX_VIEW_DISTANCE);
        }
      }
    }
  });

  it("fits the whole hull for every length at aspect 0.75 or wider", () => {
    for (let segments = MIN_SEGMENTS; segments <= MAX_SEGMENTS; segments++) {
      const length = segments * CELLS_PER_SEGMENT;
      for (const beam of [MIN_BEAM, DEFAULT_BEAM, MAX_BEAM]) {
        for (const aspect of [0.75, 1, 2]) {
          const position = viewPosition("below", length, aspect, beam);
          const corners = hullCorners(length, beam);
          expect(maxNdc(position, BELOW_TARGET, corners, aspect)).toBeLessThan(
            1
          );
        }
      }
    }
  });

  it("stays inside its own polar clamp", () => {
    const position = viewPosition("below", 36);
    const [x, y, z] = position.map((v, i) => v - BELOW_TARGET[i]);
    expect(Math.atan2(Math.hypot(x, z), y)).toBeLessThanOrEqual(
      maxPolarAngleFor("below")
    );
  });
});

describe("maxPolarAngleFor", () => {
  it("keeps the camera above the water except in the below view", () => {
    expect(maxPolarAngleFor("side")).toBe(MAX_POLAR_ANGLE);
    expect(maxPolarAngleFor("top")).toBe(MAX_POLAR_ANGLE);
    expect(maxPolarAngleFor("three-quarter")).toBe(MAX_POLAR_ANGLE);
    expect(maxPolarAngleFor("below")).toBe(Math.PI - 0.1);
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
    expect(
      shouldFrame(null, { camera: view, lengthSegments: 4, beam: 4 })
    ).toBe(true);
  });

  it("does not reframe as single + clicks accumulate", () => {
    let seen: FrameRequest = { camera: view, lengthSegments: 4, beam: 4 };
    for (const lengthSegments of [5, 6, 7]) {
      const next = { camera: view, lengthSegments, beam: 4 };
      expect(shouldFrame(seen, next)).toBe(false);
      seen = next;
    }
  });

  it("reframes when the length jumps in one step", () => {
    const seen = { camera: view, lengthSegments: 4, beam: 4 };
    expect(
      shouldFrame(seen, { camera: view, lengthSegments: 12, beam: 4 })
    ).toBe(true);
  });

  it("reframes when a new preset is requested", () => {
    const seen = { camera: view, lengthSegments: 4, beam: 4 };
    const next: FrameRequest = {
      camera: { view: "top", nonce: 1 },
      lengthSegments: 4,
      beam: 4,
    };
    expect(shouldFrame(seen, next)).toBe(true);
  });

  it("does not reframe for a single beam step", () => {
    const seen = { camera: view, lengthSegments: 4, beam: 4 };
    expect(shouldFrame(seen, { ...seen, beam: 5 })).toBe(false);
    expect(shouldFrame(seen, { ...seen, beam: 6 })).toBe(false);
  });

  it("reframes when the beam jumps by more than two", () => {
    const seen = { camera: view, lengthSegments: 4, beam: 3 };
    expect(shouldFrame(seen, { ...seen, beam: 7 })).toBe(true);
  });
});

describe("shouldReframeBeam", () => {
  it("allows a change of two but not three", () => {
    expect(shouldReframeBeam(3, 5)).toBe(false);
    expect(shouldReframeBeam(7, 5)).toBe(false);
    expect(shouldReframeBeam(3, 6)).toBe(true);
    expect(shouldReframeBeam(MAX_BEAM, MIN_BEAM)).toBe(true);
  });
});

describe("beam framing", () => {
  it("backs the camera off for a wider ship", () => {
    expect(viewDistance(24, MAX_BEAM)).toBeGreaterThan(viewDistance(24, 4));
    expect(viewDistance(24, MIN_BEAM)).toBeLessThan(viewDistance(24, 4));
    expect(viewDistance(24)).toBe(viewDistance(24, DEFAULT_BEAM));
  });

  it("applies the beam to every preset", () => {
    const wide = viewPosition("three-quarter", 24, 1, MAX_BEAM);
    const narrow = viewPosition("three-quarter", 24, 1, MIN_BEAM);
    expect(wide[0]).toBeGreaterThan(narrow[0]);
  });
});

describe("three-quarter framing", () => {
  it("backs off in narrow canvases", () => {
    const wide = viewPosition("three-quarter", 36, 1.6);
    const narrow = viewPosition("three-quarter", 36, 0.6);
    expect(narrow[0]).toBeGreaterThan(wide[0]);
  });

  it("never exceeds the orbit max distance", () => {
    const position = viewPosition("three-quarter", 36, 0.1);
    const [x, y, z] = position.map((value, i) => value - CAMERA_TARGET[i]);
    expect(Math.hypot(x, y, z)).toBeLessThanOrEqual(MAX_VIEW_DISTANCE);
  });
});

describe("panBounds", () => {
  it("covers the hull, prow and wings plus a margin", () => {
    const bounds = panBounds(32, 4);
    expect(bounds.x).toEqual([
      -(16 + PROW_LENGTH + PAN_MARGIN),
      16 + PROW_LENGTH + PAN_MARGIN,
    ]);
    expect(bounds.z).toEqual([
      -(2 + WING_REACH + PAN_MARGIN),
      2 + WING_REACH + PAN_MARGIN,
    ]);
    expect(bounds.y).toEqual([0.5, 6]);
  });

  it("lets the target sink underwater in the below view", () => {
    expect(panBounds(32, 4, "below").y).toEqual([-4, 6]);
    expect(panBounds(32, 4, "side").y).toEqual([0.5, 6]);
  });

  it("contains the below target for every hull length", () => {
    for (const length of LENGTHS) {
      expect(clampTarget(BELOW_TARGET, panBounds(length, 4, "below"))).toEqual(
        BELOW_TARGET
      );
    }
  });

  it("grows with the beam", () => {
    expect(panBounds(16, 7).z[1]).toBeGreaterThan(panBounds(16, 3).z[1]);
  });

  it("contains the default target for every hull length", () => {
    for (const length of LENGTHS) {
      expect(clampTarget(CAMERA_TARGET, panBounds(length, 4))).toEqual(
        CAMERA_TARGET
      );
    }
  });
});

describe("clampTarget", () => {
  const bounds = panBounds(16, 4);

  it("leaves a target inside the box alone", () => {
    expect(clampTarget([1, 2, -1], bounds)).toEqual([1, 2, -1]);
  });

  it("pulls each axis back to the box", () => {
    expect(clampTarget([1000, -50, -1000], bounds)).toEqual([
      bounds.x[1],
      bounds.y[0],
      bounds.z[0],
    ]);
    expect(clampTarget([-1000, 50, 1000], bounds)).toEqual([
      bounds.x[0],
      bounds.y[1],
      bounds.z[1],
    ]);
  });
});

describe("shipBeam", () => {
  it("reads the hull beam", () => {
    const ship = emptyShip();
    expect(shipBeam(ship)).toBe(DEFAULT_BEAM);
    const wide = { ...ship, hull: { ...ship.hull, beam: 6 } };
    expect(shipBeam(wide)).toBe(6);
  });
});
