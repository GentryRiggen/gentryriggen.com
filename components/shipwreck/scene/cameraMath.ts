import { carpathia } from "@/lib/shipwreck/ships/carpathia";
import { SPURS, concordia } from "@/lib/shipwreck/ships/concordia";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import type { ShipId, ShipSpec } from "@/lib/shipwreck/ships/types";
import type { SimTrack } from "@/lib/shipwreck/sim/track";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
import { poseidon } from "@/lib/shipwreck/ships/poseidon";
import { HARBOUR_MOUTH, groundZ } from "./giglio";
import { poseidonShot, poseidonView, type PoseidonShot } from "./poseidonShots";

/**
 * Camera maths with no three.js: points are [x, y, z] in three.js axes
 * (x forward along her heading, y up, z to starboard), ship-frame points
 * are [x forward, y port, z up from the keel].
 */

export type V3 = [number, number, number];

/** A ship-frame point under a sim pose, in three.js axes. */
export function shipToThree(pose: BodyPose, p: readonly number[]): V3 {
  return shipToThreeInto(pose, p, [0, 0, 0]);
}

/** As `shipToThree`, written into `out` (no allocation). */
export function shipToThreeInto(
  pose: BodyPose,
  p: readonly number[],
  out: V3
): V3 {
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
  out[0] = pose.x + x3;
  out[1] = pose.z + z2;
  out[2] = -(pose.y + y3);
  return out;
}

/**
 * The first body's speed over the sea (m/s) between `t - span` and `t`,
 * read off the track's frames (their last at or before each time), with
 * no allocation. 0 when they are the same frame.
 */
export function trackSpeedAt(
  frames: readonly { t: number; bodies: readonly BodyPose[] }[],
  t: number,
  span = 2
): number {
  const at = (time: number): number => {
    let lo = 0;
    let hi = frames.length - 1;
    if (hi < 0 || time <= frames[0].t) return 0;
    if (time >= frames[hi].t) return hi;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (frames[mid].t <= time) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  const i = at(t);
  const j = at(t - span);
  if (i === j) return 0;
  const a = frames[i];
  const b = frames[j];
  const dt = a.t - b.t;
  if (!(dt > 0)) return 0;
  return (
    Math.hypot(a.bodies[0].x - b.bodies[0].x, a.bodies[0].y - b.bodies[0].y) /
    dt
  );
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

/**
 * The Britannic's: the Titanic's boxes on her 94 ft hull (her beam
 * 28.65 m, the same frames and decks; the boat deck house a little wider
 * with her).
 */
export const BRITANNIC_HULL_BOXES: readonly HullBox[] = [
  { x: [-138.5, 130], y: [-14.45, 14.45], z: [-0.5, 21] },
  { x: [-126, 105], y: [-13.2, 13.2], z: [21, 29.3] },
];

/**
 * A laker's boxes from her data (lib/shipwreck/ships/fitzgerald.ts): the
 * hull from her stern to her stem, the beam across, in three lengths so
 * the free camera can come down to her low open deck between her houses:
 * the after house (to its top tier), the spar deck amidships (to its
 * sheer there) and the forecastle with the texas house and the pilothouse
 * (about 3 m over its floor).
 */
function lakerBoxes(spec: ShipSpec): HullBox[] {
  const xs = spec.stations.map((st) => st.x);
  const stern = Math.min(...xs) - 0.2;
  const stem = Math.max(...xs) + 0.2;
  const y: [number, number] = [-(spec.beam / 2 + 0.1), spec.beam / 2 + 0.1];
  const deck = spec.openDeck;
  const aftX = deck?.fromX ?? -spec.lbp / 3;
  const fwdX = deck?.toX ?? spec.lbp / 3;
  const top = (from: number, to: number) =>
    Math.max(
      spec.sheerZ(from),
      spec.sheerZ(to),
      ...spec.superstructure
        .filter((b) => b.fromX < to && b.toX > from)
        .map((b) => b.topZ)
    );
  const pilothouse = spec.decks.find((d) => d.name === "Pilothouse");
  return [
    { x: [stern, aftX], y, z: [-0.5, top(stern, aftX)] },
    {
      x: [aftX, fwdX],
      y,
      z: [-0.5, Math.max(spec.sheerZ(aftX), spec.sheerZ(fwdX)) + 0.3],
    },
    {
      x: [fwdX, stem],
      y,
      z: [-0.5, Math.max(top(fwdX, stem), (pilothouse?.z ?? 0) + 3)],
    },
  ];
}

export const FITZGERALD_HULL_BOXES: readonly HullBox[] = lakerBoxes(fitzgerald);

/**
 * The Carpathia's (lib/shipwreck/ships/carpathia.ts): the hull from her
 * stern to her stem, her beam across, to her sheer's highest (the
 * forecastle head); then each house from her data (the stern deckhouse
 * inboard of its walkways, the long bridge deck house, the bridge house
 * and the forecastle) to its top with 2.5 m more for the boat deck's
 * boats, rails and the navigating bridge.
 */
function carpathiaBoxes(spec: ShipSpec): HullBox[] {
  const xs = spec.stations.map((st) => st.x);
  const stern = Math.min(...xs) - 0.2;
  const stem = Math.max(...xs) + 0.2;
  const half = spec.beam / 2 + 0.1;
  const sheer = Math.max(spec.sheerZ(stern + 0.2), spec.sheerZ(stem - 0.2));
  return [
    { x: [stern, stem], y: [-half, half], z: [-0.5, sheer] },
    ...spec.superstructure.map((b): HullBox => ({
      x: [b.fromX, b.toX],
      y: [-(b.halfBreadthM ?? half), b.halfBreadthM ?? half],
      z: [sheer - 1, b.topZ + 2.5],
    })),
  ];
}

export const CARPATHIA_HULL_BOXES: readonly HullBox[] =
  carpathiaBoxes(carpathia);

/**
 * The Concordia's (lib/shipwreck/ships/concordia.ts), as the Carpathia's
 * are made: her hull to deck 1's sheer, her beam across, then her
 * superstructure's blocks (the aft terraces to deck 9, the main block to
 * deck 11, the top tier to deck 14, the stepped front) to their tops with
 * 2.5 m for the rails and glass. Her funnel and masts are not boxed.
 */
export const CONCORDIA_HULL_BOXES: readonly HullBox[] =
  carpathiaBoxes(concordia);

/**
 * The Poseidon's (lib/shipwreck/ships/poseidon.ts), made as the
 * Carpathia's: her hull to deck 1, her beam across, then her tiers (lower
 * decks 1–6 and upper decks 7–11 fore, midships and aft, the top tier to
 * deck 14) and the ballroom's box, each to its top with 2.5 m for rails
 * and glass; the dome's crown over it (9 m over deck 14) gets its own box.
 * Her funnel and masts are not boxed. Posed by the body's full rotation
 * (`keepClear` works in her frame), so they hold at any roll.
 */
export const POSEIDON_HULL_BOXES: readonly HullBox[] = [
  ...carpathiaBoxes(poseidon),
  ...poseidon.superstructure
    .filter((b) => b.id === "ballroom")
    .map((b): HullBox => {
      const r = b.halfBreadthM ?? poseidon.beam / 2;
      return {
        x: [b.fromX, b.toX],
        y: [-r, r],
        z: [b.topZ, poseidon.decks[0].z + 9.5],
      };
    }),
];

/** The hull boxes of a ship (the camera's bounds and the double-tap proxies). */
export function hullBoxesFor(ship: ShipId): readonly HullBox[] {
  if (ship === "poseidon") return POSEIDON_HULL_BOXES;
  if (ship === "concordia") return CONCORDIA_HULL_BOXES;
  if (ship === "fitzgerald") return FITZGERALD_HULL_BOXES;
  if (ship === "carpathia") return CARPATHIA_HULL_BOXES;
  if (ship === "britannic") return BRITANNIC_HULL_BOXES;
  return ship === "lusitania" ? LUSITANIA_HULL_BOXES : HULL_BOXES;
}

/**
 * A camera height kept clear of the sea's surface under it (a storm's
 * waves; `surface` the sea's height there): a camera meant above the sea
 * (at or over the still water, y ≥ 0) stays `clearance` over the crest
 * under it; one meant under it stays that far below the trough over it.
 */
export function aboveWaves(
  y: number,
  surface: number,
  clearance = 1.5
): number {
  return y >= 0
    ? Math.max(y, surface + clearance)
    : Math.min(y, surface - clearance);
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
  clearance = 2,
  /** A sloping floor or land (three y at three x, z): else −seaDepthM. */
  ground?: Ground
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
      const w = shipToThree(pose, q);
      if (w[1] < (ground ? ground(w[0], w[2]) + clearance : floor)) continue;
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

/**
 * How much further back a shot `dist` m from its target must stand so
 * `width` m fits across a screen this shape (w / h) with this vertical
 * field of view (degrees): at least 1.
 */
export function fitAcross(
  aspect: number,
  fovDeg: number,
  dist: number,
  width: number
): number {
  if (!(aspect > 0) || !(dist > 0)) return 1;
  const halfH = Math.tan((fovDeg * Math.PI) / 360) * aspect;
  return Math.max(1, width / 2 / halfH / dist);
}

/** Her wide shots above the sea, fitted to her length on a narrow screen. */
export const FITZGERALD_WIDE_SHOTS: readonly ShotId[] = [
  "storm",
  "storm-beam",
  "sisters",
  "going",
];

/** The ground (three y) under a three.js x, z: a sloping floor, or land. */
export type Ground = (x: number, z: number) => number;

/**
 * The ground the camera keeps over for a ship: the Concordia's island and
 * sloping floor (`groundZ`: her seabed's `floorAt` offshore, Giglio's
 * land inland of the same shore), else none (her flat `seaDepthM`).
 */
export function groundFor(ship: ShipId): Ground | undefined {
  return ship === "concordia" ? concordiaGround : undefined;
}

/** The Concordia's ground in three axes (earth y = −z). */
export function concordiaGround(x: number, z: number): number {
  return groundZ(x, -z);
}

/** Keeps a three.js point `clearance` over the ground under it. */
export function clampAboveGround(p: V3, ground: Ground, clearance = 2): V3 {
  return [p[0], Math.max(p[1], ground(p[0], p[2]) + clearance), p[2]];
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
  | "run-in"
  | "hit"
  | "list"
  | "boats"
  | "port-boats"
  | "bow-down"
  | "grounded"
  | "grounded-below"
  | "on-floor"
  // The Britannic's morning (the rest are the Lusitania's).
  | "morning"
  | "turn"
  // The Fitzgerald's storm.
  | "storm"
  | "storm-beam"
  | "deck"
  | "sisters"
  | "going"
  | "dive"
  | "strike"
  | "stern-roll"
  | "parts"
  | "astern"
  // The Concordia's night by Giglio.
  | "giglio"
  | "giglio-strike"
  | "giglio-drift"
  | "giglio-boats"
  | "giglio-aground"
  // The Poseidon's night (poseidonShots.ts).
  | PoseidonShot;

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
  /** The wreck on the stage (her story's shots; default the Titanic's). */
  ship?: ShipId;
  /** The ship herself (her bridge and stern cameras), when another ship's
   *  wreck is on the stage (a crossover). Missing: `ship`. */
  hull?: ShipId;
  /** Ship-frame x where the torpedo struck (her shots aim there). */
  hitX?: number;
  /** Where it struck on the sea (three.js), fixed where it happened. */
  hitAt?: V3;
  /** When it struck (shown s; default the first moment). */
  hitT?: number;
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
  if (ctx.ship === "concordia") return concordiaView("giglio-boats", ctx);
  if (ctx.ship === "fitzgerald") return fitzgeraldBoatView(ctx);
  if (ctx.ship === "carpathia") return carpathiaBoatView(ctx);
  const drift = Math.sin(ctx.t / 900) * 12 + ctx.wall * 0.15;
  const s = sternBody(ctx);
  const tgt = shipToThree(s, [-10, 0, 14]);
  // Keep looking at the surface where she went down, a little above the
  // ship so the rockets' bursts are in the frame.
  // (The Lusitania fired none: just over her. Her boats got away from
  // the starboard side, so her boat camera is off the starboard quarter.)
  // (Nor the Britannic: no rockets either, her boats from both sides.)
  const lusitania = ctx.ship === "lusitania" || ctx.ship === "britannic";
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
  if (ctx.ship === "concordia") return concordiaUnderwater(ctx);
  if (ctx.ship === "poseidon") return poseidonUnderwater(ctx);
  if (ctx.ship === "lusitania" || ctx.ship === "britannic")
    return lusitaniaUnderwater(ctx);
  if (ctx.ship === "carpathia") return carpathiaUnderwater(ctx);
  if (ctx.ship === "fitzgerald") return fitzgeraldUnderwater(ctx);
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

/**
 * Whether the run has something to follow (`cinematicShot`'s `hit`): a hole
 * in her side, or a storm run (the Fitzgerald's deck openings never reach
 * the playback, so a storm run has none yet is still a run, not the title's
 * calm ship).
 */
export function cinematicHit(
  openingCount: number,
  cause: ShipSpec["cause"],
  preview: boolean
): boolean {
  return openingCount > 0 || (cause === "storm" && !preview);
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
  if (ship === "carpathia") return hit ? carpathiaShot(track, t) : "afternoon";
  if (ship === "britannic") return hit ? britannicShot(track, t) : "morning";
  if (ship === "fitzgerald") return hit ? fitzgeraldShot(track, t) : "storm";
  if (ship === "concordia") return hit ? concordiaShot(track, t) : "giglio";
  if (ship === "poseidon")
    return hit ? poseidonShot(track, t) : "poseidon-party";
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
    case "run-in":
    case "hit":
    case "list":
    case "boats":
    case "port-boats":
    case "bow-down":
    case "grounded":
    case "grounded-below":
    case "on-floor":
      return ctx.ship === "carpathia"
        ? carpathiaView(shot, ctx)
        : lusitaniaView(shot, ctx);
    case "morning":
    case "turn":
      return lusitaniaView(shot, ctx);
    case "giglio":
    case "giglio-strike":
    case "giglio-drift":
    case "giglio-boats":
    case "giglio-aground":
      return concordiaView(shot, ctx);
    case "poseidon-party":
    case "poseidon-wave":
    case "poseidon-roll":
    case "poseidon-keel":
    case "poseidon-dome":
    case "poseidon-dive":
    case "poseidon-floor":
      return poseidonView(shot, ctx);
    case "storm":
    case "storm-beam":
    case "deck":
    case "sisters":
    case "going":
    case "dive":
    case "strike":
    case "stern-roll":
    case "parts":
    case "astern":
      return fitzgeraldView(shot, ctx);
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
  if (t < 0) return "run-in";
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
    case "turn": {
      // The Britannic's turn for Kea: high off her port quarter, looking
      // over her bow as she swings toward the island, her wake behind.
      const tgt = shipToThree(b, [60, 0, 14]);
      return { pos: levelToThree(b, [-300, 190, 85]), target: tgt };
    }
    case "morning":
    case "afternoon": {
      // Circling slowly from her starboard bow: the coast behind her.
      const a = 0.55 + drift;
      return {
        pos: levelToThree(b, [Math.cos(a) * 320, -Math.sin(a) * 320, 42]),
        target: shipToThree(b, [5, 0, 18]),
      };
    }
    case "run-in": {
      // Before the hit: standing well ahead of where the torpedo will
      // strike, off her starboard bow, looking back along her course. She
      // steams toward us from the distance; the white track streaks in
      // from the left; they meet at the hit.
      const h = ctx.hitAt ?? shipToThree(b, [hitX, -13.4, 9]);
      const drift = Math.sin(ctx.wall * 0.05) * 6;
      return {
        pos: [h[0] + 300 + drift, 75, h[2] + 260],
        target: [h[0] - 90, 0, h[2] + 110],
      };
    }
    case "hit": {
      // Low off her starboard bow, looking aft at the hit: the track runs
      // in from the right, the column goes up; slowly pulling back.
      const k = 1 + Math.min(Math.max(0, ctx.t), 40) / 60;
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

/**
 * The Britannic's morning: the Lusitania's story of shots (the hit, the
 * list, the boats, the bow on the floor, her side) with her turn for Kea
 * after the mine (from 40 s to 5 minutes).
 */
function britannicShot(
  track: Pick<SimTrack, "events" | "brokeAtT" | "sankAtT">,
  t: number
): ShotId {
  const shot = lusitaniaShot(track, t);
  return shot === "list" && t < 300 ? "turn" : shot;
}

/** Under water with her: following her bow down, then circling the wreck. */
function lusitaniaUnderwater(ctx: ShotContext): View {
  const b = bowBody(ctx);
  const floor = -ctx.seaDepthM;
  const tgt = shipToThree(b, [10, 4, 12]);
  tgt[1] = Math.min(-6, Math.max(tgt[1], floor + 6));
  // Swinging slowly to and fro off her starboard side, where her decks
  // face once she lies on that side (a starboard list turns them so).
  const a = Math.PI / 2 + 0.35 + Math.sin(ctx.wall * 0.03) * 0.6;
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

// ---------------------------------------------------------------------------
// The Fitzgerald's storm (162 m of water: her bow on the floor as her stern
// goes under, the stern rolling over, both parts apart on the floor). Shots
// above the sea stand at least 14 m up (her crests reach about 8 m, the
// three sisters a few more); the camera rig also keeps every camera clear
// of the local wave surface (`aboveWaves`).

/** Shown seconds after 3:30 PM for h:mm PM. */
function stormPm(h: number, m: number): number {
  return (h + 12 - 15) * 3600 + (m - 30) * 60;
}

/** Each of her storm shots in turn through the afternoon, this long (s). */
const STORM_SHOT_S = 900;
const STORM_CYCLE: readonly ShotId[] = ["storm", "storm-beam", "deck"];
/**
 * The dark stretches between her squalls (`SQUALLS`, storm.ts) when the
 * cinematic camera looks aft from her pilothouse at the Anderson's lights.
 */
const ASTERN_WINDOWS: readonly (readonly [number, number])[] = [
  [stormPm(5, 50), stormPm(6, 5)],
  [stormPm(6, 34), stormPm(6, 40)],
];

function fitzgeraldShot(
  track: Pick<SimTrack, "events" | "brokeAtT" | "sankAtT">,
  t: number
): ShotId {
  let bowUnder: number | null = null;
  let bowLands: number | null = null;
  let sternUnder: number | null = null;
  let sternLands: number | null = null;
  for (const e of track.events) {
    if (e.kind === "bow-under" && bowUnder === null) bowUnder = e.t;
    if (e.kind === "bow-lands" && bowLands === null) bowLands = e.t;
    if (e.kind === "stern-under" && sternUnder === null) sternUnder = e.t;
    if (e.kind === "stern-lands" && sternLands === null) sternLands = e.t;
  }
  if (sternLands !== null && t >= sternLands + 4) return "parts";
  if (sternUnder !== null && t >= sternUnder - 0.5) return "stern-roll";
  if (bowLands !== null && t >= bowLands - 3) return "strike";
  if (bowUnder !== null && t >= bowUnder + 8) return "dive";
  if (bowUnder !== null && t >= bowUnder - 30) return "going";
  if (t >= stormPm(7, 0)) return "sisters";
  // Looking aft when the snow thins in the dark: the Anderson's lights.
  for (const [a, b] of ASTERN_WINDOWS) if (t >= a && t < b) return "astern";
  const i = Math.floor(Math.max(0, t) / STORM_SHOT_S) % STORM_CYCLE.length;
  return STORM_CYCLE[i];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function fitzgeraldView(shot: ShotId, ctx: ShotContext): View {
  const b = bowBody(ctx);
  const s = sternBody(ctx);
  const floor = -ctx.seaDepthM;
  const breakX = ctx.breakX ?? 18;
  switch (shot) {
    case "storm": {
      // High on her starboard quarter (26–43° off astern: nearer dead
      // astern her square house and long side read as a kink), looking
      // along her: the seas rolling up from astern and overtaking her.
      const a = 0.6 + 0.15 * Math.sin(ctx.wall * 0.01);
      return {
        pos: levelToThree(b, [-360 * Math.cos(a), -360 * Math.sin(a), 65]),
        target: shipToThree(b, [15, 0, 10]),
      };
    }
    case "storm-beam":
      // Low off her starboard beam: the seas over her low deck.
      return {
        pos: levelToThree(b, [-30, -175, 20]),
        target: shipToThree(b, [-5, 0, 13]),
      };
    case "deck":
      // Over her after house's starboard side, looking forward along her
      // deck to the pilothouse (riding with her).
      return {
        pos: shipToThree(s, [-104, -13.5, 30]),
        target: shipToThree(s, [50, 0, 12]),
      };
    case "sisters": {
      // Wide on her starboard quarter: the big seas overtaking her.
      const tgt = shipToThree(b, [-20, 0, 10]);
      // (High enough to see her deck over the crest between.)
      return { pos: levelToThree(b, [-290, -260, 50]), target: tgt };
    }
    case "going": {
      // Off her starboard bow as her bow goes under.
      const tgt = shipToThree(b, [30, 0, 8]);
      tgt[1] = Math.max(tgt[1], 2);
      return { pos: levelToThree(b, [215, -240, 48]), target: tgt };
    }
    case "astern":
      // From her pilothouse's top, aft over her deck and after house to
      // the Anderson's lights astern (a little to starboard).
      return {
        pos: shipToThree(b, [101, -5, 24.5]),
        target: shipToThree(b, [-1500, -40, 16]),
      };
    case "dive": {
      // Under water beside her bow, going down with it (about 75 m off).
      const tgt = shipToThree(b, [60, 0, 6]);
      tgt[1] = clamp(tgt[1], floor + 8, -10);
      const pos = levelToThree(b, [45, -75, 0]);
      pos[1] = clamp(tgt[1] + 8, floor + 14, -14);
      return { pos, target: tgt };
    }
    case "strike": {
      // Low on the floor ahead of her starboard bow, looking back along
      // the clay: her bow strikes it (the plume) while her hull rises
      // behind toward the surface. About 85 m off.
      const tgt = shipToThree(b, [85, 0, 4]);
      tgt[1] = clamp(tgt[1], floor + 4, -14);
      const pos = levelToThree(b, [140, -60, 0]);
      pos[1] = floor + 9;
      return { pos, target: tgt };
    }
    case "stern-roll": {
      // Off her stern's starboard quarter, a little below it: the hull
      // turns over against the grey window of the surface. About 65 m.
      const tgt = shipToThree(s, [-60, 0, 4]);
      tgt[1] = clamp(tgt[1], floor + 8, -14);
      const pos = levelToThree(s, [-105, -50, 0]);
      pos[1] = clamp(tgt[1] - 6, floor + 12, -14);
      return { pos, target: tgt };
    }
    default:
      return fitzgeraldParts(ctx, breakX);
  }
}

/** Both parts on the floor, circled slowly from above the gap between them. */
function fitzgeraldParts(ctx: ShotContext, breakX: number): View {
  const floor = -ctx.seaDepthM;
  const bw = shipToThree(bowBody(ctx), [breakX + 20, 0, 4]);
  const st = shipToThree(sternBody(ctx), [breakX - 20, 0, 4]);
  const tgt: V3 = [
    (bw[0] + st[0]) / 2,
    clamp((bw[1] + st[1]) / 2, floor + 6, -14),
    (bw[2] + st[2]) / 2,
  ];
  const a = 0.9 + ctx.wall * 0.04;
  return {
    pos: [
      tgt[0] + Math.cos(a) * 80,
      clamp(tgt[1] + 26, floor + 18, -14),
      tgt[2] + Math.sin(a) * 80,
    ],
    target: tgt,
  };
}

/** Under water with her: her bow going down, then both parts on the floor. */
function fitzgeraldUnderwater(ctx: ShotContext): View {
  const floor = -ctx.seaDepthM;
  const b = bowBody(ctx);
  const tgt = shipToThree(b, [40, 0, 6]);
  if (tgt[1] < floor + 40) return fitzgeraldParts(ctx, ctx.breakX ?? 18);
  tgt[1] = clamp(tgt[1], floor + 8, -10);
  const pos = levelToThree(b, [20, -80, 0]);
  pos[1] = clamp(tgt[1] + 6, floor + 14, -14);
  return { pos, target: tgt };
}

/**
 * Her boat camera: off her starboard quarter, high enough to stay over
 * the crests between, where the Anderson's crew would have looked from.
 */
function fitzgeraldBoatView(ctx: ShotContext): View {
  const s = sternBody(ctx);
  const tgt = shipToThree(s, [-40, 0, 10]);
  tgt[1] = Math.max(tgt[1], 6);
  const a = 0.6 + Math.sin(ctx.wall * 0.02) * 0.1;
  return {
    pos: levelToThree(s, [-320 * Math.cos(a), -320 * Math.sin(a), 17]),
    target: tgt,
  };
}

// ---------------------------------------------------------------------------
// The Carpathia's morning (150 m of water; her torpedoes into her port
// side; upright on the floor). Her shots are the Lusitania's turned to her
// port side and her 170 m, with a second run-in and hit for the U-boat's
// torpedo at 10:50 AM.

/** Seconds before a torpedo's hit its run-in shot starts (its wake's 40 s). */
export const CARPATHIA_RUN_IN_S = 45;

/** Her torpedo hits after the first moment's pair (the U-boat's return). */
function lateHitOf(track: Pick<SimTrack, "events">, t: number): number | null {
  let late: number | null = null;
  for (const e of track.events)
    if (e.kind === "torpedo-hit" && e.t > 60 && e.t - CARPATHIA_RUN_IN_S <= t)
      late = e.t;
  return late;
}

/**
 * The torpedo her shots aim at, at `t` (index into the run's torpedoes in
 * landing order): the last whose run-in has begun, else the first.
 */
export function torpedoInView(
  torpedoes: readonly { t: number }[],
  t: number
): number {
  let k = 0;
  for (let i = 0; i < torpedoes.length; i += 1)
    if (torpedoes[i].t - CARPATHIA_RUN_IN_S <= t) k = i;
  return k;
}

function carpathiaShot(
  track: Pick<SimTrack, "events" | "brokeAtT" | "sankAtT">,
  t: number
): ShotId {
  const firstOf = (kind: string): number | null => {
    for (const e of track.events) if (e.kind === kind) return e.t;
    return null;
  };
  if (t < 0) return "run-in";
  const sternUnder = firstOf("stern-under") ?? track.sankAtT;
  const sternLands = firstOf("stern-lands");
  // Her way down (R22): her stern up as it goes, then under water as she
  // swings down to the floor, then circling the wreck.
  if (sternUnder !== null) {
    const landed = sternLands ?? sternUnder + 20;
    if (t >= landed + 8) return "on-floor";
    if (t >= sternUnder + 3) return "grounded-below";
    if (t >= sternUnder - 25) return "grounded";
  }
  const bowUnder = firstOf("bow-under");
  if (bowUnder !== null && t >= bowUnder - 20) return "bow-down";
  // The U-boat's torpedo at 10:50 AM: its run-in, then its hit.
  const late = lateHitOf(track, t);
  if (late !== null)
    return t < late ? "run-in" : t < late + 40 ? "hit" : "list";
  if (t < 40) return "hit";
  const firstBoat = firstOf("boat-lowered");
  if (firstBoat === null || t < firstBoat) return "list";
  const lastBoat = firstOf("last-boat");
  // The boats on her port side (the hits' side), a while on her starboard
  // side's, then (all away) her settling with the boats clear of her.
  if (lastBoat !== null && t >= lastBoat + 180) return "list";
  if (t >= firstBoat + 240 && t < firstBoat + 390) return "port-boats";
  return "boats";
}

function carpathiaView(shot: ShotId, ctx: ShotContext): View {
  const b = bowBody(ctx);
  const floor = -ctx.seaDepthM;
  const hitX = ctx.hitX ?? 12;
  const drift = ctx.wall * 0.004;
  switch (shot) {
    case "afternoon": {
      // Circling slowly from her port bow (the title).
      const a = 0.55 + drift;
      return {
        pos: levelToThree(b, [Math.cos(a) * 240, Math.sin(a) * 240, 32]),
        target: shipToThree(b, [0, 0, 16]),
      };
    }
    case "run-in": {
      // High over the sea off her port side, beside the far end of the
      // torpedo's track and a little ahead of it, looking in at where it
      // will strike: the white track streaks up the frame to her side.
      const h = ctx.hitAt ?? shipToThree(b, [hitX, 9.9, 9]);
      const sway = Math.sin(ctx.wall * 0.05) * 5;
      return {
        pos: [h[0] + 110 + sway, 85, h[2] - 640],
        target: [h[0] - 10, 4, h[2] - 140],
      };
    }
    case "hit": {
      // Low off her port bow, looking aft at the hit: the column goes up;
      // slowly pulling back.
      const since = ctx.t - (ctx.hitT ?? 0);
      const k = 1 + Math.min(Math.max(0, since), 40) / 60;
      return {
        pos: levelToThree(b, [hitX + 95 * k, 120 * k, 10 + 5 * k]),
        target: shipToThree(b, [hitX - 20, 6, 14]),
      };
    }
    case "list": {
      // Ahead on her port bow: down by the head, leaning toward us.
      const tgt = shipToThree(b, [0, 0, 15]);
      tgt[1] = Math.max(tgt[1], 5);
      return { pos: levelToThree(b, [150, 200, 36]), target: tgt };
    }
    case "boats": {
      // High off her port quarter: her boats on their falls, and those
      // away pulling clear of her on the sea between.
      const x = Math.sin(ctx.wall * 0.03) * 15;
      const tgt = shipToThree(b, [x - 15, 40, 6]);
      tgt[1] = Math.max(tgt[1], 3);
      return { pos: levelToThree(b, [x - 150, 200, 48]), target: tgt };
    }
    case "port-boats": {
      // High on her starboard quarter: that side's boats going down.
      const tgt = shipToThree(b, [0, -10, 14]);
      tgt[1] = Math.max(tgt[1], 4);
      return { pos: levelToThree(b, [-60, -110, 18]), target: tgt };
    }
    case "bow-down": {
      const tgt = shipToThree(b, [10, 0, 10]);
      tgt[1] = Math.max(tgt[1], 3);
      return { pos: levelToThree(b, [170, 170, 26]), target: tgt };
    }
    case "grounded": {
      // Off her port quarter, low: her stern up, the screws in the air.
      const tgt = shipToThree(b, [-60, 0, 8]);
      tgt[1] = Math.max(tgt[1], 8);
      return { pos: levelToThree(b, [-150, 130, 10]), target: tgt };
    }
    case "grounded-below": {
      // Under water off her port beam, between the surface and the floor:
      // her bow on the floor, her hull swinging down to it.
      const tgt = shipToThree(b, [-10, 0, 8]);
      tgt[1] = clamp(tgt[1], floor + 12, -20);
      return {
        pos: levelToThree(b, [10, 125, clamp(tgt[1] + 6, floor + 20, -30)]),
        target: tgt,
      };
    }
    default:
      return carpathiaUnderwater(ctx);
  }
}

/** Under water with her: following her bow down, then circling the wreck. */
function carpathiaUnderwater(ctx: ShotContext): View {
  const b = bowBody(ctx);
  const floor = -ctx.seaDepthM;
  const tgt = shipToThree(b, [0, 0, 10]);
  tgt[1] = Math.min(-6, Math.max(tgt[1], floor + 8));
  // Swinging slowly to and fro off her port side (her list to port turns
  // her decks a little toward it).
  const a = -Math.PI / 2 - 0.4 + Math.sin(ctx.wall * 0.03) * 0.6;
  const r = 105;
  return {
    pos: [
      tgt[0] + Math.cos(a) * r,
      Math.min(-6, Math.max(floor + 22, tgt[1] + 14)),
      tgt[2] + Math.sin(a) * r,
    ],
    target: tgt,
  };
}

/**
 * Her boat camera: low on the water off her port quarter, among her boats,
 * a little above her so the rockets are in frame.
 */
function carpathiaBoatView(ctx: ShotContext): View {
  const s = sternBody(ctx);
  const tgt = shipToThree(s, [-10, 0, 12]);
  tgt[1] = Math.max(tgt[1], 6) + 14;
  const a = 0.75 + Math.sin(ctx.t / 900) * 0.08 + ctx.wall * 0.0004;
  return {
    pos: levelToThree(s, [
      -300 * Math.cos(a),
      300 * Math.sin(a),
      2.2 + Math.sin(ctx.wall * 0.7) * 0.15,
    ]),
    target: tgt,
  };
}

// ---------------------------------------------------------------------------
// The Concordia's night off Giglio: the island close by, her lit run past
// it, the strike, her drift back with Giglio Porto behind her, the boats
// going in to the harbour, and her rest on her side by Punta Gabbianara.
// Her shots stand at earth-fixed places round her (her heading swings
// round through 210°), each kept over the island's ground and her
// sloping floor (`concordiaGround`).

/** A three.js point in a pose's ship frame (`shipToThree` undone). */
export function threeToShip(pose: BodyPose, p: readonly number[]): V3 {
  const x0 = p[0] - pose.x;
  const y0 = -p[2] - pose.y;
  const z0 = p[1] - pose.z;
  const cy = Math.cos(pose.yaw);
  const sy = Math.sin(pose.yaw);
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  const cr = Math.cos(pose.roll);
  const sr = Math.sin(pose.roll);
  // Rz(yaw)⁻¹, Ry(pitch)⁻¹, Rx(roll)⁻¹.
  const x2 = cy * x0 + sy * y0;
  const y1 = -sy * x0 + cy * y0;
  const x = cp * x2 - sp * z0;
  const z1 = sp * x2 + cp * z0;
  return [x, cr * y1 + sr * z1, -sr * y1 + cr * z1];
}

/**
 * Her side on the rock spurs (R9, [WPP]): when a spur lies under her
 * (within 60 m of her hull's middle line), a low view across the shelf
 * at the spur's granite with her hull lying on it: from 60–75 m off, on
 * the first bearing round from her starboard beam toward her stern that
 * is clear of her and in water deep enough to stand 3 m over the floor.
 * Null when no spur is under her (afloat, or out at sea).
 */
function spurView(b: BodyPose, wall: number): View | null {
  let best: (typeof SPURS)[number] | null = null;
  let bestD = Infinity;
  for (const sp of SPURS) {
    const l = threeToShip(b, [sp[0], -sp[3], -sp[1]]);
    const d = Math.hypot(l[1], l[2]);
    if (Math.abs(l[0]) < concordia.loa / 2 && d < 60 && d < bestD) {
      best = sp;
      bestD = d;
    }
  }
  if (!best) return null;
  const [sx, sy, , top] = best;
  // Her starboard beam and her stern on the sea's plane (earth).
  const stbd = b.yaw - Math.PI / 2;
  const sway = Math.sin(wall * 0.03) * 0.15;
  for (let k = 0; k <= 8; k += 1) {
    const a = stbd + (k * Math.PI) / 8 + sway;
    for (const r of [60, 75]) {
      const ex = sx + Math.cos(a) * r;
      const ey = sy + Math.sin(a) * r;
      const fl = groundZ(ex, ey);
      const y = Math.max(fl + 3, -top + 3);
      if (y > -4) continue;
      const pos: V3 = [ex, y, -ey];
      const l = threeToShip(b, pos);
      if (
        CONCORDIA_HULL_BOXES.some(
          (h) =>
            l[0] > h.x[0] - 3 &&
            l[0] < h.x[1] + 3 &&
            l[1] > h.y[0] - 3 &&
            l[1] < h.y[1] + 3 &&
            l[2] > h.z[0] - 3 &&
            l[2] < h.z[1] + 3
        )
      )
        continue;
      return { pos, target: [sx, -top + 2, -sy] };
    }
  }
  return null;
}

/** Giglio Porto's mouth in three axes (x, z). */
const HARBOUR_THREE: readonly [number, number] = [
  HARBOUR_MOUTH[0],
  -HARBOUR_MOUTH[1],
];

function concordiaShot(
  track: Pick<SimTrack, "events" | "brokeAtT" | "sankAtT">,
  t: number
): ShotId {
  const firstOf = (kind: string): number | null => {
    for (const e of track.events) if (e.kind === kind) return e.t;
    return null;
  };
  if (t < 0) return "giglio";
  if (t < 40) return "giglio-strike";
  const rest = firstOf("floating-steady");
  const sank = track.sankAtT;
  if (rest !== null && t >= rest - 30) return "giglio-aground";
  if (sank !== null && t >= sank - 120) return "giglio-drift";
  const firstBoat = firstOf("boat-lowered");
  const lastBoat = firstOf("last-boat");
  if (firstBoat !== null && t >= firstBoat - 5) {
    if (lastBoat === null || t < lastBoat + 90) return "giglio-boats";
    return "giglio-aground";
  }
  return "giglio-drift";
}

/** A three.js point `clear` m over her ground, at least `minY`. */
function overGround(p: V3, clear: number, minY = 1.5): V3 {
  p[1] = Math.max(p[1], minY, concordiaGround(p[0], p[2]) + clear);
  return p;
}

/** Unit (x, z) from a to b, or along +x when they meet. */
function unitXZ(
  ax: number,
  az: number,
  bx: number,
  bz: number
): [number, number] {
  const dx = bx - ax;
  const dz = bz - az;
  const l = Math.hypot(dx, dz);
  return l > 1 ? [dx / l, dz / l] : [1, 0];
}

function concordiaView(shot: ShotId, ctx: ShotContext): View {
  const b = bowBody(ctx);
  const mid = shipToThree(b, [0, 0, 20]);
  const sway = Math.sin(ctx.wall * 0.03);
  switch (shot) {
    case "giglio": {
      // Her lit run past the island: off her starboard bow on the open
      // sea side, the island and its lights beyond her.
      const a = 0.7 + sway * 0.12;
      return {
        pos: overGround(
          levelToThree(b, [Math.cos(a) * 330, -Math.sin(a) * 330, 34]),
          20
        ),
        target: shipToThree(b, [-10, 0, 24]),
      };
    }
    case "giglio-strike": {
      // From her port quarter, low, between her and the rocks: the white
      // water along her side aft where the rock runs along her.
      const tgt = shipToThree(b, [-45, 17, 6]);
      return {
        pos: overGround(levelToThree(b, [-150, 62, 16]), 12),
        target: tgt,
      };
    }
    case "giglio-drift": {
      // Out to sea from her, looking in: Giglio Porto's lights behind her.
      const [ux, uz] = unitXZ(
        HARBOUR_THREE[0],
        HARBOUR_THREE[1],
        mid[0],
        mid[2]
      );
      const d = 430 + sway * 25;
      return {
        pos: overGround([mid[0] + ux * d, 62, mid[2] + uz * d], 30),
        target: [mid[0], Math.max(4, mid[1] - 6), mid[2]],
      };
    }
    case "giglio-boats": {
      // Off the coast between her and the harbour, low: her boats going
      // in to Giglio Porto, her leaning hull beyond.
      const m: V3 = [
        mid[0] + (HARBOUR_THREE[0] - mid[0]) * 0.4,
        6,
        mid[2] + (HARBOUR_THREE[1] - mid[2]) * 0.4,
      ];
      const [ux, uz] = unitXZ(
        HARBOUR_THREE[0],
        HARBOUR_THREE[1],
        mid[0],
        mid[2]
      );
      // To seaward of the line from the harbour to her (the island lies
      // on its other side: three +z is east, out to sea, here).
      const sx = -uz;
      const sz = ux;
      const pos = overGround(
        [m[0] + sx * 280 + ux * 60, 24, m[2] + sz * 280 + uz * 60],
        15
      );
      return { pos, target: [m[0] + ux * 120, 6, m[2] + uz * 120] };
    }
    default: {
      // On her side by the island: from the sea off her port side (her
      // bottom to us, half out of the water), Giglio Porto's lights and
      // the harbour beyond her.
      const [ux, uz] = unitXZ(
        HARBOUR_THREE[0],
        HARBOUR_THREE[1],
        mid[0],
        mid[2]
      );
      const sx = -uz;
      const sz = ux;
      const pos = overGround(
        [
          mid[0] + ux * 250 + sx * 190,
          44 + sway * 4,
          mid[2] + uz * 250 + sz * 190,
        ],
        25
      );
      return {
        pos,
        target: [
          mid[0] + (HARBOUR_THREE[0] - mid[0]) * 0.2,
          6,
          mid[2] + (HARBOUR_THREE[1] - mid[2]) * 0.2,
        ],
      };
    }
  }
}

/**
 * Under water with her: ahead of her bow, a little to starboard (the
 * island's side, where she lies on the spurs), looking aft along her on
 * the granite shelf and the seagrass; kept over the floor.
 */
function concordiaUnderwater(ctx: ShotContext): View {
  const b = bowBody(ctx);
  const spur = spurView(b, ctx.wall);
  if (spur) return spur;
  // Her starboard bilge: the low side once she lies to starboard.
  const tgt = shipToThree(b, [10, -17, 2]);
  tgt[1] = Math.min(-3, Math.max(tgt[1], concordiaGround(tgt[0], tgt[2]) + 2));
  const a = Math.sin(ctx.wall * 0.03) * 0.25;
  const pos = levelToThree(b, [
    95 * Math.cos(a) + 50,
    -95 * Math.sin(a) - 25,
    0,
  ]);
  // Where the shelf is too shallow there, out toward her port side
  // (seaward once she lies on her starboard side) to deeper water.
  const px = -Math.sin(b.yaw) * 20;
  const pz = -Math.cos(b.yaw) * 20;
  let fl = concordiaGround(pos[0], pos[2]);
  for (let k = 0; k < 12 && fl > -9; k += 1) {
    pos[0] += px;
    pos[2] += pz;
    fl = concordiaGround(pos[0], pos[2]);
  }
  pos[1] = clamp(tgt[1] + 1, fl + 3, -4);
  return { pos, target: tgt };
}

/**
 * The Poseidon under water: by the dome while she floats keel up, then
 * following her dive, then over her on the floor (poseidonShots.ts).
 */
function poseidonUnderwater(ctx: ShotContext): View {
  const b =
    ctx.bodies.find((x) => x.part === "whole") ??
    ctx.bodies.find((x) => x.part === "stern") ??
    ctx.bodies[0];
  if (b.z < -ctx.seaDepthM + 120) return poseidonView("poseidon-floor", ctx);
  if (b.z > -20) return poseidonView("poseidon-dome", ctx);
  return poseidonView("poseidon-dive", ctx);
}
