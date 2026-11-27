import { deckZAt } from "../places";
import type { ShipSpec } from "../ships/types";
import type { BodyPose } from "../sim/track";
import { compartmentTopZ, waterLevel, type VolumeSamples } from "../xray";
import type { Room } from "./types";

/**
 * The water inside (see README.md "Water inside"). A room on or above its
 * compartment's bulkhead tops floods from the sea: its water stands at the
 * sea's level. A room inside the watertight envelope holds its
 * compartment's level from the sim's fill (X-ray's `waterLevel`), never
 * above the sea. Allocation-free, so the scene can call it every frame.
 */

/** A room deeper than this under its bulkhead tops is inside the envelope. */
export const SEA_ROOM_BELOW_TOP_M = 1;

type Spec = Pick<ShipSpec, "decks" | "sheerZ" | "compartments">;

/** A room's floor (ship-frame z) at (x, y), as the walk map's `floorZ`. */
export function roomFloorZ(
  room: Pick<Room, "deck" | "raiseM" | "ramp">,
  x: number,
  y: number,
  spec: Pick<ShipSpec, "decks" | "sheerZ">
): number {
  const z = deckZAt(room.deck, x, spec) + (room.raiseM ?? 0);
  const ramp = room.ramp;
  if (!ramp) return z;
  const dx = ramp.to[0] - ramp.from[0];
  const dy = ramp.to[1] - ramp.from[1];
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) return z;
  const u = ((x - ramp.from[0]) * dx + (y - ramp.from[1]) * dy) / len2;
  return z - ramp.dropM * Math.max(0, Math.min(1, u));
}

/** The middle of a room's x range. */
function midX(room: Pick<Room, "outline">): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of room.outline) {
    if (p[0] < lo) lo = p[0];
    if (p[0] > hi) hi = p[0];
  }
  return (lo + hi) / 2;
}

/** The compartment holding the room's middle x (index), or -1. */
export function compartmentIndexOf(
  room: Pick<Room, "outline">,
  spec: Pick<ShipSpec, "compartments">
): number {
  const x = midX(room);
  const cs = spec.compartments;
  for (let i = 0; i < cs.length; i += 1)
    if (x >= cs[i].fromX && x < cs[i].toX) return i;
  return -1;
}

/**
 * Whether a room floods from the sea: its lowest floor point (over its
 * corners) is no more than 1 m under its compartment's bulkhead top at the
 * room's middle. A room outside every compartment floods from the sea.
 */
export function floodsFromSea(
  room: Pick<Room, "outline" | "deck" | "raiseM" | "ramp">,
  spec: Spec
): boolean {
  const i = compartmentIndexOf(room, spec);
  if (i < 0) return true;
  let lowest = Infinity;
  for (const [x, y] of room.outline)
    lowest = Math.min(lowest, roomFloorZ(room, x, y, spec));
  const top = compartmentTopZ(spec.compartments[i], midX(room));
  return lowest >= top - SEA_ROOM_BELOW_TOP_M;
}

export interface RoomWaterContext {
  spec: Spec;
  /** The pose of her whole piece. */
  pose: BodyPose;
  /** The sea's earth z (flat 0 for the walk). */
  seaZ?: number;
  /**
   * A compartment room's compartment: X-ray's samples (the caller caches
   * them per compartment) and the sim's fill (0..1).
   */
  samples?: VolumeSamples;
  fill?: number;
}

/**
 * The earth z the water in a room is heading for: the sea for a sea room
 * (`water: "sea"`, or the bulkhead rule), else its compartment's level,
 * never above the sea (-Infinity when dry).
 */
export function roomWaterTarget(room: Room, ctx: RoomWaterContext): number {
  const sea = ctx.seaZ ?? 0;
  const mode =
    room.water ?? (floodsFromSea(room, ctx.spec) ? "sea" : "compartment");
  if (mode === "sea") return sea;
  if (!ctx.samples || ctx.fill === undefined)
    throw new Error(`room ${room.id} needs its compartment's samples and fill`);
  return Math.min(sea, waterLevel(ctx.samples, ctx.pose, ctx.fill));
}
