import type { ShipSpec } from "../ships/types";
import type { BodyPose, SimFrame } from "../sim/track";
import type { InteriorMap, Room } from "./types";
import { roomFloorZ } from "./water";

/**
 * Slow flooding (see README.md "Seep"): a room with `seep: true` (the
 * Concordia's low rooms) takes the sea through her doors and vents instead
 * of filling to it at once. Once the sea is over the room's lowest floor
 * point, the water over that point starts at nothing and rises toward the
 * sea's depth there at most `ROOM_SEEP_M_PER_S` per shown second, never
 * above the sea (it never drains). The level is a
 * plane in earth z (that point's height plus the depth), so the lean makes
 * the water gather on the low side and creep across the floor by itself.
 *
 * The levels are integrated once over a run's frames, so the level at a
 * time is a lookup: the same whether the clock played to it or was
 * dragged there. Pure, no three.js.
 */

/** How fast a seeping room's water climbs (m per shown second). */
export const ROOM_SEEP_M_PER_S = 0.005;

/** The walk's sea (earth z, flat). */
const SEA_Z = 0;

type Spec = Pick<ShipSpec, "decks" | "sheerZ">;

export interface SeepTable {
  /** Each frame's time (shown s), in order. */
  times: number[];
  /**
   * Per room (its index in `interior.rooms`): its level at each frame
   * (earth z, −Infinity dry), or undefined for a room without `seep`.
   */
  levels: (number[] | undefined)[];
  /** A room's id → its index in `levels`. */
  index: ReadonlyMap<string, number>;
  /** Per seep room: its floor corners, ship frame (x, y, z) triples. */
  corners: (Float64Array | undefined)[];
  /** Per seep room: the water over its lowest point (m; 0 dry), per frame. */
  depths: (number[] | undefined)[];
}

/** An empty table for the interior's rooms (no frames yet). */
function emptyTable(interior: InteriorMap, spec: Spec): SeepTable {
  const index = new Map<string, number>();
  const levels: (number[] | undefined)[] = [];
  const corners: (Float64Array | undefined)[] = [];
  const depths: (number[] | undefined)[] = [];
  interior.rooms.forEach((room, i) => {
    index.set(room.id, i);
    levels.push(room.seep ? [] : undefined);
    corners.push(room.seep ? floorCorners(room, spec) : undefined);
    depths.push(room.seep ? [] : undefined);
  });
  return { times: [], levels, index, corners, depths };
}

function floorCorners(room: Room, spec: Spec): Float64Array {
  const out = new Float64Array(room.outline.length * 3);
  room.outline.forEach(([x, y], i) => {
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = roomFloorZ(room, x, y, spec);
  });
  return out;
}

/** The earth z of a room's lowest floor corner under the pose. */
function lowestZ(c: Float64Array, pose: BodyPose): number {
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  const cr = Math.cos(pose.roll);
  const sr = Math.sin(pose.roll);
  let low = Infinity;
  for (let i = 0; i < c.length; i += 3) {
    const z1 = sr * c[i + 1] + cr * c[i + 2];
    const z = pose.z - sp * c[i] + cp * z1;
    if (z < low) low = z;
  }
  return low;
}

/** The pose of her whole piece in a frame, or null (she has broken). */
function wholeOf(frame: SimFrame): BodyPose | null {
  for (let i = 0; i < frame.bodies.length; i += 1)
    if (frame.bodies[i].part === "whole") return frame.bodies[i];
  return null;
}

/**
 * Adds the frames the table has not seen yet (a track still computing
 * grows; the table follows). A frame without her whole piece (she broke:
 * the rooms are closed) holds the last level.
 */
export function extendSeep(
  table: SeepTable,
  frames: readonly SimFrame[]
): void {
  const { times, levels, corners, depths } = table;
  for (let k = times.length; k < frames.length; k += 1) {
    const frame = frames[k];
    const dt = k > 0 ? Math.max(0, frame.t - times[k - 1]) : 0;
    const pose = wholeOf(frame);
    for (let r = 0; r < levels.length; r += 1) {
      const lv = levels[r];
      if (!lv) continue;
      const dp = depths[r]!;
      const prevD = k > 0 ? dp[k - 1] : 0;
      if (!pose) {
        lv.push(k > 0 ? lv[k - 1] : -Infinity);
        dp.push(prevD);
        continue;
      }
      const low = lowestZ(corners[r]!, pose);
      const seaDepth = SEA_Z - low;
      const wasWet = k > 0 && lv[k - 1] !== -Infinity;
      if (!wasWet && !(seaDepth > 0)) {
        // The sea has not reached the lowest point yet: dry.
        lv.push(-Infinity);
        dp.push(0);
        continue;
      }
      // Just wet: nothing yet. Else up by the seep while the sea is over
      // the water; once in, the water stays (it never drains) but its
      // plane is never above the sea.
      const d = !wasWet
        ? 0
        : seaDepth > prevD
          ? Math.min(seaDepth, prevD + ROOM_SEEP_M_PER_S * dt)
          : prevD;
      lv.push(Math.min(SEA_Z, low + d));
      dp.push(d);
    }
    times.push(frame.t);
  }
}

/**
 * The seep levels of a run's frames (each frame's level for every room
 * with `seep`, none for any other room). Pure and deterministic.
 */
export function seepLevels(
  interior: InteriorMap,
  frames: readonly SimFrame[],
  spec: Spec
): SeepTable {
  const table = emptyTable(interior, spec);
  extendSeep(table, frames);
  return table;
}

const cache = new WeakMap<readonly SimFrame[], SeepTable>();

/**
 * The table for a track's frames, built the first time it is asked and
 * extended as the frames grow (the scene and the walker share it): a
 * length check each call, nothing allocated once built.
 */
export function seepFor(
  interior: InteriorMap,
  frames: readonly SimFrame[],
  spec: Spec
): SeepTable {
  let table = cache.get(frames);
  if (!table || table.index.size !== interior.rooms.length) {
    table = emptyTable(interior, spec);
    cache.set(frames, table);
  }
  if (table.times.length !== frames.length) extendSeep(table, frames);
  return table;
}

/**
 * A seep room's water at shown time `t` (earth z, −Infinity dry): its level
 * at the frame at or before `t`, moving linearly to the next (a lookup,
 * never state). NaN for a room without `seep` (absent from the table).
 */
export function seepLevelAt(
  table: SeepTable,
  roomIndex: number,
  t: number
): number {
  const lv = table.levels[roomIndex];
  if (!lv) return NaN;
  const times = table.times;
  const n = times.length;
  if (n === 0 || !(t > times[0])) return n === 0 ? -Infinity : lv[0];
  if (t >= times[n - 1]) return lv[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }
  const a = lv[lo];
  const b = lv[hi];
  // Dry until the frame that first wets it.
  if (a === -Infinity) return -Infinity;
  const span = times[hi] - times[lo];
  return span > 0 ? a + ((b - a) * (t - times[lo])) / span : a;
}

/**
 * A room's seep water for the scene (earth z, −Infinity dry) at shown time
 * `t`: `seepFor` and `seepLevelAt` in one. NaN for a room without `seep`
 * (or while the track has no frames): the caller uses its usual target.
 */
export function seepTarget(
  interior: InteriorMap,
  frames: readonly SimFrame[],
  spec: Spec,
  roomId: string,
  t: number
): number {
  if (frames.length === 0) return NaN;
  const table = seepFor(interior, frames, spec);
  const i = table.index.get(roomId);
  return i === undefined ? NaN : seepLevelAt(table, i, t);
}
