import { DESCENT_SPEED, FLOOR_DEPTH } from "./descent";
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

/** Funnels nearest the sinking end first; ties by id. */
function orderFrom(
  funnels: readonly TrialFunnel[],
  end: "bow" | "stern"
): TrialFunnel[] {
  const sign = end === "bow" ? 1 : -1;
  return [...funnels].sort(
    (a, b) =>
      sign * (a.cellX - b.cellX) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
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

  const end: "bow" | "stern" =
    state.funnelEnd ?? (bowPoseOf(state).pitch < 0 ? "bow" : "stern");
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
  const rolledOver = !input.iceberg && Math.abs(body.roll) >= CAPSIZE_SNAP_ROLL;
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

/** World transform of a fallen funnel's base at `t` seconds after it snapped. */
export function fallingFunnelPose(
  fall: FunnelFall,
  t: number
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

  let y: number;
  let rotation: { x: number; y: number; z: number };
  if (time < TOPPLE_S) {
    const s = smooth(time / TOPPLE_S);
    y = fall.origin.y * (1 - s);
    rotation = {
      x: fall.roll + (flat - fall.roll) * s,
      y: 0,
      z: fall.pitch * (1 - s),
    };
  } else {
    rotation = { x: flat, y: 0, z: 0 };
    y =
      time < sinkStart
        ? BOB_HEIGHT *
          Math.sin((2 * Math.PI * (time - TOPPLE_S)) / BOB_PERIOD_S)
        : -Math.min(FLOOR_DEPTH, DESCENT_SPEED * (time - sinkStart));
  }
  return {
    position: { x: fall.origin.x, y, z: fall.origin.z + drift },
    rotation,
  };
}
