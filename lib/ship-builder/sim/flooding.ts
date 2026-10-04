import { gashOf } from "./compartments";
import {
  SIM_STEP_S,
  type Compartment,
  type CompartmentSpec,
  type SimEvent,
  type SimState,
  type TrialInput,
  type TrialReason,
} from "./types";

/**
 * Level 2 flooding: "physics-lite", deterministic and allocation-light.
 *
 * Every compartment holds `water` as a fraction of the hull's depth. The gash
 * lets the sea into the compartments it touches; the sea level outside rises
 * as she sinks, so a contained compartment settles instead of filling. Water
 * that rises above a wall pours into the next compartment. The water's
 * weight sets her trim (pitch) and draft (sink), and both lower the walls
 * toward the bow, so a flooded bow makes its own walls easier to overtop.
 * See README.md for the outcome table.
 */

/** Sea level against the hull before she settles, as a fraction of depth. */
export const SEA_LEVEL = 0.6;
/** How fast the sea pours through the gash (cells of gash per second). */
export const INFLOW = 3;
/** How fast water pours over a wall (cells per second per unit of height). */
export const SPILL_RATE = 20;
/** Bow-down pitch (radians) from the water's weight along the hull. */
export const PITCH_GAIN = 2.2;
/** Draft (world units) from the flooded fraction of the hull. */
export const SINK_GAIN = 5;
/** Converts draft in world units to a fraction of the hull's depth. */
export const SINK_TO_DEPTH = 0.1;
/** How much one radian of bow-down trim lowers a wall, per cell from midships. */
export const TRIM_LEVER = 0.12;
/** Flooded fraction of the hull past which she cannot stay afloat. */
export const RESERVE = 0.3;
/** Total inflow and spill below this (cells per second) means she has settled. */
export const SETTLED_EPS = 0.01;
/** Sim seconds until the iceberg meets the hull; no water comes in before. */
export const ICEBERG_IMPACT_S = 1.5;
/** An iceberg trial that has not sunk this long after impact stays afloat. */
export const ICEBERG_MAX_S = 90;

/** Bow-first plunge once she is past saving. */
export const PLUNGE_PITCH = -0.35;
const PLUNGE_PITCH_RATE = 0.1;
const PLUNGE_SPEED_START = 0.6;
const PLUNGE_SPEED_ACCEL = 0.5;
const PLUNGE_SPEED_MAX = 2.5;
/** How far she goes down before the trial ends. */
export const PLUNGE_DEPTH = 12;
/** The roll from the waves fades out as she plunges. */
const PLUNGE_ROLL_DAMPING = 1.5;

function hasEvent(events: readonly SimEvent[], kind: SimEvent["kind"]) {
  for (const event of events) if (event.kind === kind) return true;
  return false;
}

function lengthOf(spec: CompartmentSpec): number {
  return spec.toX - spec.fromX;
}

/** How much of the compartment the gash covers, in cells. */
function overlapOf(
  spec: CompartmentSpec,
  gash: { fromX: number; toX: number }
): number {
  return Math.max(
    0,
    Math.min(spec.toX, gash.toX) - Math.max(spec.fromX, gash.fromX)
  );
}

/** Why a ship that went under sank, for the result card. */
function sankReason(
  specs: readonly CompartmentSpec[],
  events: readonly SimEvent[]
): TrialReason {
  if (specs.length === 1) return "no-bulkheads";
  return hasEvent(events, "spilled") ? "spilled" : "too-many-opened";
}

/**
 * One flooding step while she is sailing: water flows in and over the walls,
 * trim and draft follow, and the trial may end (afloat or the start of the
 * plunge). Returns a new state; it does not advance the roll.
 */
export function stepFlooding(input: TrialInput, state: SimState): SimState {
  const iceberg = input.iceberg;
  if (!iceberg || state.phase !== "sailing") return state;
  const { compartments: specs, length, impactX } = iceberg;
  const dt = SIM_STEP_S;
  const time = state.time + dt;
  // The berg is still on its way in: nothing has touched the hull yet.
  if (time < ICEBERG_IMPACT_S) return { ...state, time };
  const gash = gashOf(impactX, length);
  const middle = length / 2;
  const seaDepth = state.pose.sink * SINK_TO_DEPTH;
  const seaLevel = SEA_LEVEL + seaDepth;
  const bowDown = -state.pose.pitch;

  const water = state.compartments.map((c) => c.water);
  let events = state.events;
  let movement = 0;

  for (let i = 0; i < specs.length; i++) {
    if (!state.compartments[i].opened) continue;
    const inflow =
      INFLOW * overlapOf(specs[i], gash) * Math.max(0, seaLevel - water[i]);
    if (inflow <= 0) continue;
    water[i] = Math.min(1, water[i] + (inflow * dt) / lengthOf(specs[i]));
    movement += inflow;
    if (!hasEvent(events, "flooding")) {
      events = [...events, { at: time, kind: "flooding" }];
    }
  }

  for (let i = 0; i < specs.length - 1; i++) {
    const wallX = specs[i].toX;
    const wallHeight = Math.min(
      1,
      specs[i].sternWall - bowDown * (middle - wallX) * TRIM_LEVER - seaDepth
    );
    const bowSide = water[i];
    const sternSide = water[i + 1];
    const from = bowSide >= sternSide ? i : i + 1;
    const to = from === i ? i + 1 : i;
    const upper = water[from];
    const lower = water[to];
    if (upper <= wallHeight) continue;
    const flow = SPILL_RATE * (upper - Math.max(wallHeight, lower));
    if (flow <= 0) continue;
    water[from] -= (flow * dt) / lengthOf(specs[from]);
    water[to] = Math.min(1, water[to] + (flow * dt) / lengthOf(specs[to]));
    movement += flow;
    if (!hasEvent(events, "spilled")) {
      events = [...events, { at: time, kind: "spilled" }];
    }
  }

  let flooded = 0;
  let moment = 0;
  const compartments: Compartment[] = new Array(specs.length);
  for (let i = 0; i < specs.length; i++) {
    const volume = water[i] * lengthOf(specs[i]);
    flooded += volume;
    moment += volume * (middle - (specs[i].fromX + specs[i].toX) / 2);
    compartments[i] = { ...state.compartments[i], water: water[i] };
  }
  const floodedFraction = flooded / length;
  const pose = {
    ...state.pose,
    pitch: -(PITCH_GAIN * moment) / (length * length),
    sink: SINK_GAIN * floodedFraction,
  };

  if (floodedFraction >= RESERVE) {
    return {
      ...state,
      time,
      phase: "sinking",
      pose,
      compartments,
      events,
      outcome: "sank",
      reason: sankReason(specs, events),
    };
  }

  const hasSettled = movement < SETTLED_EPS && hasEvent(events, "flooding");
  if (hasSettled || time >= ICEBERG_IMPACT_S + ICEBERG_MAX_S) {
    return {
      ...state,
      time,
      phase: "done",
      pose,
      compartments,
      events,
      outcome: "afloat",
      reason: "held",
    };
  }

  return { ...state, time, pose, compartments, events };
}

/** Plunging: she goes down by the bow, then the trial ends. */
export function stepPlunge(state: SimState): SimState {
  const dt = SIM_STEP_S;
  const time = state.time + dt;
  const speed = Math.min(
    PLUNGE_SPEED_MAX,
    PLUNGE_SPEED_START + PLUNGE_SPEED_ACCEL * state.pose.sink
  );
  const sink = Math.min(PLUNGE_DEPTH, state.pose.sink + speed * dt);
  const pitch = Math.max(
    PLUNGE_PITCH,
    state.pose.pitch - PLUNGE_PITCH_RATE * dt
  );
  const roll = state.pose.roll * Math.max(0, 1 - PLUNGE_ROLL_DAMPING * dt);
  const isDone = sink >= PLUNGE_DEPTH;
  return {
    ...state,
    time,
    phase: isDone ? "done" : "sinking",
    pose: { roll, pitch, sink },
    rollVelocity: 0,
    events: isDone
      ? [...state.events, { at: time, kind: "sunk" }]
      : state.events,
  };
}
