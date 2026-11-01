import {
  type BoatLaunch,
  type EvacuationPlan,
  LOWER_S,
  RAFT_DROP_S,
} from "../crowd/evacuation";
import { DECK_Y, LEVEL_HEIGHT } from "../model/worldFrame";
import type { WalkHalf } from "./halfGrid";
import {
  TURN_RATE,
  WALKER_RADIUS,
  type WalkInput,
  type WalkState,
} from "./types";

/**
 * The escape from a sinking ship, as a player lives it: walking aboard, then
 * leaping into a boat, or into the water and swimming until a boat picks
 * them up or the cold wins. Pure TypeScript: the scene runner and the HUD
 * only read these phases and call these steps.
 *
 * Frame. Everything here is in the resting world frame (one cell is one
 * world unit): a deck walker is mapped in with `walkerRestPoint`, a swimmer
 * keeps world xz directly. `yaw` follows the walk convention, facing
 * `(cos yaw, sin yaw)` in world xz.
 */

/** Swimming speed, world units per second. */
export const SWIM_SPEED = 0.8;
/** A kick adds this much forward speed… */
export const KICK_SPEED = 2;
/** …for this long, seconds. */
export const KICK_S = 0.5;
/** Seconds in the water from warm to frozen. */
export const WARMTH_S = 60;
/** Warmth (0 to 1) at which the cold warning shows. */
export const COLD_WARNING = 0.25;
/** A swimmer this close to a boat's centre is picked up. */
export const PICKUP_RADIUS = 1;
/** A walker this close to a boarding spot may board. */
export const BOARD_RADIUS = 1;
/** How far past the ship's ends and sides the swimmer may go, world units. */
export const SWIM_MARGIN = 12;

/** Seconds a raft stays boardable at the least once it is ready. */
const RAFT_MIN_OPEN_S = 4;

export type EscapeEnding = "deck" | "swim" | "frozen";
export type EscapeBoatKind = "davit" | "raft" | "none";

export interface Swimmer {
  /** World xz (the water). */
  x: number;
  z: number;
  yaw: number;
  /** 1 warm to 0 frozen. */
  warmth: number;
  /** Seconds left of a kick burst. */
  kick: number;
}

export type EscapePhase =
  | { kind: "aboard" }
  | {
      kind: "jumping";
      boatId: string;
      since: number;
      from: { x: number; y: number; z: number };
    }
  | { kind: "in-boat"; boatId: string; since: number; fromWater: boolean }
  | { kind: "swimming"; since: number; swimmer: Swimmer; warned: boolean }
  | { kind: "frozen"; since: number; x: number; z: number };

/** The ship's footprint on the water, world xz, and how far a swimmer may roam. */
export interface HullBox {
  cx: number;
  halfLength: number;
  halfBeam: number;
  /** Swim area: a circle about (cx, 0). */
  radius: number;
}

interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** Where a deck walker stands in the resting world frame. */
export function walkerRestPoint(
  walk: Pick<WalkState, "x" | "z" | "level">,
  length: number,
  beam: number
): Point3 {
  return {
    x: length / 2 - walk.x,
    y: DECK_Y + walk.level * LEVEL_HEIGHT,
    z: beam / 2 - walk.z,
  };
}

/** The sim seconds a walker may board: a davit boat until it lowers, a raft once open. */
export function boardWindow(launch: BoatLaunch): { from: number; to: number } {
  if (launch.kind === "davit") return { from: -Infinity, to: launch.at };
  return {
    from: launch.ready,
    to: Math.max(launch.departs, launch.ready + RAFT_MIN_OPEN_S),
  };
}

/** The nearest boat the walker can board right now, or null. */
export function boardableBoat(
  launches: readonly BoatLaunch[],
  rest: Point3,
  t: number,
  half: WalkHalf | null
): BoatLaunch | null {
  let best: BoatLaunch | null = null;
  let bestDist = Infinity;
  for (const launch of launches) {
    const { spot } = launch;
    if (!spot) continue;
    // Each half has its own boats once she breaks.
    if (half !== null && launch.half !== half) continue;
    const window = boardWindow(launch);
    if (t < window.from || t >= window.to) continue;
    if (Math.abs(rest.y - spot.y) > LEVEL_HEIGHT / 2) continue;
    const dist = Math.hypot(rest.x - spot.x, rest.z - spot.z);
    if (dist > BOARD_RADIUS || dist >= bestDist) continue;
    best = launch;
    bestDist = dist;
  }
  return best;
}

/** Whether the boat is down on the water (so a swimmer can reach it). */
export function isOnWater(launch: BoatLaunch, t: number): boolean {
  const down = launch.kind === "davit" ? LOWER_S : RAFT_DROP_S;
  return t >= launch.at + down;
}

/** The nearest on-the-water boat within reach of a swimmer, or null. */
export function pickupBoat(
  plan: Pick<EvacuationPlan, "launches" | "boatPoseAt">,
  swimmer: Swimmer,
  t: number
): BoatLaunch | null {
  let best: BoatLaunch | null = null;
  let bestDist = Infinity;
  for (const launch of plan.launches) {
    if (!isOnWater(launch, t)) continue;
    const { position } = plan.boatPoseAt(launch, t);
    const dist = Math.hypot(swimmer.x - position.x, swimmer.z - position.z);
    if (dist > PICKUP_RADIUS || dist >= bestDist) continue;
    best = launch;
    bestDist = dist;
  }
  return best;
}

/** The phase for a walker who has just gone into the water, warm. */
export function startSwimming(
  at: { x: number; z: number },
  yaw: number,
  t: number
): EscapePhase {
  return {
    kind: "swimming",
    since: t,
    swimmer: { x: at.x, z: at.z, yaw, warmth: 1, kick: 0 },
    warned: false,
  };
}

function wrapYaw(yaw: number): number {
  const turn = Math.PI * 2;
  return ((((yaw + Math.PI) % turn) + turn) % turn) - Math.PI;
}

function axis(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(-1, value)) : 0;
}

/** One step in the water: turn, swim (or kick), stay out of the hull, lose warmth. */
export function stepSwimmer(
  s: Swimmer,
  input: WalkInput,
  dt: number,
  hull: HullBox
): Swimmer {
  const yaw = wrapYaw(s.yaw + axis(input.turn) * TURN_RATE * dt);
  // A kick burst runs down first; a new one starts only between bursts.
  let kick = Math.max(0, s.kick - dt);
  if (input.jump && kick === 0) kick = KICK_S;

  let forward = axis(input.forward);
  let strafe = axis(input.strafe);
  // Diagonals are no faster than straight.
  const mag = Math.hypot(forward, strafe);
  if (mag > 1) {
    forward /= mag;
    strafe /= mag;
  }
  const fx = Math.cos(yaw);
  const fz = Math.sin(yaw);
  // Right of facing, in world xz (starboard, +z, at yaw 0).
  const rx = -fz;
  const rz = fx;
  const kickForward = kick > 0 ? KICK_SPEED : 0;
  let x =
    s.x +
    ((forward * SWIM_SPEED + kickForward) * fx + strafe * SWIM_SPEED * rx) * dt;
  let z =
    s.z +
    ((forward * SWIM_SPEED + kickForward) * fz + strafe * SWIM_SPEED * rz) * dt;

  // The hull is an obstacle: pushed out along the shortest way, which makes
  // a swimmer slide along its side.
  const ex = hull.halfLength + WALKER_RADIUS;
  const ez = hull.halfBeam + WALKER_RADIUS;
  const dx = x - hull.cx;
  if (Math.abs(dx) < ex && Math.abs(z) < ez) {
    const pushX = ex - Math.abs(dx);
    const pushZ = ez - Math.abs(z);
    if (pushX <= pushZ) x = hull.cx + (dx < 0 ? -ex : ex);
    else z = z < 0 ? -ez : ez;
  }

  // And the open water ends at the swim radius.
  const rdx = x - hull.cx;
  const dist = Math.hypot(rdx, z);
  if (dist > hull.radius) {
    x = hull.cx + (rdx / dist) * hull.radius;
    z = (z / dist) * hull.radius;
  }

  return {
    x,
    z,
    yaw,
    warmth: Math.max(0, s.warmth - dt / WARMTH_S),
    kick,
  };
}

/** How the escape ended, or null while it goes on. */
export function endingOf(phase: EscapePhase): EscapeEnding | null {
  if (phase.kind === "in-boat") return phase.fromWater ? "swim" : "deck";
  if (phase.kind === "frozen") return "frozen";
  return null;
}

/** Scrubbing the clock back before a phase began undoes it. */
export function rewindEscape(phase: EscapePhase, t: number): EscapePhase {
  if (phase.kind === "aboard") return phase;
  return t < phase.since ? { kind: "aboard" } : phase;
}
