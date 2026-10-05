import { CELLS_PER_SEGMENT } from "../../model/grid";
import { emptyShip } from "../../model/placement";
import { computeStats } from "../../model/stats";
import { compartmentSpecsOf } from "../compartments";
import { createTrial, runTrial } from "../seaTrial";
import { simShipFromStats } from "../simShip";
import {
  buildTimeline,
  extendWithDescent,
  slowMoSpeed,
  stateAt,
  timelineDuration,
  timelineEnd,
  SLOW_MO_HOLD_S,
  SLOW_MO_LEAD_S,
  SLOW_MO_RECOVER_S,
  SLOW_MO_SPEED,
  type Timeline,
} from "../timeline";
import { SIM_STEP_S, type SimEvent, type TrialInput } from "../types";

/** A liner with no walls at all: struck anywhere, she sinks. */
function sinkingInput(): TrialInput {
  const ship = emptyShip("liner", "Test", 10, 4);
  return {
    ship: simShipFromStats(computeStats(ship), ship.hull.beam),
    sea: "calm",
    iceberg: {
      compartments: compartmentSpecsOf(ship.hull),
      length: ship.hull.lengthSegments * CELLS_PER_SEGMENT,
      impactX: 5,
    },
  };
}

const CALM: TrialInput = {
  ship: { stabilityRatio: 0, listAngle: 0, beam: 5 },
  sea: "calm",
};

/** A hand-built timeline whose last state logs these events. */
function handBuilt(seconds: number, events: SimEvent[]): Timeline {
  const first = createTrial(CALM);
  const count = Math.round(seconds / SIM_STEP_S) + 1;
  const states = Array.from({ length: count }, (_, i) => ({
    ...first,
    time: i * SIM_STEP_S,
    events: i === count - 1 ? events : [],
  }));
  return { states, descended: false };
}

describe("buildTimeline", () => {
  it("keeps every step from the start to the same end as runTrial", () => {
    const input = sinkingInput();
    const timeline = buildTimeline(input);
    const end = runTrial(input);
    const last = timeline.states[timeline.states.length - 1];

    expect(timeline.states[0].time).toBe(0);
    expect(last.phase).toBe("done");
    expect(last.outcome).toBe("sank");
    expect(last.time).toBeCloseTo(end.time, 6);
    expect(timelineEnd(timeline)).toBeCloseTo(last.time, 6);
    for (let i = 1; i < timeline.states.length; i += 1) {
      expect(timeline.states[i].time).toBeGreaterThan(
        timeline.states[i - 1].time
      );
    }
  });
});

describe("stateAt", () => {
  const timeline = handBuilt(1, []);

  it("indexes by sim time", () => {
    expect(stateAt(timeline, 0.5).time).toBeCloseTo(0.5, 6);
    expect(stateAt(timeline, 0.501).time).toBeCloseTo(0.5, 6);
    expect(stateAt(timeline, 0.4999).time).toBeCloseTo(0.5, 6);
  });

  it("clamps before the start and after the end", () => {
    expect(stateAt(timeline, -3)).toBe(timeline.states[0]);
    expect(stateAt(timeline, 99)).toBe(timeline.states.at(-1));
    expect(stateAt(timeline, Number.NaN)).toBe(timeline.states[0]);
  });
});

describe("slowMoSpeed", () => {
  const BREAK_AT = 5;
  const timeline = handBuilt(10, [{ at: BREAK_AT, kind: "broke" }]);
  const at = (offset: number) => slowMoSpeed(timeline, BREAK_AT + offset);

  it("is 1 everywhere when she never breaks", () => {
    const whole = handBuilt(10, [{ at: 5, kind: "sunk" }]);
    for (let t = 0; t <= 10; t += 0.25) expect(slowMoSpeed(whole, t)).toBe(1);
  });

  it("is normal well before and well after the break", () => {
    expect(at(-SLOW_MO_LEAD_S - 0.01)).toBe(1);
    expect(at(-3)).toBe(1);
    expect(at(SLOW_MO_RECOVER_S)).toBe(1);
    expect(at(4)).toBe(1);
  });

  it("eases down to its slowest by the break and holds there", () => {
    expect(at(-SLOW_MO_LEAD_S / 2)).toBeCloseTo((1 + SLOW_MO_SPEED) / 2, 6);
    expect(at(0)).toBe(SLOW_MO_SPEED);
    expect(at(SLOW_MO_HOLD_S / 2)).toBe(SLOW_MO_SPEED);
    expect(at(SLOW_MO_HOLD_S)).toBe(SLOW_MO_SPEED);
  });

  it("eases back up after the hold, never leaving the 0.25 to 1 range", () => {
    const mid = (SLOW_MO_HOLD_S + SLOW_MO_RECOVER_S) / 2;
    expect(at(mid)).toBeCloseTo((1 + SLOW_MO_SPEED) / 2, 6);
    let previous = at(SLOW_MO_HOLD_S);
    for (let t = SLOW_MO_HOLD_S; t <= SLOW_MO_RECOVER_S; t += 0.05) {
      const speed = at(t);
      expect(speed).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(speed).toBeGreaterThanOrEqual(SLOW_MO_SPEED);
      expect(speed).toBeLessThanOrEqual(1);
      previous = speed;
    }
  });
});

describe("extendWithDescent", () => {
  it("appends the descent after a sinking, one step apart", () => {
    const input = sinkingInput();
    const timeline = buildTimeline(input);
    const extended = extendWithDescent(timeline, input);

    expect(extended.descended).toBe(true);
    expect(extended.states.length).toBeGreaterThan(timeline.states.length);
    expect(extended.states.slice(0, timeline.states.length)).toEqual(
      timeline.states
    );
    expect(extended.states.at(-1)?.phase).toBe("done");
    expect(timelineDuration(extended)).toBeGreaterThanOrEqual(
      timelineDuration(timeline)
    );
  });

  it("leaves a timeline that stayed afloat, or already descended, alone", () => {
    const afloat = buildTimeline(CALM);
    expect(extendWithDescent(afloat, CALM)).toBe(afloat);

    const input = sinkingInput();
    const extended = extendWithDescent(buildTimeline(input), input);
    expect(extendWithDescent(extended, input)).toBe(extended);
  });
});
