import {
  JUMP_S,
  type EvacuationPlan,
} from "@/lib/ship-builder/crowd/evacuation";
import type { EscapePhase } from "@/lib/ship-builder/walk/escape";
import { EYE_HEIGHT, LOOK_DISTANCE } from "./walkCamera";

/** A swimmer's eyes sit this far above the water. */
export const SWIM_EYE_HEIGHT = 0.12;
/** How far a swimmer's eyes rise and fall on the swell… */
export const SWIM_BOB = 0.04;
/** …this many times a second. */
export const SWIM_BOB_HZ = 0.5;
/**
 * Seated in a boat, the eyes are this far above its pose: high enough that
 * the boat's own hull stays at the bottom of the view.
 */
export const BOAT_EYE_HEIGHT = 0.5;
/**
 * Seated, the view tips down this far (radians), so the boat's near side
 * shows along the bottom and the ship fills the middle.
 */
export const SEATED_PITCH = 0.06;
/**
 * Seated, the eyes sit this far back from the boat's centre (away from where
 * they look), so the boat's near gunwale comes into the bottom of the view.
 */
export const SEAT_BACK = 0.4;
/** A jump's peak is this far above the higher of its two ends. */
export const JUMP_PEAK = 0.6;

export interface EscapeCameraContext {
  plan: Pick<EvacuationPlan, "launches" | "boatPoseAt"> | null;
  /** Sim seconds (the trial clock). */
  t: number;
  /** The walk's yaw: where a seated or frozen player looks. */
  yaw: number;
  /** Seconds for the swell's bob (the scene clock). */
  bobTime: number;
  reducedMotion: boolean;
}

export interface EscapeCameraPose {
  /** World position of the eye. */
  eye: [number, number, number];
  /** Where it looks: level with it, or tipped down when seated. */
  target: [number, number, number];
}

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

function looking(
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch = 0
): EscapeCameraPose {
  const ex = finiteOr(x, 0);
  const ey = finiteOr(y, SWIM_EYE_HEIGHT);
  const ez = finiteOr(z, 0);
  const heading = finiteOr(yaw, 0);
  return {
    eye: [ex, ey, ez],
    target: [
      ex + Math.cos(heading) * LOOK_DISTANCE,
      ey - Math.tan(pitch) * LOOK_DISTANCE,
      ez + Math.sin(heading) * LOOK_DISTANCE,
    ],
  };
}

function bobOf(ctx: EscapeCameraContext): number {
  if (ctx.reducedMotion) return 0;
  const time = finiteOr(ctx.bobTime, 0);
  return SWIM_BOB * Math.sin(2 * Math.PI * SWIM_BOB_HZ * time);
}

/** Where the eyes sit in a boat at `t`, or null for a boat the plan lacks. */
function seatOf(
  ctx: EscapeCameraContext,
  boatId: string
): { x: number; y: number; z: number } | null {
  const launch = ctx.plan?.launches.find((l) => l.boatId === boatId);
  if (!ctx.plan || !launch) return null;
  const { position } = ctx.plan.boatPoseAt(launch, ctx.t);
  return { x: position.x, y: position.y + BOAT_EYE_HEIGHT, z: position.z };
}

/**
 * The player's view once they have left the deck, in the world frame: low in
 * the water and bobbing while swimming (or frozen, where they stopped),
 * seated in the boat as it lowers, rows out and bobs (looking a little
 * down, so the boat shows below the ship), or leaping along an arc
 * from the deck into a raft. Null while aboard (the walk's own eyes drive the
 * camera) or for a boat the plan does not know. Finite for any input.
 */
export function escapeCamera(
  phase: EscapePhase,
  ctx: EscapeCameraContext
): EscapeCameraPose | null {
  switch (phase.kind) {
    case "aboard":
      return null;
    case "swimming": {
      const { swimmer } = phase;
      return looking(
        swimmer.x,
        SWIM_EYE_HEIGHT + bobOf(ctx),
        swimmer.z,
        swimmer.yaw
      );
    }
    case "frozen":
      return looking(phase.x, SWIM_EYE_HEIGHT + bobOf(ctx), phase.z, ctx.yaw);
    case "in-boat": {
      const seat = seatOf(ctx, phase.boatId);
      if (!seat) return null;
      // The walk's yaw starts facing back at the ship (see escapeStep).
      const heading = finiteOr(ctx.yaw, 0);
      return looking(
        seat.x - Math.cos(heading) * SEAT_BACK,
        seat.y,
        seat.z - Math.sin(heading) * SEAT_BACK,
        heading,
        SEATED_PITCH
      );
    }
    case "jumping": {
      const seat = seatOf(ctx, phase.boatId);
      if (!seat) return null;
      const from = {
        x: phase.from.x,
        y: phase.from.y + EYE_HEIGHT,
        z: phase.from.z,
      };
      const k = Math.min(
        1,
        Math.max(0, finiteOr((ctx.t - phase.since) / JUMP_S, 0))
      );
      const lerp = (a: number, b: number) => a + (b - a) * k;
      const peak = Math.max(from.y, seat.y) + JUMP_PEAK;
      // A parabola through both ends that tops out at the peak midway.
      const lift = 4 * k * (1 - k) * (peak - (from.y + seat.y) / 2);
      return looking(
        lerp(from.x, seat.x),
        lerp(from.y, seat.y) + lift,
        lerp(from.z, seat.z),
        ctx.yaw
      );
    }
  }
}
