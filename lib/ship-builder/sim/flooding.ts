import {
  breakPositionOf,
  halvesAtBreak,
  stepHalves,
  strainOf,
  strengthFor,
} from "./breakup";
import { gashOf } from "./compartments";
import { POWER_OUT_STRAIN, shouldFlicker, withPower } from "./power";
import { floodOf, trialKindOf, type FloodSpec } from "./trialKind";
import {
  SIM_STEP_S,
  type Compartment,
  type CompartmentSpec,
  type SimBreakup,
  type SimEvent,
  type SimHalves,
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
export const INFLOW = 5;
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

/**
 * The storm: nothing comes aboard before this (sim seconds), so she is
 * battered by the wild sea for a while first.
 */
export const STORM_START_S = 10;
/**
 * How fast waves breaking over the deck fill a compartment: a fraction of
 * its depth per second while it is dry, slowing as it fills (see
 * `STORM_TRICKLE`). Tuned so every build sinks 60 to 120 s into the storm.
 */
export const STORM_INFLOW = 0.007;
/**
 * A full compartment still takes this share of `STORM_INFLOW`, so walls slow
 * the storm (the water piles up in the bow) but never stop it.
 */
export const STORM_TRICKLE = 0.25;
/**
 * The waves break hardest over the bow. The weight along the hull is
 * `(p + 1) (1 - x)^p` (x runs 0 at the bow to 1 at the stern, p is this), so
 * its average over the whole ship is 1 however the walls divide her: walls
 * never change how much comes aboard, only where it piles up. Deck-high walls
 * let the bow compartments fill and stop taking water, which is what slows
 * her.
 */
export const STORM_BOW_POWER = 4;
/** The storm trial's window: every build has sunk by this (sim seconds). */
export const STORM_SUNK_BY_S = 120;

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
  input: TrialInput,
  specs: readonly CompartmentSpec[],
  events: readonly SimEvent[]
): TrialReason {
  if (trialKindOf(input) === "storm") return "storm";
  if (specs.length === 1) return "no-bulkheads";
  return hasEvent(events, "spilled") ? "spilled" : "too-many-opened";
}

/**
 * One flooding step while she is sailing: water flows in and over the walls,
 * trim and draft follow, and the trial may end (afloat or the start of the
 * plunge). Returns a new state; it does not advance the roll.
 */
export function stepFlooding(input: TrialInput, state: SimState): SimState {
  const flood = floodOf(input);
  if (!flood || state.phase !== "sailing") return state;
  const { compartments: specs, length } = flood;
  const { iceberg } = input;
  const dt = SIM_STEP_S;
  const time = state.time + dt;
  // The berg is still on its way in, or the storm has not yet built: nothing
  // has come aboard.
  if (time < (iceberg ? ICEBERG_IMPACT_S : STORM_START_S)) {
    return { ...state, time };
  }
  const gash = iceberg
    ? gashOf(iceberg.impactX, length, iceberg.gashLength)
    : null;
  const middle = length / 2;
  const seaDepth = state.pose.sink * SINK_TO_DEPTH;
  const seaLevel = SEA_LEVEL + seaDepth;
  const bowDown = -state.pose.pitch;

  const water = state.compartments.map((c) => c.water);
  let events = state.events;
  let movement = 0;

  for (let i = 0; i < specs.length; i++) {
    const inflow = gash
      ? state.compartments[i].opened
        ? INFLOW * overlapOf(specs[i], gash) * Math.max(0, seaLevel - water[i])
        : 0
      : stormInflowOf(specs[i], water[i], length);
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

  // The lights start to fail once the engine room (or enough of her) floods.
  const lit = shouldFlicker({ ...state, compartments }, specs, length)
    ? withPower({ ...state, events }, "flickering", time)
    : { power: state.power, events };
  events = lit.events;

  if (floodedFraction >= RESERVE) {
    return {
      ...state,
      power: lit.power,
      time,
      phase: "sinking",
      pose,
      compartments,
      events,
      outcome: "sank",
      reason: sankReason(input, specs, events),
    };
  }

  // A storm never lets up: only an iceberg trial can end afloat.
  const hasSettled = movement < SETTLED_EPS && hasEvent(events, "flooding");
  if (iceberg && (hasSettled || time >= ICEBERG_IMPACT_S + ICEBERG_MAX_S)) {
    return {
      ...state,
      time,
      phase: "done",
      power: lit.power,
      pose,
      compartments,
      events,
      outcome: "afloat",
      reason: "held",
    };
  }

  return {
    ...state,
    time,
    power: lit.power,
    pose,
    compartments,
    events,
  };
}

/** Average bow-heavy storm weight over a compartment (1 over the whole hull). */
function stormWashOf(spec: CompartmentSpec, length: number): number {
  const exponent = STORM_BOW_POWER + 1;
  const bow = 1 - spec.fromX / length;
  const stern = 1 - spec.toX / length;
  const span = (spec.toX - spec.fromX) / length;
  return span > 0 ? (bow ** exponent - stern ** exponent) / span : 0;
}

/**
 * Storm water coming over the deck into one compartment (cells x depth per
 * second): heavier toward the bow, slowing as the compartment fills but never
 * stopping.
 */
function stormInflowOf(
  spec: CompartmentSpec,
  water: number,
  length: number
): number {
  const wash = stormWashOf(spec, length);
  const room = Math.max(STORM_TRICKLE, 1 - water);
  return water >= 1 ? 0 : STORM_INFLOW * lengthOf(spec) * wash * room;
}

/** A ship that went under: both halves, or the whole ship, are gone. */
function sunk(state: SimState, time: number): SimState {
  return {
    ...state,
    phase: "done",
    events: [...state.events, { at: time, kind: "sunk" }],
  };
}

/**
 * The step she breaks: the halves start exactly where the whole ship was
 * (her pose from the step before), and the lights go out if they had not.
 */
function breakApart(state: SimState, flood: FloodSpec, time: number): SimState {
  const { length } = flood;
  const atX = breakPositionOf(flood.compartments, state.pose, length);
  const dark = withPower(state, "out", time);
  return {
    ...dark,
    time,
    rollVelocity: 0,
    strain: 0,
    breakup: { at: time, atX, angle: state.pose.pitch },
    halves: halvesAtBreak(state.pose, atX, length),
    events: [...dark.events, { at: time, kind: "broke" }],
  };
}

/** A broken ship: each half follows its own path until both are under. */
function stepBroken(
  state: SimState,
  halves: SimHalves,
  breakup: SimBreakup,
  length: number
): SimState {
  const time = state.time + SIM_STEP_S;
  const next = stepHalves(halves, breakup, length, time);
  const moved = { ...state, time, halves: next.halves };
  return next.isUnder ? sunk(moved, time) : moved;
}

/**
 * Plunging: she goes down by the bow, then the trial ends. In an iceberg or
 * storm trial the bending strain builds as she tips; past her strength she
 * breaks in two (see breakup.ts) and the halves take over from `pose`.
 */
export function stepPlunge(state: SimState, input?: TrialInput): SimState {
  const flood = input ? floodOf(input) : null;
  if (flood && state.halves && state.breakup) {
    return stepBroken(state, state.halves, state.breakup, flood.length);
  }
  const dt = SIM_STEP_S;
  const time = state.time + dt;
  const strength = flood
    ? strengthFor(flood.breakMode, flood.length)
    : Infinity;
  if (flood && state.strain >= strength) {
    return breakApart(state, flood, time);
  }
  const speed = Math.min(
    PLUNGE_SPEED_MAX,
    PLUNGE_SPEED_START + PLUNGE_SPEED_ACCEL * state.pose.sink
  );
  const sink = Math.min(PLUNGE_DEPTH, state.pose.sink + speed * dt);
  const pitch = Math.max(
    PLUNGE_PITCH,
    state.pose.pitch - PLUNGE_PITCH_RATE * dt
  );
  // A storm capsize goes down still upside down; otherwise the roll fades.
  const roll = hasEvent(state.events, "capsized")
    ? state.pose.roll
    : state.pose.roll * Math.max(0, 1 - PLUNGE_ROLL_DAMPING * dt);
  const strain = flood ? strainOf(pitch, flood.length) : 0;
  const isDark =
    strain >= POWER_OUT_STRAIN * strength || sink >= PLUNGE_DEPTH / 3;
  const plunged = withPower(
    {
      ...state,
      time,
      phase: "sinking",
      pose: { roll, pitch, sink },
      rollVelocity: 0,
      strain,
    },
    flood ? (isDark ? "out" : "flickering") : state.power,
    time
  );
  return sink >= PLUNGE_DEPTH ? sunk(plunged, time) : plunged;
}
