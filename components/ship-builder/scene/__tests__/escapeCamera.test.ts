import { JUMP_S, type BoatLaunch } from "@/lib/ship-builder/crowd/evacuation";
import { startSwimming } from "@/lib/ship-builder/walk/escape";
import {
  BOAT_EYE_HEIGHT,
  escapeCamera,
  SEATED_PITCH,
  SEAT_BACK,
  SWIM_BOB,
  SWIM_EYE_HEIGHT,
  type EscapeCameraContext,
} from "../escapeCamera";
import { EYE_HEIGHT, LOOK_DISTANCE } from "../walkCamera";

const launch: BoatLaunch = {
  boatId: "boat",
  kind: "raft",
  at: 0,
  ready: 1,
  departs: 2,
  origin: { x: 0, y: 1, z: 0 },
  roll: 0,
  pitch: 0,
  outward: 1,
  riders: [],
  spot: null,
  half: null,
};

const plan: EscapeCameraContext["plan"] = {
  launches: [launch],
  boatPoseAt: () => ({
    position: { x: 5, y: 0.2, z: 7 },
    rotation: { x: 0, y: 0, z: 0 },
  }),
};

function ctx(over: Partial<EscapeCameraContext> = {}): EscapeCameraContext {
  return { plan, t: 10, yaw: 0, bobTime: 0, reducedMotion: true, ...over };
}

describe("escapeCamera", () => {
  it("leaves the camera to the walk while aboard", () => {
    expect(escapeCamera({ kind: "aboard" }, ctx())).toBeNull();
  });

  it("puts a swimmer's eyes just above the water, looking along their yaw", () => {
    const phase = startSwimming({ x: 3, z: -2 }, Math.PI / 2, 4);
    const pose = escapeCamera(phase, ctx({ yaw: 0 }))!;
    expect(pose.eye[0]).toBeCloseTo(3);
    expect(pose.eye[1]).toBeCloseTo(SWIM_EYE_HEIGHT);
    expect(pose.eye[2]).toBeCloseTo(-2);
    expect(pose.target[0]).toBeCloseTo(3);
    expect(pose.target[1]).toBeCloseTo(SWIM_EYE_HEIGHT);
    expect(pose.target[2]).toBeCloseTo(-2 + LOOK_DISTANCE);
    expect(SWIM_EYE_HEIGHT).toBe(0.12);
  });

  it("bobs a swimmer on the swell at 0.5 Hz, but not with reduced motion", () => {
    const phase = startSwimming({ x: 0, z: 0 }, 0, 0);
    // A quarter of a 2 s period: the top of the bob.
    const top = escapeCamera(
      phase,
      ctx({ bobTime: 0.5, reducedMotion: false })
    )!;
    expect(top.eye[1]).toBeCloseTo(SWIM_EYE_HEIGHT + SWIM_BOB);
    expect(SWIM_BOB).toBe(0.04);
    const still = escapeCamera(
      phase,
      ctx({ bobTime: 0.5, reducedMotion: true })
    )!;
    expect(still.eye[1]).toBeCloseTo(SWIM_EYE_HEIGHT);
  });

  it("seats the eyes in the boat, looking along the walk's yaw, tipped down", () => {
    const pose = escapeCamera(
      { kind: "in-boat", boatId: "boat", since: 3, fromWater: true },
      ctx({ yaw: -Math.PI / 2 })
    )!;
    expect(BOAT_EYE_HEIGHT).toBe(0.5);
    expect(SEATED_PITCH).toBeGreaterThan(0);
    expect(SEATED_PITCH).toBeLessThan(0.3);
    // Sat at the back of the boat (+z, away from the ship at -z).
    expect(pose.eye[0]).toBeCloseTo(5);
    expect(pose.eye[1]).toBeCloseTo(0.2 + BOAT_EYE_HEIGHT);
    expect(pose.eye[2]).toBeCloseTo(7 + SEAT_BACK);
    expect(pose.target[0]).toBeCloseTo(5);
    expect(pose.target[1]).toBeCloseTo(
      0.2 + BOAT_EYE_HEIGHT - Math.tan(SEATED_PITCH) * LOOK_DISTANCE
    );
    expect(pose.target[2]).toBeCloseTo(7 + SEAT_BACK - LOOK_DISTANCE);
  });

  it("has no view of a boat the plan does not know", () => {
    expect(
      escapeCamera(
        { kind: "in-boat", boatId: "nope", since: 3, fromWater: true },
        ctx()
      )
    ).toBeNull();
    expect(
      escapeCamera(
        { kind: "in-boat", boatId: "boat", since: 3, fromWater: true },
        ctx({ plan: null })
      )
    ).toBeNull();
  });

  it("leaps along an arc from the deck to the seat", () => {
    const from = { x: 1, y: 2, z: 3 };
    const phase = {
      kind: "jumping" as const,
      boatId: "boat",
      since: 10,
      from,
    };
    const start = escapeCamera(phase, ctx({ t: 10 }))!;
    expect(start.eye[0]).toBeCloseTo(1);
    expect(start.eye[1]).toBeCloseTo(2 + EYE_HEIGHT);
    expect(start.eye[2]).toBeCloseTo(3);

    const end = escapeCamera(phase, ctx({ t: 10 + JUMP_S }))!;
    expect(end.eye[0]).toBeCloseTo(5);
    expect(end.eye[1]).toBeCloseTo(0.2 + BOAT_EYE_HEIGHT);
    expect(end.eye[2]).toBeCloseTo(7);

    // The peak is 0.6 above the higher end.
    const mid = escapeCamera(phase, ctx({ t: 10 + JUMP_S / 2 }))!;
    expect(mid.eye[0]).toBeCloseTo(3);
    expect(mid.eye[1]).toBeCloseTo(2 + EYE_HEIGHT + 0.6);
    expect(mid.eye[2]).toBeCloseTo(5);
  });

  it("keeps a frozen player in the water at their spot, bobbing", () => {
    const phase = { kind: "frozen" as const, since: 9, x: 4, z: 6 };
    const still = escapeCamera(phase, ctx({ yaw: 0 }))!;
    expect(still.eye).toEqual([4, SWIM_EYE_HEIGHT, 6]);
    expect(still.target[0]).toBeCloseTo(4 + LOOK_DISTANCE);
    const bobbing = escapeCamera(
      phase,
      ctx({ bobTime: 0.5, reducedMotion: false })
    )!;
    expect(bobbing.eye[1]).toBeCloseTo(SWIM_EYE_HEIGHT + SWIM_BOB);
  });

  it("stays finite for any input", () => {
    const phase = startSwimming({ x: NaN, z: Infinity }, NaN, 0);
    const pose = escapeCamera(
      phase,
      ctx({ bobTime: NaN, reducedMotion: false })
    )!;
    expect([...pose.eye, ...pose.target].every(Number.isFinite)).toBe(true);
  });
});
