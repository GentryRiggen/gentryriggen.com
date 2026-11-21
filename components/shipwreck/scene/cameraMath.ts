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

/** Box regions the camera must stay out of (ship frame: x, y, z ranges). */
export const HULL_BOXES: readonly {
  x: [number, number];
  y: [number, number];
  z: [number, number];
}[] = [
  // The hull to C deck, then the long superstructure to the boat deck.
  { x: [-138.5, 130], y: [-14.2, 14.2], z: [-0.5, 21] },
  { x: [-126, 105], y: [-13, 13], z: [21, 29.3] },
];

/**
 * Pushes a ship-frame point out of the hull boxes through the nearest face
 * (with `margin`). Returns the point unchanged when it is outside.
 */
export function pushOutOfHull(p: V3, margin = 0.6): V3 {
  const out: V3 = [p[0], p[1], p[2]];
  for (const b of HULL_BOXES) {
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
  | "wreck";

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
  tgt[1] = Math.max(tgt[1], 6) + 22;
  const a = (215 * Math.PI) / 180 + drift / distance;
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
  t: number
): ShotId {
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
