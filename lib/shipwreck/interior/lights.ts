import type { V2 } from "../walk/types";
import type { Room } from "./types";

/**
 * The lights inside (see README.md): the ship's power (the sim's
 * `frame.power`, flickering from 10° bow down, out at the break), times
 * each room's own wiring: its lamps flicker once the water over its floor
 * passes 0.3 m and die at 0.6 m. A torch comes on by itself in a dim room.
 */

/** Water over the floor where a room's lamps start to flicker (m). */
export const ROOM_FLICKER_FROM_M = 0.3;
/** Water over the floor where they go out (m). */
export const ROOM_DARK_AT_M = 0.6;
/** The torch comes on in a room whose power is under this. */
export const TORCH_BELOW = 0.35;

/** The sim's flicker (sim/run.ts `flicker`): mostly near full, some dips. */
function dip(k: number): number {
  const h = (((k * 2654435761) >>> 0) % 1000) / 1000;
  return h < 0.3 ? 0.15 + h : 0.85 + 0.15 * h;
}

/**
 * A room's light (0..1): the ship's `power` while the water over its floor
 * is under 0.3 m, deterministic flicker dips (keyed on the time `t`, s, and
 * the depth) from 0.3 to 0.6 m, and out from 0.6 m. A dry room (no depth,
 * NaN or negative) has the ship's power.
 */
export function roomPower(
  power: number,
  depthM: number,
  t = 0,
  soft = false
): number {
  if (!(depthM >= ROOM_FLICKER_FROM_M)) return power;
  if (depthM >= ROOM_DARK_AT_M) return 0;
  // Soft (hers): slower and keyed on coarser depth, so the lamps never
  // flash faster than about 3 Hz even while the water climbs.
  const key = soft
    ? Math.floor(t * SOFT_FLICKER_HZ) + Math.floor(depthM * 4) * 7919
    : Math.floor(t * 6) + Math.floor(depthM * 100) * 7919;
  return power * dip(key);
}

/** The slot rate of a soft room flicker (per second): 2.5 at most. */
export const SOFT_FLICKER_HZ = 2.5;

/** Her emergency flicker: none under this heel (deg)... */
export const EMERGENCY_FLICKER_FROM_DEG = 10;
/** ...about one dip a second from this heel on. */
export const EMERGENCY_FLICKER_FULL_DEG = 30;
/** The deepest a dip goes (the lamps are never black). */
export const EMERGENCY_DIP_MIN = 0.1;
/** A dip's length and its soft edges (s): short, never a strobe. */
const DIP_S = 0.2;
const DIP_EDGE_S = 0.05;

function hash(k: number, salt: number): number {
  return (((k * 2654435761 + salt * 40503) >>> 0) % 1000) / 1000;
}

/**
 * Her emergency lights' level (see README.md "Lights inside her"): the
 * lamps' multiplier, 1 when not dipped, while the ship's power is at the
 * emergency level (`power ≤ emergencyLight + 0.01`); with more power it
 * returns `power` itself (the caller has no dip to apply). From
 * `EMERGENCY_FLICKER_FROM_DEG` of heel it dips (deterministically in `t`,
 * s): one second at a time, a dip starts with a chance that grows from
 * none at 10° to certain at 30° (about one a second), 0.2 s long with soft
 * edges, at least 0.4 s from the next, so nothing flashes faster than
 * about 3 Hz. A dip goes down to 0.1 at the deepest, never black.
 */
export function emergencyFlicker(
  power: number,
  emergencyLight: number,
  t: number,
  heelDeg: number
): number {
  if (!(power <= emergencyLight + 0.01)) return power;
  const heel = Math.abs(heelDeg);
  const q = Math.min(
    1,
    Math.max(
      0,
      (heel - EMERGENCY_FLICKER_FROM_DEG) /
        (EMERGENCY_FLICKER_FULL_DEG - EMERGENCY_FLICKER_FROM_DEG)
    )
  );
  if (!(q > 0) || !Number.isFinite(t)) return 1;
  const w = Math.floor(t);
  if (hash(w, 1) >= q) return 1;
  // Within [0.05, 0.65] of the second: a dip never crosses into the next.
  const u = t - w - (0.05 + 0.6 * hash(w, 2));
  if (u < 0 || u > DIP_S) return 1;
  const floor = EMERGENCY_DIP_MIN + 0.35 * hash(w, 3);
  const edge = Math.min(1, u / DIP_EDGE_S, (DIP_S - u) / DIP_EDGE_S);
  return 1 - (1 - floor) * Math.max(0, edge);
}

/** Whether the torch is on in a room with this power. */
export function torchOn(roomPowerValue: number): boolean {
  return roomPowerValue < TORCH_BELOW;
}

/** A hall longer than this (m, along its axis) has its lamps in parts. */
export const LONG_ROOM_M = 12;
/** Each part of a long hall's lamps is at most this long (m). */
export const LIGHT_SEGMENT_M = 8;

/** A part of a long hall: its span along the axis (m) and its middle. */
export interface LightSegment {
  from: number;
  to: number;
  mid: V2;
}

/** A long hall's axis and its split into parts, or null for any other room. */
function segmentation(
  room: Room
): { p: V2; q: V2; len: number; n: number } | null {
  if (!room.axis) return null;
  const [p, q] = room.axis;
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (!(len > LONG_ROOM_M)) return null;
  return { p, q, len, n: Math.ceil(len / LIGHT_SEGMENT_M) };
}

/**
 * A long hall's lamps in parts (Scotland Road's 86 m), each going out by
 * the water at its own middle, so the dark creeps along the hall with the
 * water instead of the whole hall going out at once. Empty for any other
 * room (a stair, a short room): its lamps go by one depth.
 */
export function lightSegments(room: Room): LightSegment[] {
  if (room.ramp) return [];
  const g = segmentation(room);
  if (!g) return [];
  const { p, q, len, n } = g;
  const out: LightSegment[] = [];
  for (let i = 0; i < n; i += 1) {
    const from = (len * i) / n;
    const to = i === n - 1 ? len : (len * (i + 1)) / n;
    const t = (from + to) / 2 / len;
    out.push({
      from,
      to,
      mid: [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t],
    });
  }
  return out;
}

/** The part of a long hall over (x, y) (clamped to the ends), or 0. */
export function segmentAt(room: Room, x: number, y: number): number {
  const g = segmentation(room);
  if (!g) return 0;
  const { p, q, len, n } = g;
  const t = ((x - p[0]) * (q[0] - p[0]) + (y - p[1]) * (q[1] - p[1])) / len;
  const i = Math.floor((t / len) * n);
  return i <= 0 ? 0 : i >= n ? n - 1 : i;
}
