import type { ShipId } from "@/lib/shipwreck/ships/types";
import type { SimTrack } from "@/lib/shipwreck/sim/track";
import type { BodyPose } from "@/lib/shipwreck/sim/track";

/**
 * Camera maths with no three.js: points are [x, y, z] in three.js axes
 * (x forward along her heading, y up, z to starboard), ship-frame points
 * are [x forward, y port, z up from the keel].
 */

export type V3 = [number, number, number];

/** A ship-frame point under a sim pose, in three.js axes. */
export function shipToThree(pose: BodyPose, p: readonly number[]): V3 {
  const [x, y, z] = p;
  const cy = Math.cos(pose.yaw);
  const sy = Math.sin(pose.yaw);
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  const cr = Math.cos(pose.roll);
  const sr = Math.sin(pose.roll);
  // Rx(roll)
  const y1 = cr * y - sr * z;
  const z1 = sr * y + cr * z;
  // Ry(pitch): + pitch puts the bow (+x) down
  const x2 = cp * x + sp * z1;
  const z2 = -sp * x + cp * z1;
  // Rz(yaw)
  const x3 = cy * x2 - sy * y1;
  const y3 = sy * x2 + cy * y1;
  const ex = pose.x + x3;
  const ey = pose.y + y3;
  const ez = pose.z + z2;
  return [ex, ez, -ey];
}

/**
 * One step of a critically damped spring (no overshoot), per axis.
 * `omega` is the stiffness (1/s): larger is faster. Mutates and returns
 * `pos` and `vel`.
 */
export function dampSpring(
  pos: number[],
  vel: number[],
  target: readonly number[],
  omega: number,
  dt: number
): void {
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (let i = 0; i < pos.length; i += 1) {
    const change = pos[i] - target[i];
    const temp = (vel[i] + omega * change) * dt;
    vel[i] = (vel[i] - omega * temp) * exp;
    pos[i] = target[i] + (change + temp) * exp;
  }
}

/** A box region the camera must stay out of (ship frame: x, y, z ranges). */
export interface HullBox {
  x: [number, number];
  y: [number, number];
  z: [number, number];
}

/** The Titanic's hull boxes (1.0). */
export const HULL_BOXES: readonly HullBox[] = [
  // The hull to C deck, then the long superstructure to the boat deck.
  { x: [-138.5, 130], y: [-14.2, 14.2], z: [-0.5, 21] },
  { x: [-126, 105], y: [-13, 13], z: [21, 29.3] },
];

/**
 * The Lusitania's (lib/shipwreck/ships/lusitania.ts): the hull from the
 * counter's end (-123.2) to the stem (116.6), 26.7 m across, to the
 * Shelter deck with its sheer; then the house from the second class
 * house's after end (-104.3) forward, with the foredeck plated up to B,
 * to the boat deck's top (24 m and its houses).
 */
export const LUSITANIA_HULL_BOXES: readonly HullBox[] = [
  { x: [-123.4, 116.8], y: [-13.5, 13.5], z: [-0.5, 19.8] },
  { x: [-104.3, 116.8], y: [-13.2, 13.2], z: [19.8, 25.4] },
];

/** The hull boxes of a ship (the camera's bounds and the double-tap proxies). */
export function hullBoxesFor(ship: ShipId): readonly HullBox[] {
  return ship === "lusitania" ? LUSITANIA_HULL_BOXES : HULL_BOXES;
}

function insideBox(p: readonly number[], b: HullBox, margin: number): boolean {
  return (
    p[0] > b.x[0] - margin &&
    p[0] < b.x[1] + margin &&
    p[1] > b.y[0] - margin &&
    p[1] < b.y[1] + margin &&
    p[2] > b.z[0] - margin &&
    p[2] < b.z[1] + margin
  );
}

/**
 * Keeps a ship-frame camera point out of the hull boxes and above the sea
 * floor: through the nearest face that leaves it outside every box and at
 * least `clearance` over the floor (a hull lying on its side has a face on
 * the floor, which `pushOutOfHull` could push it through). Unchanged when
 * it is outside; `pushOutOfHull`'s answer when no face will do.
 */
export function keepClear(
  p: V3,
  pose: BodyPose,
  seaDepthM: number,
  boxes: readonly HullBox[],
  margin = 0.6,
  clearance = 2
): V3 {
  if (!boxes.some((b) => insideBox(p, b, margin))) return [p[0], p[1], p[2]];
  const floor = -seaDepthM + clearance;
  let best: V3 | null = null;
  let bestD = Infinity;
  for (const b of boxes) {
    if (!insideBox(p, b, margin)) continue;
    const faces: [number, number][] = [
      [0, b.x[0] - margin],
      [0, b.x[1] + margin],
      [1, b.y[0] - margin],
      [1, b.y[1] + margin],
      [2, b.z[0] - margin],
      [2, b.z[1] + margin],
    ];
    for (const [axis, to] of faces) {
      const d = Math.abs(to - p[axis]);
      if (d >= bestD) continue;
      const q: V3 = [p[0], p[1], p[2]];
      // Just past the face, so the margin's own test counts it outside.
      q[axis] = to + Math.sign(to - p[axis]) * 1e-6;
      if (boxes.some((o) => insideBox(q, o, margin))) continue;
      if (shipToThree(pose, q)[1] < floor) continue;
      best = q;
      bestD = d;
    }
  }
  return best ?? pushOutOfHull(p, margin, boxes);
}

/**
 * Pushes a ship-frame point out of the hull boxes through the nearest face
 * (with `margin`). Returns the point unchanged when it is outside.
 */
export function pushOutOfHull(
  p: V3,
  margin = 0.6,
  boxes: readonly HullBox[] = HULL_BOXES
): V3 {
  const out: V3 = [p[0], p[1], p[2]];
  for (const b of boxes) {
    const inside =
      out[0] > b.x[0] - margin &&
      out[0] < b.x[1] + margin &&
      out[1] > b.y[0] - margin &&
      out[1] < b.y[1] + margin &&
      out[2] > b.z[0] - margin &&
      out[2] < b.z[1] + margin;
    if (!inside) continue;
    const moves: [number, number][] = [
      [0, b.x[0] - margin - out[0]],
      [0, b.x[1] + margin - out[0]],
      [1, b.y[0] - margin - out[1]],
      [1, b.y[1] + margin - out[1]],
      [2, b.z[0] - margin - out[2]],
      [2, b.z[1] + margin - out[2]],
    ];
    let best = moves[0];
    for (const m of moves) if (Math.abs(m[1]) < Math.abs(best[1])) best = m;
    out[best[0]] += best[1];
  }
  return out;
}

/** How much further back a preset stands on a screen this shape (w / h). */
export function portraitPullBack(aspect: number): number {
  if (!(aspect > 0) || aspect >= 1.2) return 1;
  return Math.min(1.9, 1.2 / aspect);
}

/** Keeps a three.js point above the sea floor (three y = -depth). */
export function clampAboveFloor(p: V3, seaDepthM: number, clearance = 2): V3 {
  return [p[0], Math.max(p[1], -seaDepthM + clearance), p[2]];
}

/** The camera's near plane for a view this far from its target. */
export function nearFor(distance: number): number {
  return Math.min(4, Math.max(0.1, distance * 0.02));
}

// ---------------------------------------------------------------------------
// Preset and cinematic shots

export type ShotId =
  | "establishing"
  | "along-hull"
  | "lifeboat"
  | "wide-starboard"
  | "break"
  | "plunge"
  | "follow-bow"
  | "wreck"
  // The Lusitania's afternoon.
  | "afternoon"
  | "hit"
  | "list"
  | "boats"
  | "port-boats"
  | "bow-down"
  | "grounded"
  | "grounded-below"
  | "on-floor";

export interface View {
  pos: V3;
  target: V3;
}

export interface ShotContext {
  /** Shown time and wall-clock seconds (for slow drifts while paused). */
  t: number;
  wall: number;
  bodies: readonly BodyPose[];
  breakX: number | null;
  seaDepthM: number;
  /** The ship on the stage (default the Titanic). */
  ship?: ShipId;
  /** Ship-frame x where the torpedo struck (her shots aim there). */
  hitX?: number;
}

function body(
  ctx: ShotContext,
  part: "whole" | "bow" | "stern"
): BodyPose | null {
  return ctx.bodies.find((b) => b.part === part) ?? null;
}

/** The body holding the stern (whole or stern). */
function sternBody(ctx: ShotContext): BodyPose {
  return body(ctx, "stern") ?? body(ctx, "whole") ?? ctx.bodies[0];
}

/** The body holding the bow (whole or bow). */
function bowBody(ctx: ShotContext): BodyPose {
  return body(ctx, "bow") ?? body(ctx, "whole") ?? ctx.bodies[0];
}

/** The classic view: low on the water off the port quarter, drifting. */
export function lifeboatView(ctx: ShotContext, distance = 420): View {
  const drift = Math.sin(ctx.t / 900) * 12 + ctx.wall * 0.15;
  const s = sternBody(ctx);
  const tgt = shipToThree(s, [-10, 0, 14]);
  // Keep looking at the surface where she went down, a little above the
  // ship so the rockets' bursts are in the frame.
  // (The Lusitania fired none: just over her. Her boats got away from
  // the starboard side, so her boat camera is off the starboard quarter.)
  const lusitania = ctx.ship === "lusitania";
  tgt[1] = Math.max(tgt[1], 6) + (lusitania ? 6 : 22);
  const a = ((lusitania ? 145 : 215) * Math.PI) / 180 + drift / distance;
  // Around where she is (the hull drifts a little through the night).
  const o = shipToThree(s, [-60, 0, 10]);
  return {
    pos: [
      o[0] + Math.cos(a) * distance,
      2.2 + Math.sin(ctx.wall * 0.7) * 0.15,
      o[2] + Math.sin(a) * distance,
    ],
    target: tgt,
  };
}

/** Follows the bow down (under water), then circles the wreck. */
export function underwaterView(ctx: ShotContext): View {
  if (ctx.ship === "lusitania") return lusitaniaUnderwater(ctx);
  const b = bowBody(ctx);
  const mid = ctx.breakX !== null && b.part === "bow" ? ctx.breakX + 70 : 60;
  const tgt = shipToThree(b, [mid, 0, 6]);
  const floor = -ctx.seaDepthM;
  const onFloor = tgt[1] < floor + 60;
  if (onFloor) {
    const a = 0.9 + ctx.wall * 0.04;
    return {
      pos: [
        tgt[0] + Math.cos(a) * 150,
        Math.max(floor + 30, tgt[1] + 34),
        tgt[2] + Math.sin(a) * 150,
      ],
      target: tgt,
    };
  }
  const pos: V3 = [tgt[0] - 60, tgt[1] - 10, tgt[2] + 170];
  pos[1] = Math.min(pos[1], -4);
  return { pos, target: tgt };
}

/** Which scripted shot plays at `t` (cinematic camera). */
export function cinematicShot(
  track: Pick<SimTrack, "events" | "brokeAtT" | "sankAtT">,
  t: number,
  ship: ShipId = "titanic",
  /** False for a run with no holes (the title's calm ship). */
  hit = true
): ShotId {
  if (ship === "lusitania") return hit ? lusitaniaShot(track, t) : "afternoon";
  const firstOf = (kind: string): number | null => {
    for (const e of track.events) if (e.kind === kind) return e.t;
    return null;
  };
  const landed = firstOf("bow-lands");
  if (landed !== null && t >= landed - 4) return "wreck";
  if (track.sankAtT !== null && t >= track.sankAtT + 8) return "follow-bow";
  if (track.sankAtT !== null && t >= track.sankAtT - 40) return "plunge";
  if (track.brokeAtT !== null && t >= track.brokeAtT - 60) return "break";
  const lastBoat = firstOf("last-boat");
  if (lastBoat !== null && t >= lastBoat) return "wide-starboard";
  const rocket = firstOf("rocket");
  if (rocket !== null && t >= rocket - 30) return "lifeboat";
  if (t >= 600) return "along-hull";
  return "establishing";
}

/** The camera for a scripted shot. */
export function shotView(shot: ShotId, ctx: ShotContext): View {
  const w = bowBody(ctx);
  const s = sternBody(ctx);
  switch (shot) {
    case "afternoon":
    case "hit":
    case "list":
    case "boats":
    case "port-boats":
    case "bow-down":
    case "grounded":
    case "grounded-below":
    case "on-floor":
      return lusitaniaView(shot, ctx);
    case "establishing": {
      const a = 0.55 + ctx.t * 0.0006 + ctx.wall * 0.004;
      const tgt = shipToThree(w, [10, 0, 16]);
      return {
        // Close enough that the ship fills the frame for the opening minutes.
        pos: [tgt[0] + Math.cos(a) * 320, 52, tgt[2] + Math.sin(a) * 320],
        target: tgt,
      };
    }
    case "along-hull": {
      const u = ((ctx.t - 600) / 2400) % 1;
      const x = 120 - u * 240;
      const pos = shipToThree(w, [x, -70, 16]);
      pos[1] = Math.max(pos[1], 4);
      return { pos, target: shipToThree(w, [x - 60, 0, 18]) };
    }
    case "lifeboat":
      return lifeboatView(ctx);
    case "wide-starboard": {
      const tgt = shipToThree(w, [0, 0, 14]);
      tgt[1] = Math.max(tgt[1], 6);
      return { pos: [tgt[0] - 120, 24, tgt[2] + 470], target: tgt };
    }
    case "break": {
      const x = ctx.breakX ?? -27;
      const tgt = shipToThree(s, [x, 0, 16]);
      tgt[1] = Math.max(tgt[1], 4);
      return { pos: [tgt[0] + 40, 30, tgt[2] + 360], target: tgt };
    }
    case "plunge":
      return lifeboatView(ctx, 240);
    case "follow-bow":
    case "wreck":
      return underwaterView(ctx);
  }
}

// ---------------------------------------------------------------------------
// The Lusitania's afternoon (93 m of water, the bow on the floor while the
// stern is still up, the wreck on her starboard side).

/**
 * A point beside a body, level: [x along her heading, y to port] from the
 * body's origin (turned with her yaw, not her list or trim) at height `h`
 * over the still sea. Shots stand here so a list never tips them under.
 */
export function levelToThree(pose: BodyPose, p: readonly number[]): V3 {
  const cy = Math.cos(pose.yaw);
  const sy = Math.sin(pose.yaw);
  const ex = pose.x + cy * p[0] - sy * p[1];
  const ey = pose.y + sy * p[0] + cy * p[1];
  return [ex, p[2], -ey];
}

function lusitaniaShot(
  track: Pick<SimTrack, "events" | "brokeAtT" | "sankAtT">,
  t: number
): ShotId {
  const firstOf = (kind: string): number | null => {
    for (const e of track.events) if (e.kind === kind) return e.t;
    return null;
  };
  const sternUnder = firstOf("stern-under") ?? track.sankAtT;
  const landed = firstOf("bow-lands");
  if (sternUnder !== null && t >= sternUnder + 6) return "on-floor";
  if (landed !== null && t >= landed - 4) {
    // Her bow on the floor while her stern is still up: above, then below.
    const end = sternUnder ?? landed + 60;
    return t < landed + (end - landed) * 0.55 ? "grounded" : "grounded-below";
  }
  const going =
    firstOf("forecastle-under") ??
    (sternUnder !== null ? sternUnder - 120 : null);
  if (going !== null && t >= going + 20) return "bow-down";
  if (t < 40) return "hit";
  const firstBoat = firstOf("boat-lowered");
  if (firstBoat === null || t < firstBoat) return "list";
  // The boats (starboard swung far out), then the port side's against her
  // hull, then the starboard boats again.
  if (t >= firstBoat + 240 && t < firstBoat + 390) return "port-boats";
  return "boats";
}

function lusitaniaView(shot: ShotId, ctx: ShotContext): View {
  const b = bowBody(ctx);
  const floor = -ctx.seaDepthM;
  const hitX = ctx.hitX ?? 63.7;
  const drift = ctx.wall * 0.004;
  switch (shot) {
    case "afternoon": {
      // Circling slowly from her starboard bow: the coast behind her.
      const a = 0.55 + drift;
      return {
        pos: levelToThree(b, [Math.cos(a) * 320, -Math.sin(a) * 320, 42]),
        target: shipToThree(b, [5, 0, 18]),
      };
    }
    case "hit": {
      // Low off her starboard bow, looking aft at the hit: the track runs
      // in from the right, the column goes up; slowly pulling back.
      const k = 1 + Math.min(ctx.t, 40) / 60;
      return {
        pos: levelToThree(b, [hitX + 120 * k, -150 * k, 12 + 6 * k]),
        target: shipToThree(b, [hitX - 25, -8, 16]),
      };
    }
    case "list":
      // Ahead on the starboard bow: she leans toward us, smoking.
      return {
        pos: levelToThree(b, [190, -250, 44]),
        target: shipToThree(b, [0, 0, 18]),
      };
    case "boats": {
      // Low on the starboard side, close: the boats hanging far out.
      const x = 10 + Math.sin(ctx.wall * 0.03) * 30;
      const tgt = shipToThree(b, [x - 10, -14, 20]);
      tgt[1] = Math.max(tgt[1], 4);
      return { pos: levelToThree(b, [x + 50, -165, 7]), target: tgt };
    }
    case "port-boats": {
      // High on the port quarter: her port side lifted, the boats in
      // against the hull.
      const tgt = shipToThree(b, [10, 12, 16]);
      return { pos: levelToThree(b, [-70, 120, 18]), target: tgt };
    }
    case "bow-down": {
      const tgt = shipToThree(b, [30, 0, 10]);
      tgt[1] = Math.max(tgt[1], 3);
      return { pos: levelToThree(b, [230, -200, 30]), target: tgt };
    }
    case "grounded": {
      // Off the starboard quarter, low: her stern and screws in the air.
      const tgt = shipToThree(b, [-75, 0, 8]);
      tgt[1] = Math.max(tgt[1], 8);
      return { pos: levelToThree(b, [-190, -150, 9]), target: tgt };
    }
    case "grounded-below": {
      // Under water on her starboard side: the bow dug into the floor, the
      // hull rising to the surface.
      const tgt = shipToThree(b, [55, 0, 6]);
      tgt[1] = Math.min(-8, Math.max(tgt[1], floor + 8));
      return {
        pos: levelToThree(b, [120, -125, Math.max(floor + 22, -60)]),
        target: tgt,
      };
    }
    default:
      return lusitaniaUnderwater(ctx);
  }
}

/** Under water with her: following her bow down, then circling the wreck. */
function lusitaniaUnderwater(ctx: ShotContext): View {
  const b = bowBody(ctx);
  const floor = -ctx.seaDepthM;
  const tgt = shipToThree(b, [10, 4, 12]);
  tgt[1] = Math.min(-6, Math.max(tgt[1], floor + 6));
  // Swinging slowly to and fro off her port side, which (on her
  // starboard side on the floor) shows her decks.
  const a = -Math.PI / 2 - 0.35 + Math.sin(ctx.wall * 0.03) * 0.6;
  const r = 115;
  return {
    pos: [
      tgt[0] + Math.cos(a) * r,
      Math.min(-6, Math.max(floor + 24, tgt[1] + 16)),
      tgt[2] + Math.sin(a) * r,
    ],
    target: tgt,
  };
}

/**
 * A grounded body raised, if need be, so no hull point (`points`, ship
 * frame) is more than `embedM` into the sea floor. Display only: the sim's
 * rest rule for a wreck on her side (`ShipSpec.wreck`) turns her over about
 * her keel without re-seating her, which leaves her side far into the
 * floor. Never lowers a body.
 */
export function seatOnFloor(
  pose: BodyPose,
  points: readonly (readonly number[])[],
  seaDepthM: number,
  embedM = 1.5
): BodyPose {
  let low = Infinity;
  for (const p of points) low = Math.min(low, shipToThree(pose, p)[1]);
  const floor = -seaDepthM - embedM;
  return low < floor ? { ...pose, z: pose.z + (floor - low) } : pose;
}
