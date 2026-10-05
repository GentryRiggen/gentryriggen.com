import type { HalfPose } from "@/lib/ship-builder/sim/types";
import { FLOOR_DEPTH } from "@/lib/ship-builder/sim/descent";
import { PLUNGE_DEPTH } from "@/lib/ship-builder/sim/flooding";
import { cameraFollow } from "../cameraFollow";
import { CAMERA_TARGET } from "../cameraViews";

const LENGTH = 20;

function half(overrides: Partial<HalfPose>): HalfPose {
  return { roll: 0, pitch: 0, sink: 0, pivotX: 12, driftX: 0, ...overrides };
}

const base = {
  phase: "sinking",
  sink: 4,
  halves: null,
  breakup: null,
  speed: 1,
} as const;

describe("cameraFollow", () => {
  it("leaves the camera alone when not sinking", () => {
    expect(
      cameraFollow({ ...base, phase: "sailing", sink: 0 }, LENGTH)
    ).toBeNull();
    expect(cameraFollow({ ...base, phase: "capsizing" }, LENGTH)).toBeNull();
    expect(
      cameraFollow({ ...base, phase: "done", sink: 0 }, LENGTH)
    ).toBeNull();
    expect(cameraFollow({ ...base, sink: 0.1 }, LENGTH)).toBeNull();
  });

  it("follows a whole ship down to its sunk position", () => {
    const follow = cameraFollow(base, LENGTH);
    expect(follow?.target).toEqual([0, CAMERA_TARGET[1] - 4, 0]);
    expect(follow?.isSideOn).toBe(false);
    expect(follow?.isLow).toBe(false);
  });

  it("prefers a side-on view in slow motion", () => {
    expect(cameraFollow({ ...base, speed: 0.25 }, LENGTH)?.isSideOn).toBe(true);
  });

  it("follows the half still up at the surface, not below the plunge", () => {
    const breakup = { at: 5, atX: 12, angle: -0.2 };
    // The stern half (8 long) stands up: its centre is 4 units above its pivot.
    const rearing = cameraFollow(
      {
        ...base,
        breakup,
        halves: {
          bow: half({ sink: 20, pitch: -1 }),
          stern: half({ sink: 1, pitch: -Math.PI / 2 }),
        },
      },
      LENGTH
    );
    expect(rearing?.target[0]).toBeCloseTo(-2, 5);
    expect(rearing?.target[1]).toBeCloseTo(CAMERA_TARGET[1] - 1 + 4, 5);

    const gone = cameraFollow(
      {
        ...base,
        phase: "done",
        breakup,
        halves: {
          bow: half({ sink: 20, pitch: -1 }),
          stern: half({ sink: 30, pitch: -Math.PI / 2 }),
        },
      },
      LENGTH
    );
    expect(gone?.target[1]).toBeCloseTo(CAMERA_TARGET[1] - PLUNGE_DEPTH, 5);
    expect(gone?.isLow).toBe(false);
  });

  it("aims at the midpoint of the halves' centres on the way down", () => {
    const follow = cameraFollow(
      {
        ...base,
        phase: "descending",
        breakup: { at: 5, atX: 12, angle: -0.2 },
        // Level halves, the bow one drifted 2 units forward and 2 deeper.
        halves: {
          bow: half({ sink: 6, driftX: 2 }),
          stern: half({ sink: 2 }),
        },
      },
      LENGTH
    );
    // Level halves: bow centre x = (-2 + 10) / 2 + 2 = 6, stern = (-10 + -2) / 2.
    expect(follow?.target[0]).toBeCloseTo((6 + -6) / 2, 5);
    expect(follow?.target[1]).toBeCloseTo(CAMERA_TARGET[1] - 4, 5);
  });

  it("frames the wreck low near the floor, also after landing", () => {
    expect(
      cameraFollow(
        { ...base, phase: "descending", sink: FLOOR_DEPTH - 2 },
        LENGTH
      )?.isLow
    ).toBe(true);
    const landed = cameraFollow(
      { ...base, phase: "done", sink: FLOOR_DEPTH },
      LENGTH
    );
    expect(landed?.isLow).toBe(true);
    expect(landed?.target[1]).toBeCloseTo(CAMERA_TARGET[1] - FLOOR_DEPTH, 5);
  });
});
