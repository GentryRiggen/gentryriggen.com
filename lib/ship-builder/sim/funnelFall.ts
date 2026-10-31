import { DESCENT_SPEED, FLOOR_DEPTH } from "./descent";
import { isTimelineTrial, trialKindOf } from "./trialKind";
import type {
  FunnelFall,
  SimEvent,
  SimState,
  TrialFunnel,
  TrialInput,
} from "./types";

/**
 * Funnels breaking off in a sinking. Pure and stateless apart from the
 * `funnelFalls` and `funnelEnd` it writes into the state, so a replay is
 * identical. `fallingFunnelPose` is the matching pure motion for the scene.
 */

/** The second funnel never falls sooner than this after the first. */
export const SECOND_FALL_GAP_S = 2;
/** A snapped funnel takes this long to topple flat on the water. */
export const TOPPLE_S = 1.2;
/** Then it floats and bobs for this long before it sinks. */
export const FLOAT_S = 2.5;
/** A weather capsize snaps a funnel once the ship has rolled this far. */
const CAPSIZE_SNAP_ROLL = (100 * Math.PI) / 180;
/** An iceberg or storm sinking picks its sinking end once she has tipped this far. */
const END_PITCH = 0.01;
/**
 * A funnel that snaps off deeper than this is "already under water": it
 * sinks on without floating. Shallower, it floats (and the scene splashes).
 */
export const SPLASH_DEPTH = 0.5;
/** Body radius of a lying funnel by default (the small funnel's base). */
export const FUNNEL_REST_RADIUS = 0.42;
/** How far a fallen funnel drifts toward its side, world units, in all. */
const DRIFT_TOTAL = 1.5;
/** Height of the bob while it floats, and how long one bob takes. */
const BOB_HEIGHT = 0.05;
const BOB_PERIOD_S = FLOAT_S / 2;

interface BodyPose {
  roll: number;
  pitch: number;
  sink: number;
  pivotX?: number;
  driftX?: number;
}

/**
 * Where a point of the ship's resting frame is under a body pose: the pure
 * trig twin of the scene. A whole ship (no `pivotX`) turns by Euler
 * `(roll, 0, pitch)` about the origin then drops by `sink`; a half turns
 * about `pivotX` on the keel line, then drifts (`applyHalfPose`).
 */
export function poseWorldPoint(
  pose: BodyPose,
  lengthCells: number,
  point: { x: number; y: number; z: number }
): { x: number; y: number; z: number } {
  const pivot = pose.pivotX === undefined ? 0 : lengthCells / 2 - pose.pivotX;
  const px = point.x - pivot;
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  const cr = Math.cos(pose.roll);
  const sr = Math.sin(pose.roll);
  // Pitch about Z first, then roll about X (three's XYZ Euler order).
  const x = px * cp - point.y * sp;
  const y1 = px * sp + point.y * cp;
  return {
    x: x + pivot + (pose.driftX ?? 0),
    y: y1 * cr - point.z * sr - pose.sink,
    z: y1 * sr + point.z * cr,
  };
}

function targetCountOf(funnels: number): number {
  if (funnels === 0) return 0;
  return funnels <= 2 ? 1 : 2;
}

function hasSunk(events: readonly SimEvent[]): boolean {
  return events.some((event) => event.kind === "sunk");
}

/** The pose of the body that carries a funnel at `cellX`. */
function carrierOf(state: SimState, cellX: number): BodyPose {
  const { halves, breakup } = state;
  if (halves && breakup) {
    return cellX < breakup.atX ? halves.bow : halves.stern;
  }
  return state.pose;
}

function bowPoseOf(state: SimState): { pitch: number } {
  return state.halves ? state.halves.bow : state.pose;
}

const orders = new WeakMap<
  readonly TrialFunnel[],
  Partial<Record<"bow" | "stern", TrialFunnel[]>>
>();

/**
 * Funnels nearest the sinking end first; ties by id. Sorted once per trial
 * (the input's funnel list is fixed for its run) and cached by that list.
 */
function orderFrom(
  funnels: readonly TrialFunnel[],
  end: "bow" | "stern"
): TrialFunnel[] {
  let byEnd = orders.get(funnels);
  if (!byEnd) {
    byEnd = {};
    orders.set(funnels, byEnd);
  }
  const cached = byEnd[end];
  if (cached) return cached;
  const sign = end === "bow" ? 1 : -1;
  const sorted = [...funnels].sort(
    (a, b) =>
      sign * (a.cellX - b.cellX) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  byEnd[end] = sorted;
  return sorted;
}

/** Adds any falls that start this step; returns the state unchanged when none. */
export function stepFunnelFalls(state: SimState, input: TrialInput): SimState {
  const target = targetCountOf(input.funnels.length);
  if (state.funnelFalls.length >= target) return state;
  if (state.outcome !== "sank" && state.outcome !== "capsized") return state;
  const sunk = hasSunk(state.events);
  if (state.phase !== "sinking" && state.phase !== "descending" && !sunk) {
    return state;
  }

  // An iceberg sinking can settle level before she tips: wait for the tip,
  // or the end would be chosen from no pitch at all.
  const pitch = bowPoseOf(state).pitch;
  if (
    !state.funnelEnd &&
    isTimelineTrial(input) &&
    !sunk &&
    Math.abs(pitch) < END_PITCH
  ) {
    return state;
  }
  const end: "bow" | "stern" = state.funnelEnd ?? (pitch < 0 ? "bow" : "stern");
  const withEnd = state.funnelEnd ? state : { ...state, funnelEnd: end };

  const funnel = orderFrom(input.funnels, end)[state.funnelFalls.length];
  const first = state.funnelFalls[0];
  if (first && state.time < first.at + SECOND_FALL_GAP_S) return withEnd;

  const body = carrierOf(state, funnel.cellX);
  const origin = poseWorldPoint(body, input.length, {
    x: input.length / 2 - funnel.cellX,
    y: funnel.baseY,
    z: funnel.baseZ,
  });
  const submerged = origin.y <= 0;
  const rolledOver =
    trialKindOf(input) !== "iceberg" &&
    Math.abs(body.roll) >= CAPSIZE_SNAP_ROLL;
  const timedOut = first ? state.time >= first.at + SECOND_FALL_GAP_S : sunk;
  if (!submerged && !rolledOver && !timedOut) return withEnd;

  const fall: FunnelFall = {
    funnelId: funnel.id,
    at: state.time,
    origin,
    roll: body.roll,
    pitch: body.pitch,
    // Positive roll sinks the +Z side (see `poseWorldPoint`): it topples there.
    side: body.roll >= 0 ? 1 : -1,
  };
  return {
    ...withEnd,
    funnelFalls: [...state.funnelFalls, fall],
    events: [
      ...state.events,
      { at: state.time, kind: "funnel-broke", funnelId: funnel.id },
    ],
  };
}

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/**
 * World transform of a fallen funnel's base at `t` seconds after it snapped.
 * `radius` is its body radius: it lies on the floor with its axis that far up.
 */
export function fallingFunnelPose(
  fall: FunnelFall,
  t: number,
  radius: number = FUNNEL_REST_RADIUS
): {
  position: { x: number; y: number; z: number };
  /** Euler XYZ, radians. */
  rotation: { x: number; y: number; z: number };
} {
  const time = Math.max(0, t);
  const sinkStart = TOPPLE_S + FLOAT_S;
  const drift =
    DRIFT_TOTAL *
    Math.min(1, time / (sinkStart + FLOOR_DEPTH / DESCENT_SPEED)) *
    fall.side;
  const flat = (fall.side * Math.PI) / 2;
  const floor = -FLOOR_DEPTH + radius;

  // One that snaps off already under the water does not come up to float:
  // it topples where it is and sinks straight on from there.
  const isUnder = fall.origin.y < -SPLASH_DEPTH;
  const depth = isUnder ? Math.max(floor, fall.origin.y) : 0;

  let y: number;
  let rotation: { x: number; y: number; z: number };
  if (time < TOPPLE_S) {
    const s = smooth(time / TOPPLE_S);
    y = fall.origin.y + (depth - fall.origin.y) * s;
    if (isUnder) {
      y = Math.max(floor, y - DESCENT_SPEED * time);
    }
    rotation = {
      x: fall.roll + (flat - fall.roll) * s,
      y: 0,
      z: fall.pitch * (1 - s),
    };
  } else if (isUnder) {
    rotation = { x: flat, y: 0, z: 0 };
    y = Math.max(floor, depth - DESCENT_SPEED * time);
  } else {
    rotation = { x: flat, y: 0, z: 0 };
    y =
      time < sinkStart
        ? BOB_HEIGHT *
          Math.sin((2 * Math.PI * (time - TOPPLE_S)) / BOB_PERIOD_S)
        : Math.max(floor, -DESCENT_SPEED * (time - sinkStart));
  }
  return {
    position: { x: fall.origin.x, y, z: fall.origin.z + drift },
    rotation,
  };
}
