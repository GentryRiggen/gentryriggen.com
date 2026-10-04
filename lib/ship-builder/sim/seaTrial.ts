import {
  SIM_STEP_S,
  type SimAction,
  type SimState,
  type TrialInput,
} from "./types";

/**
 * PLACEHOLDER engine so the UI can be built in parallel; it is replaced by the
 * real model. The exported signatures are the contract and must not change.
 */
export function createTrial(input: TrialInput): SimState {
  void input;
  return {
    time: 0,
    phase: "sailing",
    pose: { roll: 0, pitch: 0, sink: 0 },
    rollVelocity: 0,
    compartments: [],
    events: [],
    outcome: null,
    reason: null,
  };
}

/** Advances the trial by one fixed step. Returns a new state. */
export function stepTrial(
  input: TrialInput,
  state: SimState,
  actions: readonly SimAction[] = []
): SimState {
  void actions;
  const time = state.time + SIM_STEP_S;
  const dangerous = input.ship.stabilityRatio >= 0.3;
  if (!dangerous) {
    const roll = 0.15 * Math.sin(time * 1.5);
    const done = time >= 8;
    return {
      ...state,
      time,
      pose: { ...state.pose, roll },
      phase: done ? "done" : "sailing",
      outcome: done ? "steady" : null,
      reason: done ? "stable" : null,
    };
  }
  const t = Math.max(0, time - 3);
  const roll = Math.min(Math.PI, 0.15 * Math.sin(time * 1.5) + t * 0.8);
  const sink = Math.max(0, time - 7) * 1.5;
  const done = time >= 14;
  return {
    ...state,
    time,
    pose: { roll, pitch: 0, sink },
    phase: done
      ? "done"
      : sink > 0
        ? "sinking"
        : t > 0
          ? "capsizing"
          : "sailing",
    outcome: t > 0 ? "capsized" : null,
    reason: t > 0 ? "dangerous" : null,
  };
}

/** Runs a whole trial without rendering: for tests and previews. */
export function runTrial(input: TrialInput, maxSeconds = 30): SimState {
  let state = createTrial(input);
  while (state.phase !== "done" && state.time < maxSeconds) {
    state = stepTrial(input, state);
  }
  return state;
}

/** The sim input for a ship, from its stats and the current sea. */
export { simShipFromStats } from "./simShip";
