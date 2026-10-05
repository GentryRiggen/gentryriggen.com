import { CELLS_PER_SEGMENT } from "../../model/grid";
import { computeStats } from "../../model/stats";
import type { Ship } from "../../model/types";
import { findTemplate } from "../../templates";
import {
  bowSpan,
  deepestDepth,
  sternSpan,
  wholeSpan,
  type BodySpan,
} from "../breakup";
import { compartmentSpecsOf } from "../compartments";
import {
  FLOOR_DEPTH,
  REST_PITCH_BOW,
  REST_PITCH_STERN,
  SETTLE_S,
  startDescent,
} from "../descent";
import { runTrial, stepTrial } from "../seaTrial";
import { simShipFromStats } from "../simShip";
import type { BreakMode, SimState, TrialInput } from "../types";

function templateShip(id: string): Ship {
  const template = findTemplate(id);
  if (!template) throw new Error(`no template ${id}`);
  return template.build();
}

function icebergInput(id: string, impactX: number, breakMode: BreakMode) {
  const ship = templateShip(id);
  const length = ship.hull.lengthSegments * CELLS_PER_SEGMENT;
  const input: TrialInput = {
    ship: simShipFromStats(computeStats(ship), ship.hull.beam),
    sea: "calm",
    iceberg: {
      compartments: compartmentSpecsOf(ship.hull),
      length,
      impactX,
      breakMode,
    },
  };
  return input;
}

/** The descent's states, from the first descending step to done. */
function descend(input: TrialInput): SimState[] {
  const states = [startDescent(runTrial(input))];
  while (states[states.length - 1].phase !== "done") {
    const next = stepTrial(input, states[states.length - 1]);
    states.push(next);
    if (states.length > 60 * 60) throw new Error("never landed");
  }
  return states;
}

/** Every body in a state with its keel span. */
function bodiesOf(state: SimState, length: number) {
  const { halves, breakup } = state;
  if (halves && breakup) {
    return [
      { ...halves.bow, span: bowSpan(breakup.atX), rest: REST_PITCH_BOW },
      {
        ...halves.stern,
        span: sternSpan(breakup.atX, length),
        rest: REST_PITCH_STERN,
      },
    ];
  }
  return [{ ...state.pose, span: wholeSpan(length), rest: REST_PITCH_BOW }];
}

function deepest(body: { sink: number; pitch: number; span: BodySpan }) {
  return deepestDepth(body.sink, body.pitch, body.span);
}

function touchdowns(state: SimState): number[] {
  return state.events
    .filter((e) => e.kind === "touched-bottom")
    .map((e) => e.at);
}

describe("startDescent", () => {
  it("only follows a finished trial that sank", () => {
    const input = icebergInput("titanic", 5, "never");
    const sunk = runTrial(input);
    expect(startDescent(sunk).phase).toBe("descending");
    const afloat = runTrial(icebergInput("britannic", 5, "real"));
    expect(startDescent(afloat)).toBe(afloat);
    const waves: TrialInput = {
      ship: { stabilityRatio: 0.45, listAngle: 0, beam: 4 },
      sea: "stormy",
    };
    const capsized = runTrial(waves);
    expect(startDescent(capsized)).toBe(capsized);
  });
});

describe.each([
  ["whole ship", "never" as BreakMode, 1],
  ["broken ship", "real" as BreakMode, 2],
])("descent of a %s", (_name, mode, bodies) => {
  const input = icebergInput("titanic", 5, mode);
  const length = input.iceberg!.length;
  const states = descend(input);
  const last = states[states.length - 1];

  it("lands every body once on the floor", () => {
    expect(touchdowns(last)).toHaveLength(bodies);
    for (const body of bodiesOf(last, length)) {
      expect(deepest(body)).toBeCloseTo(FLOOR_DEPTH, 6);
    }
  });

  it("never sinks into the sand", () => {
    for (const state of states) {
      for (const body of bodiesOf(state, length)) {
        expect(deepest(body)).toBeLessThanOrEqual(FLOOR_DEPTH + 1e-6);
      }
    }
  });

  it("logs the touchdown the step the body reaches the floor", () => {
    for (const at of touchdowns(last)) {
      const index = states.findIndex((s) => s.time >= at - 1e-9);
      const landed = bodiesOf(states[index], length).some(
        (body) => Math.abs(deepest(body) - FLOOR_DEPTH) < 1e-6
      );
      expect(landed).toBe(true);
    }
  });

  it("comes to rest at its resting angles soon after the last touchdown", () => {
    for (const body of bodiesOf(last, length)) {
      expect(body.pitch).toBeCloseTo(body.rest, 1);
      expect(Math.abs(body.roll)).toBeLessThan(0.1);
    }
    const lastTouch = Math.max(...touchdowns(last));
    expect(last.time - lastTouch).toBeLessThanOrEqual(SETTLE_S + 1e-9);
    expect(last.phase).toBe("done");
    expect(stepTrial(input, last)).toBe(last);
  });

  it("is the same every run", () => {
    expect(descend(input)).toEqual(states);
  });
});
