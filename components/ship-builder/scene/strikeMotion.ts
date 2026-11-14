import { ICEBERG_IMPACT_S } from "@/lib/ship-builder/sim/flooding";
import type { StrikeKind } from "@/lib/ship-builder/sim/types";

/** Where on the hull she was struck, from cells-from-bow. */
export type StruckEnd = "bow" | "side" | "stern";

/** A hit this close to either end counts as that end, not the side. */
const END_CELLS = 0.75;

export function struckEnd(impactX: number, length: number): StruckEnd {
  if (impactX <= END_CELLS) return "bow";
  if (impactX >= length - END_CELLS) return "stern";
  return "side";
}

/**
 * +1 at the bow, 0 amidships, -1 at the stern: which end a hit lifts or
 * shoves, and how hard.
 */
export function leverOf(impactX: number, length: number): number {
  const middle = length / 2;
  if (middle <= 0) return 0;
  return Math.max(-1, Math.min(1, (middle - impactX) / middle));
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Extra pose on top of the sim's: a lift (world units) and two angles. */
export interface StrikePose {
  y: number;
  roll: number;
  pitch: number;
}

/** How long the island's tilt takes to ease off once she starts to sink. */
export const SLIDE_OFF_S = 4;

/**
 * What a strike adds to her pose at `time` (sim seconds), scene only.
 *
 * - A mine heaves her up and shakes her, harder at the struck end, then
 *   settles in a couple of seconds.
 * - An island jolts her, then she rides up onto the rocks: the struck end
 *   lifts and a side hit heels her away from the shore. She stays perched
 *   there unless she starts to sink, when she slides back off.
 * - An iceberg adds nothing (the sim's pose says it all).
 */
export function strikePose(
  strike: StrikeKind,
  impactX: number,
  length: number,
  time: number,
  sinkingAt: number | null,
  out: StrikePose
): StrikePose {
  out.y = 0;
  out.roll = 0;
  out.pitch = 0;
  const since = time - ICEBERG_IMPACT_S;
  if (strike === "iceberg" || since < 0) return out;
  const lever = leverOf(impactX, length);

  if (strike === "mine") {
    const fade = Math.exp(-2.4 * since);
    out.y = 0.6 * fade * Math.cos(since * 7);
    out.roll = 0.12 * fade * Math.sin(since * 11);
    out.pitch = 0.09 * lever * fade * Math.cos(since * 6);
    return out;
  }

  // Island: a sharp shudder, then she rides up and stays there.
  const shudder = 0.05 * Math.exp(-4 * since) * Math.sin(since * 26);
  const perched = smoothstep(0, 0.9, since);
  const slidOff =
    sinkingAt === null
      ? 0
      : smoothstep(sinkingAt, sinkingAt + SLIDE_OFF_S, time);
  const hold = perched * (1 - slidOff);
  const end = struckEnd(impactX, length);
  out.pitch = shudder + 0.07 * lever * hold;
  out.roll = shudder * 0.7 + (end === "side" ? -0.1 * hold : 0);
  out.y = 0.3 * hold * Math.max(Math.abs(lever), end === "side" ? 0.6 : 0);
  return out;
}

/** The island of an island trial: a fixed size, in cells. */
export const TRIAL_ISLAND_RADIUS = 8;
/** How far the island (or mine) starts from where it ends up, in cells. */
export const STRIKE_APPROACH = 14;

/**
 * How far the island or mine still is from where it meets her, in cells, at
 * `time`. It closes in as she sails onto it, reaching 0 at the impact. An
 * island then stays put (she is aground); a mine is gone (see `isMineGone`).
 */
export function approachLeft(time: number): number {
  if (time >= ICEBERG_IMPACT_S) return 0;
  const t = Math.max(0, time) / ICEBERG_IMPACT_S;
  // Eases out, so the last stretch looks like her slowing as she grinds in.
  return STRIKE_APPROACH * (1 - t) * (1 - t * 0.35);
}

export function isMineGone(time: number): boolean {
  return time >= ICEBERG_IMPACT_S;
}

/**
 * Where the island or mine rests at the impact, in the ship's world frame
 * (bow toward +X, starboard toward +Z), and which way it came in from (a unit
 * vector it moves along, pointing away from the ship).
 */
export function strikeRest(
  strike: "mine" | "island",
  impactX: number,
  length: number,
  beam: number
): { x: number; z: number; awayX: number; awayZ: number } {
  const end = struckEnd(impactX, length);
  const reach = strike === "island" ? TRIAL_ISLAND_RADIUS * 0.85 : 0.6;
  const half = length / 2;
  if (end === "bow") {
    return { x: half + reach, z: 0, awayX: 1, awayZ: 0 };
  }
  if (end === "stern") {
    // She backed onto it, or it came round her stern: it rests astern.
    return { x: -half - reach, z: 0, awayX: -1, awayZ: 0 };
  }
  // Side: it comes in from ahead, along the starboard side.
  return { x: half - impactX, z: beam / 2 + reach, awayX: 1, awayZ: 0 };
}

const GRAVITY = 9.8;
/** A thrown part bobs on the surface this long before it sinks. */
const FLOAT_S = 1.6;
const SINK_SPEED = 0.7;
/** Below this it is gone (out of sight under the waves). */
export const PIECE_GONE_Y = -10;

/** Where a thrown part is and how it is turned, in the water's frame. */
export interface PiecePose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  visible: boolean;
}

/** A steady -1..1 number per (slot, salt). */
function pieceNoise(slot: number, salt: number): number {
  const x = Math.sin(slot * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * A part the mine throws off: launched from `from` (its world place on the
 * ship) away from the blast at `blastX, blastZ`, tumbling up and over, then
 * slapping into the sea, bobbing a moment and sinking. A function of the time
 * since the blast alone, so scrubbing and replays show the right moment.
 */
export function blastPiecePose(
  slot: number,
  from: { x: number; y: number; z: number },
  blastX: number,
  blastZ: number,
  seconds: number,
  out: PiecePose
): PiecePose {
  out.x = from.x;
  out.y = from.y;
  out.z = from.z;
  out.rx = 0;
  out.ry = 0;
  out.rz = 0;
  out.visible = seconds >= 0;
  if (seconds <= 0) return out;

  const dx = from.x - blastX;
  const dz = from.z - blastZ;
  const away = Math.hypot(dx, dz) || 1;
  const push = 2.5 + 2.5 * ((pieceNoise(slot, 1) + 1) / 2);
  const vx = (dx / away) * push + pieceNoise(slot, 2) * 1.5;
  const vz = (dz / away) * push + pieceNoise(slot, 3) * 2.5;
  const vy = 6 + 5 * ((pieceNoise(slot, 4) + 1) / 2);
  const spinX = pieceNoise(slot, 5) * 6;
  const spinY = pieceNoise(slot, 6) * 4;
  const spinZ = pieceNoise(slot, 7) * 6;

  // When the throw comes back down to the sea (y = 0).
  const landAt =
    (vy + Math.sqrt(vy * vy + 2 * GRAVITY * Math.max(0, from.y))) / GRAVITY;
  const flying = Math.min(seconds, landAt);
  out.x = from.x + vx * flying;
  out.z = from.z + vz * flying;
  out.y = from.y + vy * flying - 0.5 * GRAVITY * flying * flying;
  out.rx = spinX * flying;
  out.ry = spinY * flying;
  out.rz = spinZ * flying;
  if (seconds <= landAt) return out;

  const after = seconds - landAt;
  // A little drift on the water, then down it goes.
  const drift = Math.min(after, FLOAT_S) * 0.25;
  out.x += vx * drift;
  out.z += vz * drift;
  const bob = after < FLOAT_S ? Math.sin(after * 6) * 0.08 : 0;
  out.y = -0.25 + bob - Math.max(0, after - FLOAT_S) * SINK_SPEED;
  out.rx += Math.min(after, FLOAT_S) * spinX * 0.1;
  out.visible = out.y > PIECE_GONE_Y;
  return out;
}

/**
 * Boom!: every bomb that has gone off gives her a jolt, a smaller twin of a
 * mine's, fading over a second or two. Added on top of whatever `out` holds.
 */
export function addBombJolts(
  bombs: readonly { at: number; impactX: number }[],
  length: number,
  time: number,
  out: StrikePose
): StrikePose {
  for (const bomb of bombs) {
    const since = time - bomb.at;
    if (since < 0 || since > BOMB_JOLT_S) continue;
    const lever = leverOf(bomb.impactX, length);
    const fade = Math.exp(-3 * since);
    out.y += 0.3 * fade * Math.cos(since * 8);
    out.roll += 0.07 * fade * Math.sin(since * 12);
    out.pitch += 0.06 * lever * fade * Math.cos(since * 7);
  }
  return out;
}

/** A bomb's jolt is over this long after it goes off (sim seconds). */
export const BOMB_JOLT_S = 2.5;
