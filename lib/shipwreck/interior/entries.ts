import type { ShipSpec } from "../ships/types";
import type { BodyPose } from "../sim/track";
import { shipToEarth, type V3 } from "../walk/slope";
import { floorZ, WALK_WADE_STOP_M, type WalkMap } from "../walk/types";
import type { InteriorMap, Room, RoomEntry } from "./types";

/**
 * Starting a walk in a room from the camera picker (1.16, see README.md
 * "Start inside"). Pure: the caller passes the sim frame and the rooms'
 * water targets (`roomWaterTargets(spec)`), so the rules never run the
 * sim. A room you cannot stand in right now is left out, never greyed.
 */

/** What the picker knows right now. */
export interface EntryContext {
  /** The ship's walk map, rooms merged in (`walkMapFor`). */
  map: WalkMap;
  spec: ShipSpec;
  /** The sampled frame now (null before the night has one). */
  frame: { bodies: readonly BodyPose[]; water: readonly number[] } | null;
  /** Each room's water (earth z, −Infinity dry): `roomWaterTargets(spec)`. */
  target: (room: Room, pose: BodyPose, fill: readonly number[]) => number;
}

/**
 * Water over the entry's spot (m over the floor; negative when dry) on her
 * whole piece, as the walker would wade it.
 */
export function entryDepthM(
  entry: RoomEntry,
  room: Room,
  pose: BodyPose,
  ctx: Pick<EntryContext, "map" | "spec" | "target"> & {
    fill: readonly number[];
  }
): number {
  const [x, y] = entry.at;
  const feet: V3 = shipToEarth(pose, [
    x,
    y,
    floorZ(ctx.map, entry.room, x, ctx.spec, y),
  ]);
  return ctx.target(room, pose, ctx.fill) - feet[2];
}

/**
 * The entries you can start in now, in their order: none before the
 * night has a frame or once she has broken (the rooms close), and none
 * whose spot is under more than wading depth (`WALK_WADE_STOP_M`).
 */
export function openEntries(
  interior: InteriorMap,
  ctx: EntryContext
): RoomEntry[] {
  const entries = interior.entries ?? [];
  const frame = ctx.frame;
  if (entries.length === 0 || !frame) return [];
  if (frame.bodies.some((b) => b.part !== "whole")) return [];
  const pose = frame.bodies.find((b) => b.part === "whole");
  if (!pose) return [];
  const sub = { ...ctx, fill: frame.water };
  return entries.filter((e) => {
    const room = interior.rooms.find((r) => r.id === e.room);
    if (!room || room.noWalk) return false;
    return entryDepthM(e, room, pose, sub) <= WALK_WADE_STOP_M;
  });
}
