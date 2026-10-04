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
  CAMERA_TARGET,
  clampTarget,
  panBounds,
  PAN_MARGIN,
  shipBeam,
  MAX_POLAR_ANGLE,
  MAX_VIEW_DISTANCE,
  polarAngle,
  shouldReframe,
  shouldReframeBeam,
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
