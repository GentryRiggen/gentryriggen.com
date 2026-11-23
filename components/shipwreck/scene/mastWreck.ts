import {
  Matrix4,
  Vector3,
  type BufferAttribute,
  type BufferGeometry,
  type Mesh,
} from "three";
import type { TitanicHandles } from "@/components/shipwreck/model/shipModel";
import { toThree } from "@/components/shipwreck/model/shipModel";
import type { MastRecipe } from "@/components/shipwreck/model/titanicRecipe";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { BodyPose, SimTrack } from "@/lib/shipwreck/sim/track";
import { shipToThreeInto, type V3 } from "./cameraMath";
import { easeToWorld } from "./funnelWreck";

/**
 * The Britannic's foremast on the floor [WP]: "the foremast lies bent on
 * the floor". When her bow strikes the floor (the strike that bends her
 * bow, R12) the foremast, its own part of the model (`handles.foremast`),
 * comes down off her and lies beside her forward end, bent, over
 * `MAST_LAY_S`; its wires go with it. Only when she ends lying on her
 * side on the floor: in a run where she floats, breaks or lands upright
 * it stays standing on her. A rule, not physics, like the funnels
 * (funnelWreck.ts): its place is worked out from the wreck's pose (the
 * track's last frame) and laid on the floor. Moves the model's own group
 * and bends its small mesh in place: no new meshes, no draws.
 */

/** Seconds from the bow's landing to the mast lying on the floor. */
export const MAST_LAY_S = 30;
/** Its pole's axis over the floor as it lies (its crow's nest on the floor). */
export const MAST_LIFT_M = 1.15;
/** How far it is bent (radians, about 30°), its top toward her bow. */
export const MAST_BEND_RAD = 0.52;
/** The bend's start up its length (a share of it) and its length, m. */
const KINK_AT = 0.42;
const BEND_LEN_M = 5;
/** Its foot out from her boat deck's height (clear of her upper works). */
const FOOT_OUT_M = 2.5;
/** Its length turned from straight out toward her bow (radians). */
const TURN_RAD = 0.25;
/** Lying on her side: her final list at least this (radians, 60°). */
const ON_SIDE_RAD = Math.PI / 3;

const laysAt = new WeakMap<object, number | null>();

/**
 * When the foremast starts to come down: the first landing of her bow
 * (or stern), if she ends whole, sunk and on her side; else null.
 */
export function foremastLaysAt(
  track: Pick<SimTrack, "events" | "outcome" | "brokeAtT" | "frames">
): number | null {
  const known = laysAt.get(track);
  if (known !== undefined) return known;
  let t: number | null = null;
  const rest = track.frames[track.frames.length - 1]?.bodies[0];
  if (
    track.outcome === "sank" &&
    track.brokeAtT === null &&
    rest?.part === "whole" &&
    Math.abs(rest.roll) >= ON_SIDE_RAD
  ) {
    const land = track.events.find(
      (e) => e.kind === "bow-lands" || e.kind === "stern-lands"
    );
    t = land ? land.t : null;
  }
  laysAt.set(track, t);
  return t;
}

export interface MastSpot {
  /** Its foot on the floor (three axes), its axis `MAST_LIFT_M` up. */
  foot: V3;
  /** Along its length, foot to top (three, horizontal unit). */
  dir: V3;
  /** Across it on the floor, toward her bow (three, horizontal unit). */
  side: V3;
}

/**
 * Where the foremast lies beside her wreck (`pose`, her last frame): its
 * foot out from her deck by its own place, its length out across the
 * floor turned a little toward her bow.
 */
export function foremastFloorSpot(
  spec: Pick<ShipSpec, "decks" | "depth" | "seaDepthM">,
  pose: BodyPose,
  mast: Pick<MastRecipe, "x">,
  out: MastSpot = { foot: [0, 0, 0], dir: [1, 0, 0], side: [0, 0, 1] }
): MastSpot {
  const boat = spec.decks.find((d) => d.name === "Boat")?.z ?? spec.depth;
  const z = boat + FOOT_OUT_M;
  shipToThreeInto(pose, [mast.x, 0, z], a);
  shipToThreeInto(pose, [mast.x, 0, z + 10], b);
  shipToThreeInto(pose, [mast.x + 10, 0, z], c);
  // Her deck faces sideways on her side: "out" is along her ship z.
  const ox = b[0] - a[0];
  const oz = b[2] - a[2];
  const ol = Math.hypot(ox, oz) || 1;
  const fx = c[0] - a[0];
  const fz = c[2] - a[2];
  const fl = Math.hypot(fx, fz) || 1;
  let dx = (ox / ol) * Math.cos(TURN_RAD) + (fx / fl) * Math.sin(TURN_RAD);
  let dz = (oz / ol) * Math.cos(TURN_RAD) + (fz / fl) * Math.sin(TURN_RAD);
  const dl = Math.hypot(dx, dz) || 1;
  dx /= dl;
  dz /= dl;
  out.dir[0] = dx;
  out.dir[1] = 0;
  out.dir[2] = dz;
  // Square to it on the floor, the way toward her bow.
  const s = -dz * fx + dx * fz >= 0 ? 1 : -1;
  out.side[0] = -dz * s;
  out.side[1] = 0;
  out.side[2] = dx * s;
  out.foot[0] = a[0];
  out.foot[1] = -spec.seaDepthM + MAST_LIFT_M;
  out.foot[2] = a[2];
  return out;
}

const a: V3 = [0, 0, 0];
const b: V3 = [0, 0, 0];
const c: V3 = [0, 0, 0];
const spot: MastSpot = { foot: [0, 0, 0], dir: [1, 0, 0], side: [0, 0, 1] };

/**
 * The mast's own frame in its group (origin its foot): `along` its raked
 * pole, foot to top; `side` across it (its yard's way, three z); `normal`
 * square to both (`side × along`).
 */
function mastAxes(mast: Pick<MastRecipe, "rake">) {
  const along = new Vector3(-Math.tan(mast.rake), 1, 0).normalize();
  const side = new Vector3(0, 0, 1);
  const normal = new Vector3().crossVectors(side, along);
  return { along, side, normal };
}

interface Rest {
  pos: Float32Array;
  nrm: Float32Array;
  bend: number;
}
const rests = new WeakMap<BufferGeometry, Rest>();

/**
 * Bends the mast's mesh (origin its foot) in place by `bend` radians in
 * the plane of its pole and its yard: straight to `KINK_AT` of its length,
 * curved over `BEND_LEN_M`, straight after, its top toward its +side
 * (three z) for `bend` > 0. 0 puts it back exactly. Writes only when the
 * bend changes.
 */
export function bendMast(mesh: Mesh, mast: MastRecipe, bend: number): void {
  const g = mesh.geometry;
  const pa = g.getAttribute("position") as BufferAttribute;
  const na = g.getAttribute("normal") as BufferAttribute | undefined;
  let rest = rests.get(g);
  if (!rest) {
    if (bend === 0) return;
    rest = {
      pos: Float32Array.from(pa.array as Float32Array),
      nrm: na
        ? Float32Array.from(na.array as Float32Array)
        : new Float32Array(),
      bend: 0,
    };
    rests.set(g, rest);
  }
  if (rest.bend === bend) return;
  rest.bend = bend;
  const P = pa.array as Float32Array;
  const N = na ? (na.array as Float32Array) : null;
  if (bend === 0) {
    P.set(rest.pos);
    if (N) N.set(rest.nrm);
  } else {
    const { along: e1, side: e3, normal: e2 } = axes(mast);
    const length = (mast.topZ - mast.baseZ) / Math.cos(mast.rake);
    const u0 = KINK_AT * length;
    const R = BEND_LEN_M / bend;
    for (let i = 0; i < P.length; i += 3) {
      const x = rest.pos[i];
      const y = rest.pos[i + 1];
      const z = rest.pos[i + 2];
      const u = x * e1.x + y * e1.y + z * e1.z;
      const past = u - u0;
      if (past <= 0) {
        P[i] = x;
        P[i + 1] = y;
        P[i + 2] = z;
        if (N) {
          N[i] = rest.nrm[i];
          N[i + 1] = rest.nrm[i + 1];
          N[i + 2] = rest.nrm[i + 2];
        }
        continue;
      }
      const v = x * e2.x + y * e2.y + z * e2.z;
      const w = x * e3.x + y * e3.y + z * e3.z;
      const s = Math.min(past, BEND_LEN_M);
      const th = (bend * s) / BEND_LEN_M;
      const co = Math.cos(th);
      const si = Math.sin(th);
      // The pole's line on the arc, then straight on along its tangent.
      const left = past - s;
      const u2 = u0 + R * si + co * left - si * w;
      const w2 = R * (1 - co) + si * left + co * w;
      P[i] = u2 * e1.x + v * e2.x + w2 * e3.x;
      P[i + 1] = u2 * e1.y + v * e2.y + w2 * e3.y;
      P[i + 2] = u2 * e1.z + v * e2.z + w2 * e3.z;
      if (N) {
        const nx = rest.nrm[i];
        const ny = rest.nrm[i + 1];
        const nz = rest.nrm[i + 2];
        const nu = nx * e1.x + ny * e1.y + nz * e1.z;
        const nv = nx * e2.x + ny * e2.y + nz * e2.z;
        const nw = nx * e3.x + ny * e3.y + nz * e3.z;
        const nu2 = nu * co - nw * si;
        const nw2 = nu * si + nw * co;
        N[i] = nu2 * e1.x + nv * e2.x + nw2 * e3.x;
        N[i + 1] = nu2 * e1.y + nv * e2.y + nw2 * e3.y;
        N[i + 2] = nu2 * e1.z + nv * e2.z + nw2 * e3.z;
      }
    }
  }
  pa.needsUpdate = true;
  if (na) na.needsUpdate = true;
  g.computeBoundingSphere();
}

const local = new Matrix4();
const world = new Matrix4();
const w1 = new Vector3();
const w2 = new Vector3();
const w3 = new Vector3();

/**
 * Poses the foremast (if the model has one apart) for shown time `t`:
 * standing on her with its wires until `foremastLaysAt`, then coming down
 * to its place on the floor, bent (eased), its wires gone.
 */
export function poseForemast(
  model: TitanicHandles,
  spec: Pick<ShipSpec, "decks" | "depth" | "seaDepthM">,
  track: SimTrack,
  t: number
): void {
  const f = model.foremast;
  if (!f) return;
  const { group, mast } = f;
  toThree([mast.x, 0, mast.baseZ], group.position);
  group.quaternion.identity();
  group.scale.set(1, 1, 1);
  const from = foremastLaysAt(track);
  const u = from === null ? 0 : Math.min(1, Math.max(0, t - from) / MAST_LAY_S);
  const k = u * u * (3 - 2 * u);
  model.showForemastWires?.(k === 0);
  const mesh = group.getObjectByName("mast") as Mesh | undefined;
  if (mesh) bendMast(mesh, mast, MAST_BEND_RAD * k);
  if (k === 0) return;
  const wreck = track.frames[track.frames.length - 1].bodies[0];
  foremastFloorSpot(spec, wreck, mast, spot);
  // Lying: its pole along `dir`, its yard flat along `side`.
  const { along, side, normal } = axes(mast);
  local.makeBasis(normal, along, side).invert();
  w2.set(spot.dir[0], spot.dir[1], spot.dir[2]);
  w3.set(spot.side[0], spot.side[1], spot.side[2]);
  w1.crossVectors(w3, w2);
  world.makeBasis(w1, w2, w3).multiply(local);
  world.setPosition(spot.foot[0], spot.foot[1], spot.foot[2]);
  easeToWorld(group, world, k);
}

const axesCache = new WeakMap<object, ReturnType<typeof mastAxes>>();
function axes(mast: MastRecipe) {
  let a = axesCache.get(mast);
  if (!a) {
    a = mastAxes(mast);
    axesCache.set(mast, a);
  }
  return a;
}
