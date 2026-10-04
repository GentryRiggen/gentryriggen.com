import { STABILITY_THRESHOLDS } from "../model/stats";
import {
  SIM_STEP_S,
  type Compartment,
  type SimAction,
  type SimEvent,
  type SimSea,
  type SimShip,
  type SimState,
  type TrialInput,
  type TrialOutcome,
  type TrialReason,
} from "./types";
import { ICEBERG_MAX_S, stepFlooding, stepPlunge } from "./flooding";
import { openedBy } from "./compartments";

/**
 * Level 1 sea trial: "physics-lite", deterministic and allocation-light.
 *
 * Roll is a damped oscillator driven by waves. How hard the waves push, and
 * how far the ship can heel before she can't come back (the capsize angle),
 * both come from one "severity" number built from the ship's stability class
 * and how lopsided she is, so the outcomes follow the teachable table in
 * README.md. Each step runs a small pipeline (see `stepTrial`) that later
 * levels extend.
 */

const DEG = Math.PI / 180;

/** Seconds a trial that doesn't capsize lasts. */
export const TRIAL_DURATION_S = 9;
/** The sea builds up over this long so the ship isn't kicked at time 0. */
const SEA_RAMP_S = 1.5;
/** A capsize is only declared after this long, so it never happens at once. */
const CAPSIZE_GRACE_S = 1;

/** Roll away from the resting list that counts as a big roll. */
const BIG_ROLL = 20 * DEG;
/** Back inside this much roll after a big one counts as recovered. */
const RECOVERED_ROLL = 10 * DEG;
/** The ship lies this far over once capsized. */
const CAPSIZED_ROLL = 170 * DEG;
/** Rolling over speeds up to this (rad/s). */
const CAPSIZE_MAX_SPEED = 1.6;
const CAPSIZE_ACCEL = 1.2;
/** Capsized past this roll, the ship starts to go under. */
const SINK_START_ROLL = 120 * DEG;

/** Sinking is slow and gentle: units below the waterline, then it ends. */
export const SINK_DEPTH = 12;
const SINK_START_SPEED = 0.25;
const SINK_ACCEL = 0.3;
const SINK_MAX_SPEED = 1.6;
/** Bow-down pitch while sinking, in radians. */
const SINK_PITCH = 0.22;

/** List above which the ship counts as lopsided: one step worse. */
export const LOPSIDED_LIST = 8 * DEG;
/** List at which she capsizes in any sea. */
export const HEAVY_LIST = 18 * DEG;
/** The lopsided step fades in over this much list before its threshold. */
const LOPSIDED_BLEND = 1 * DEG;

/** Roll oscillator: natural frequency (rad/s) and damping ratio. */
const NATURAL_FREQ = 3;
const DAMPING = 0.35;

interface SeaWaves {
  /** Peak wave slope in radians. */
  slope: number;
  /** Speed multiplier on the wave frequencies. */
  speed: number;
}

// Mirrors the amplitudes and speeds in components/ship-builder/scene/seaState.ts
// (lib can't import components); the slope scales the scene amplitude.
const SEAS: Record<SimSea, SeaWaves> = {
  calm: { slope: 0.03 * 1.3, speed: 0.6 },
  choppy: { slope: 0.2 * 0.75, speed: 1 },
  stormy: { slope: 0.45 * 0.7, speed: 1.6 },
};

/** The scene's three waves: weights sum to 1; frequencies in rad/s. */
const WAVES = [
  { weight: 0.5, omega: 1.1, phase: 0.6 },
  { weight: 0.3, omega: 1.5, phase: 2.1 },
  { weight: 0.2, omega: 2, phase: 4.0 },
] as const;

/** Severity tiers: 0 stable, 1 top-heavy, 2 dangerous, 3 and 4 beyond. */
const MAX_SEVERITY = 4;
/** How hard the sea heels a ship at each tier (times the wave slope). */
const PUSH_BY_SEVERITY = [1.25, 5, 24, 55, 70] as const;
/** Heel angle (radians) she cannot come back from, by tier. */
const CAPSIZE_ANGLE_BY_SEVERITY = [
  75 * DEG,
  70 * DEG,
  60 * DEG,
  35 * DEG,
  8 * DEG,
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Linear lookup between tiers for a fractional severity. */
function byTier(values: readonly number[], severity: number): number {
  const low = Math.min(Math.floor(severity), MAX_SEVERITY - 1);
  const t = severity - low;
  return values[low] + (values[low + 1] - values[low]) * t;
}

/** Steep blends around each stability threshold: 0 stable, 1, 2 dangerous. */
function stabilitySeverity(stabilityRatio: number): number {
  const { topHeavy, dangerous } = STABILITY_THRESHOLDS;
  return (
    smoothstep(topHeavy - 0.02, topHeavy + 0.01, stabilityRatio) +
    smoothstep(dangerous - 0.02, dangerous + 0.01, stabilityRatio)
  );
}

function lopsidedStep(list: number): number {
  return smoothstep(
    LOPSIDED_LIST - LOPSIDED_BLEND,
    LOPSIDED_LIST,
    Math.abs(list)
  );
}

function heavyStep(list: number): number {
  return smoothstep(HEAVY_LIST - LOPSIDED_BLEND, HEAVY_LIST, Math.abs(list));
}

/** Overall severity of a ship, 0 (stable) to MAX_SEVERITY. */
export function severityOf(ship: SimShip): number {
  const withList =
    stabilitySeverity(ship.stabilityRatio) + lopsidedStep(ship.listAngle);
  return Math.max(
    Math.min(withList, MAX_SEVERITY - 1),
    heavyStep(ship.listAngle) * MAX_SEVERITY
  );
}

/** The ship and sea, boiled down to what the oscillator needs. */
interface TrialParams {
  /** Peak heeling from the waves, radians. */
  push: number;
  speed: number;
  /**
   * 1, or -1 for a ship listing to port, so a mirrored ship plays out as an
   * exact mirror image: the waves lean toward the heavy side first.
   */
  side: 1 | -1;
  /** Angle past which she cannot recover. */
  capsizeAngle: number;
  list: number;
}

function paramsOf(input: TrialInput): TrialParams {
  const severity = severityOf(input.ship);
  const sea = SEAS[input.sea];
  return {
    push: sea.slope * byTier(PUSH_BY_SEVERITY, severity),
    speed: sea.speed,
    side: input.ship.listAngle < 0 ? -1 : 1,
    capsizeAngle: byTier(CAPSIZE_ANGLE_BY_SEVERITY, severity),
    list: input.ship.listAngle,
  };
}

/** Deterministic wave height in -1..1; the same every run. */
function wave(time: number, speed: number): number {
  let sum = 0;
  for (const w of WAVES) {
    sum += w.weight * Math.sin(w.omega * speed * time + w.phase);
  }
  return sum * smoothstep(0, SEA_RAMP_S, time);
}

/**
 * Righting torque shape: proportional up to a knee, fading to nothing at the
 * capsize angle, and pushing the ship over beyond it.
 */
function righting(angle: number, capsizeAngle: number): number {
  const knee = capsizeAngle * 0.6;
  const magnitude = Math.abs(angle);
  const sign = Math.sign(angle);
  if (magnitude <= knee) return angle;
  return sign * (knee * ((capsizeAngle - magnitude) / (capsizeAngle - knee)));
}

/** Which stability tier she is in with no list: stable, top-heavy, dangerous. */
function baseTier(ship: SimShip): 0 | 1 | 2 {
  const { topHeavy, dangerous } = STABILITY_THRESHOLDS;
  if (ship.stabilityRatio >= dangerous) return 2;
  return ship.stabilityRatio >= topHeavy ? 1 : 0;
}

/**
 * The outcome table for a ship with NO list, by tier and sea. Only used to
 * explain why a trial ended; the outcome itself comes from the oscillator.
 */
const TABLE: Record<0 | 1 | 2, Record<SimSea, TrialOutcome>> = {
  0: { calm: "steady", choppy: "steady", stormy: "recovered" },
  1: { calm: "steady", choppy: "recovered", stormy: "capsized" },
  2: { calm: "recovered", choppy: "capsized", stormy: "capsized" },
};

const TIER_REASON: Record<0 | 1 | 2, TrialReason> = {
  0: "stable",
  1: "top-heavy",
  2: "dangerous",
};

/** The main cause of an outcome in plain terms. */
export function reasonFor(
  input: TrialInput,
  outcome: TrialOutcome
): TrialReason {
  const tier = baseTier(input.ship);
  // Same blend as severityOf: once the list adds any severity it can be the
  // cause, so a stable ship in the 7 to 8 degree window is not called stable.
  if (
    lopsidedStep(input.ship.listAngle) > 0 &&
    TABLE[tier][input.sea] !== outcome
  ) {
    return "lopsided";
  }
  if (outcome === "recovered" && tier === 0) return "rough-sea";
  return TIER_REASON[tier];
}

function hasEvent(events: readonly SimEvent[], kind: SimEvent["kind"]) {
  for (const event of events) if (event.kind === kind) return true;
  return false;
}

/** A step of the trial pipeline: state in, next state out. */
type StepFn = (
  input: TrialInput,
  params: TrialParams,
  state: SimState
) => SimState;

/** Level 2: dry compartments, those the gash touches marked as opened. */
function compartmentsOf(input: TrialInput): Compartment[] {
  const { iceberg } = input;
  if (!iceberg) return [];
  const opened = new Set(
    openedBy(iceberg.compartments, iceberg.impactX, iceberg.length)
  );
  return iceberg.compartments.map((spec) => ({
    id: spec.id,
    water: 0,
    opened: opened.has(spec.id),
  }));
}

export function createTrial(input: TrialInput): SimState {
  return {
    time: 0,
    phase: "sailing",
    pose: { roll: input.ship.listAngle, pitch: 0, sink: 0 },
    rollVelocity: 0,
    compartments: compartmentsOf(input),
    events: [],
    outcome: null,
    reason: null,
  };
}

function addEvent(
  events: SimEvent[],
  at: number,
  kind: SimEvent["kind"]
): SimEvent[] {
  return [...events, { at, kind }];
}

/** Sailing: waves heel the ship; she rights herself or passes the point. */
const stepSailing: StepFn = (input, params, state) => {
  const dt = SIM_STEP_S;
  const time = state.time + dt;
  const { capsizeAngle, list } = params;
  const roll = state.pose.roll;

  const heeling =
    NATURAL_FREQ *
    NATURAL_FREQ *
    params.push *
    params.side *
    wave(time, params.speed);
  const restoringHere = righting(roll, capsizeAngle);
  const restingTorque = righting(list, capsizeAngle);
  const accel =
    -2 * DAMPING * NATURAL_FREQ * state.rollVelocity -
    NATURAL_FREQ * NATURAL_FREQ * (restoringHere - restingTorque) +
    heeling;

  const rollVelocity = state.rollVelocity + accel * dt;
  const nextRoll = roll + rollVelocity * dt;
  const deviation = Math.abs(nextRoll - list);

  let events = state.events;
  const hadBigRoll = hasEvent(events, "big-roll");
  const hasRecovered = hasEvent(events, "recovered");
  if (!hadBigRoll && deviation > BIG_ROLL) {
    events = addEvent(events, time, "big-roll");
  } else if (hadBigRoll && !hasRecovered && deviation < RECOVERED_ROLL) {
    events = addEvent(events, time, "recovered");
  }

  if (Math.abs(nextRoll) > capsizeAngle && time >= CAPSIZE_GRACE_S) {
    return {
      ...state,
      time,
      phase: "capsizing",
      pose: { ...state.pose, roll: nextRoll },
      rollVelocity: Math.sign(nextRoll) * Math.max(Math.abs(rollVelocity), 0.2),
      events: addEvent(events, time, "capsized"),
      outcome: "capsized",
      reason: reasonFor(input, "capsized"),
    };
  }

  // An iceberg trial ends when the flooding settles or she sinks.
  if (time >= TRIAL_DURATION_S && !input.iceberg) {
    const outcome = hasEvent(events, "big-roll") ? "recovered" : "steady";
    return {
      ...state,
      time,
      phase: "done",
      pose: { ...state.pose, roll: nextRoll },
      rollVelocity,
      events,
      outcome,
      reason: reasonFor(input, outcome),
    };
  }

  return {
    ...state,
    time,
    pose: { ...state.pose, roll: nextRoll },
    rollVelocity,
    events,
  };
};

/** Capsizing: she rolls the rest of the way over, then starts to go under. */
const stepCapsizing: StepFn = (_input, _params, state) => {
  const dt = SIM_STEP_S;
  const direction = Math.sign(state.rollVelocity) || 1;
  const speed = Math.min(
    CAPSIZE_MAX_SPEED,
    Math.abs(state.rollVelocity) + CAPSIZE_ACCEL * dt
  );
  const magnitude = Math.min(
    CAPSIZED_ROLL,
    Math.abs(state.pose.roll) + speed * dt
  );
  const roll = direction * magnitude;
  const isOver = magnitude >= SINK_START_ROLL;
  return {
    ...state,
    time: state.time + dt,
    phase: isOver ? "sinking" : "capsizing",
    pose: { ...state.pose, roll },
    rollVelocity: direction * (magnitude >= CAPSIZED_ROLL ? 0 : speed),
  };
};

/** Sinking: slowly down by the bow; the trial ends when she is under. */
const stepSinking: StepFn = (_input, _params, state) => {
  const dt = SIM_STEP_S;
  const time = state.time + dt;
  const direction = Math.sign(state.pose.roll) || 1;
  const roll =
    direction *
    Math.min(CAPSIZED_ROLL, Math.abs(state.pose.roll) + CAPSIZE_MAX_SPEED * dt);
  // Speeds up as she goes, so the sinking is slow at first, then steadier.
  const speed = Math.min(
    SINK_MAX_SPEED,
    SINK_START_SPEED + SINK_ACCEL * state.pose.sink
  );
  const sink = Math.min(SINK_DEPTH, state.pose.sink + speed * dt);
  const done = sink >= SINK_DEPTH;
  return {
    ...state,
    time,
    phase: done ? "done" : "sinking",
    pose: {
      roll,
      pitch: -SINK_PITCH * smoothstep(0, SINK_DEPTH * 0.5, sink),
      sink,
    },
    rollVelocity: 0,
    events: done ? addEvent(state.events, time, "sunk") : state.events,
  };
};

/**
 * Advances the trial by one fixed step. Returns a new state.
 *
 * Each phase is one small step function. Level 2 adds a flooding step before
 * the phase step (compartments change pitch, sink and the capsize angle);
 * Level 3 applies `actions` first. See README.md.
 */
export function stepTrial(
  input: TrialInput,
  state: SimState,
  actions: readonly SimAction[] = []
): SimState {
  void actions;
  if (state.phase === "done") return state;
  if (input.iceberg && state.phase === "sailing") {
    const flooded = stepFlooding(input, state);
    if (flooded.phase !== "sailing") return flooded;
    return stepSailing(input, paramsOf(input), flooded);
  }
  if (state.phase === "sinking" && state.outcome === "sank") {
    return stepPlunge(state);
  }
  const params = paramsOf(input);
  switch (state.phase) {
    case "sailing":
      return stepSailing(input, params, state);
    case "capsizing":
      return stepCapsizing(input, params, state);
    case "sinking":
      return stepSinking(input, params, state);
  }
}

/** Runs a whole trial without rendering: for tests and previews. */
export function runTrial(
  input: TrialInput,
  maxSeconds = input.iceberg ? ICEBERG_MAX_S + 30 : 30
): SimState {
  let state = createTrial(input);
  while (state.phase !== "done" && state.time < maxSeconds) {
    state = stepTrial(input, state);
  }
  return state;
}

/** The sim input for a ship, from its stats and the current sea. */
export { simShipFromStats } from "./simShip";
