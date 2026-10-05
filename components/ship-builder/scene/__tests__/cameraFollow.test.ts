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

  const breakup = { at: 5, atX: 12, angle: -0.2 };

  it("frames a stern standing on end, superstructure and all", () => {
    // The stern half (8 long) stands straight up from 1 unit under: its keel
    // runs from y = -1 to y = 7, with up to 5 more on top for its decks.
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
    expect(rearing?.target[1]).toBeCloseTo((12 + -1) / 2, 5);
    expect(rearing?.height).toBeCloseTo(13, 5);
    expect(rearing?.isUnder).toBe(false);
  });

  it("keeps the usual framing while a half lies nearly level", () => {
    const settling = cameraFollow(
      {
        ...base,
        breakup,
        halves: {
          bow: half({ sink: 20, pitch: -1 }),
          stern: half({ sink: 1 }),
        },
      },
      LENGTH
    );
    // Level stern: centre x = (-10 + -2) / 2.
    expect(settling?.target).toEqual([-6, CAMERA_TARGET[1] - 1, 0]);
    expect(settling?.height).toBe(0);
  });

  it("aims just under the last half to go, not down in the dark", () => {
    const slipping = cameraFollow(
      {
        ...base,
        phase: "done",
        breakup,
        halves: {
          bow: half({ sink: 30, pitch: -1 }),
          // Its top (the stern tip) is 4 under the surface.
          stern: half({ sink: 12, pitch: -Math.PI / 2 }),
        },
      },
      LENGTH
    );
    expect(slipping?.target[0]).toBeCloseTo(-2, 5);
    expect(slipping?.target[1]).toBeCloseTo(-4 - 3, 5);
    expect(slipping?.isLow).toBe(false);
    expect(slipping?.isUnder).toBe(true);

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
    expect(gone?.target[1]).toBeCloseTo(-PLUNGE_DEPTH, 5);
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
