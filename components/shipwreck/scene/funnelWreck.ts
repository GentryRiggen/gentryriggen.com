import { Matrix4, Quaternion, Vector3, type Group } from "three";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
import { shipToThreeInto, type V3 } from "./cameraMath";

/**
 * The Britannic's fallen funnels on the floor [WP]: "funnel 1 lies a few
 * metres from the boat deck", funnels 2–4 in the debris field off her
 * stern. A funnel falls as the sim says (`funnel-falls`, Effects topples
 * it), then sinks to its place beside her wreck (`FUNNEL_SINK_S`) and
 * lies there on its side. The model's own funnel groups are moved (no
 * new meshes, no draws). Places are a rule, not physics: worked out from
 * the wreck's pose (the track's last frame) in her ship frame, then laid
 * on the floor.
 */

/** Seconds from a funnel's fall to lying on the floor (about 3 m/s down). */
export const FUNNEL_SINK_S = 40;
/** Seconds the topple takes before it sinks (Effects: 4.5 s). */
export const FUNNEL_TOPPLE_S = 4.5;

/** Ship-frame spots in the wreck's frame (x, out from the deck), and a turn. */
const SPOTS: readonly { x: number; out: number; turn: number }[] = [
  // Funnel 1: beside her boat deck, its foot toward the deck.
  { x: 46, out: 14, turn: 0.25 },
  // Funnels 2–4: off her stern, scattered.
  { x: -175, out: 12, turn: 1.1 },
  { x: -205, out: -18, turn: -0.6 },
  { x: -232, out: 30, turn: 2.2 },
];

export interface FloorSpot {
  /** The funnel's middle on the floor (three axes). */
  centre: V3;
  /** Along its length, foot to top (three, horizontal unit). */
  dir: V3;
}

/**
 * Where funnel `i` lies on the floor beside the wreck (`pose`, her last
 * frame): its middle `lift` m over the floor, its length level.
 */
export function funnelFloorSpot(
  spec: Pick<ShipSpec, "decks" | "depth" | "seaDepthM">,
  pose: BodyPose,
  i: number,
  out: FloorSpot = { centre: [0, 0, 0], dir: [1, 0, 0] }
): FloorSpot {
  const s = SPOTS[Math.min(i, SPOTS.length - 1)];
  const boat = spec.decks.find((d) => d.name === "Boat")?.z ?? spec.depth;
  // Her deck faces sideways on her side: "out" is along her ship z.
  const a = shipToThreeInto(pose, [s.x, 0, boat + s.out], [0, 0, 0]);
  const b = shipToThreeInto(pose, [s.x, 0, boat + s.out + 10], [0, 0, 0]);
  let dx = b[0] - a[0];
  let dz = b[2] - a[2];
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const c = Math.cos(s.turn);
  const sn = Math.sin(s.turn);
  out.dir[0] = dx * c - dz * sn;
  out.dir[1] = 0;
  out.dir[2] = dx * sn + dz * c;
  out.centre[0] = a[0] + out.dir[0] * 9;
  out.centre[1] = -spec.seaDepthM + FUNNEL_LIFT_M;
  out.centre[2] = a[2] + out.dir[2] * 9;
  return out;
}

/** A funnel's middle over the floor as it lies (part sunk in the mud). */
export const FUNNEL_LIFT_M = 2.4;

const up = new Vector3(0, 1, 0);
const ax = new Vector3();
const ay = new Vector3();
const want = new Matrix4();
const now = new Matrix4();
const inv = new Matrix4();
const pos = new Vector3();
const q = new Quaternion();
const q2 = new Quaternion();
const sc = new Vector3();
const spot: FloorSpot = { centre: [0, 0, 0], dir: [1, 0, 0] };

/**
 * Moves a fallen funnel's group (its foot at its origin, its length along
 * its local +y) from where it toppled toward its floor spot: `u` 0 where
 * Effects left it, 1 on the floor. No allocation.
 */
export function layFunnel(
  group: Group,
  height: number,
  spec: Pick<ShipSpec, "decks" | "depth" | "seaDepthM">,
  wreck: BodyPose,
  i: number,
  u: number
): void {
  const parent = group.parent;
  if (!parent) return;
  funnelFloorSpot(spec, wreck, i, spot);
  // Lying: its length along `dir`, its athwart half-axis (local z) up.
  ay.set(spot.dir[0], 0, spot.dir[2]);
  ax.crossVectors(ay, up);
  want.makeBasis(ax, ay, up);
  pos
    .set(spot.centre[0], spot.centre[1], spot.centre[2])
    .addScaledVector(ay, -height / 2);
  want.setPosition(pos);
  parent.updateMatrixWorld();
  group.updateMatrixWorld();
  if (u < 1) {
    // From its toppled pose, sinking (slerp, then lerp).
    now.copy(group.matrixWorld);
    now.decompose(pos, q, sc);
    want.decompose(ay, q2, sc);
    q.slerp(q2, u);
    pos.lerp(ay, u);
    want.compose(pos, q, sc.set(1, 1, 1));
  }
  inv.copy(parent.matrixWorld).invert();
  want.premultiply(inv);
  want.decompose(group.position, group.quaternion, group.scale);
}
