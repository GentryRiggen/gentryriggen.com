import { createTrial, runTrial } from "@/lib/ship-builder/sim/seaTrial";
import {
  buildTimeline,
  timelineEnd,
  SLOW_MO_SPEED,
  type Timeline,
} from "@/lib/ship-builder/sim/timeline";
import {
  SIM_STEP_S,
  type SimEvent,
  type TrialInput,
} from "@/lib/ship-builder/sim/types";
import {
  advanceTimelineClock,
  isTimelineClockDone,
  startTimelineClock,
  writeTimelinePlayback,
  advanceTrial,
  jumpTrial,
  advanceEffectsClock,
  writeInstantPlayback,
  resetPlayback,
  writePlayback,
  type TrialClock,
  type TrialPlayback,
} from "../trialPlayback";
import { bubbleIntensity, splashDroplet, createDroplet } from "../trialEffects";
import { isHeavyTrialPose } from "../trialPose";

const TOP_HEAVY: TrialInput = {
  ship: { stabilityRatio: 0.5, listAngle: 0, beam: 3 },
  sea: "stormy",
};
const STEADY: TrialInput = {
  ship: { stabilityRatio: 0, listAngle: 0, beam: 5 },
  sea: "calm",
};

function freshClock(input: TrialInput): TrialClock {
  return { state: createTrial(input), leftover: 0 };
}

describe("advanceTrial", () => {
  it("spends frame time on whole fixed steps", () => {
    const clock = advanceTrial(STEADY, freshClock(STEADY), SIM_STEP_S * 3.5);
    expect(clock.state.time).toBeCloseTo(SIM_STEP_S * 3, 6);
    expect(clock.leftover).toBeCloseTo(SIM_STEP_S * 0.5, 6);
  });

  it("clamps a huge frame gap", () => {
    const clock = advanceTrial(STEADY, freshClock(STEADY), 30);
    expect(clock.state.time).toBeLessThanOrEqual(0.101);
  });

  it("scales by speed and stops at the hold time", () => {
    const clock = advanceTrial(STEADY, freshClock(STEADY), 0.1, 10, 0.5);
    expect(clock.state.time).toBeGreaterThanOrEqual(0.5);
    expect(clock.state.time).toBeLessThan(0.52);
  });
});

describe("jumpTrial", () => {
  it("steps to the requested time", () => {
    const clock = jumpTrial(TOP_HEAVY, freshClock(TOP_HEAVY), 4);
    expect(clock.state.time).toBeGreaterThanOrEqual(4);
    expect(clock.state.time).toBeLessThan(4.1);
  });

  it("stops at the end of a short trial", () => {
    const clock = jumpTrial(STEADY, freshClock(STEADY), 500);
    expect(clock.state.phase).toBe("done");
  });
});

describe("writePlayback", () => {
  it("records the pose and when each phase began", () => {
    const target: TrialPlayback = {} as TrialPlayback;
    resetPlayback(target);
    let clock = freshClock(TOP_HEAVY);
    while (clock.state.phase !== "done") {
      clock = advanceTrial(TOP_HEAVY, clock, 0.05);
      writePlayback(clock.state, target);
    }
    expect(target.capsizedAt).not.toBeNull();
    expect(target.sinkingAt).toBeGreaterThanOrEqual(target.capsizedAt ?? 0);
    expect(target.doneAt).toBe(target.time);
    expect(target.sink).toBeGreaterThan(0);
  });

  it("leaves a steady ship's milestones empty", () => {
    const target: TrialPlayback = {} as TrialPlayback;
    resetPlayback(target);
    writePlayback(runTrial(STEADY), target);
    expect(target.capsizedAt).toBeNull();
    expect(target.sinkingAt).toBeNull();
  });
});

describe("trial effects", () => {
  it("bubbles ramp in once she goes over and fade after the end", () => {
    const base: TrialPlayback = {
      roll: 0,
      pitch: 0,
      sink: 0,
      blend: 0,
      phase: "capsizing",
      time: 5,
      capsizedAt: 5,
      sinkingAt: null,
      doneAt: null,
      strain: 0,
      power: "on",
      breakup: null,
      halves: null,
      events: [],
      speed: 1,
      scrubbing: false,
    };
    expect(bubbleIntensity({ ...base, capsizedAt: null })).toBe(0);
    expect(bubbleIntensity(base)).toBe(0);
    expect(bubbleIntensity({ ...base, time: 6 })).toBe(1);
    expect(
      bubbleIntensity({ ...base, time: 20, doneAt: 10, phase: "done" })
    ).toBe(0);
  });

  it("spray starts hidden and leaves from the side that goes under", () => {
    const bounds = { halfLength: 10, halfBeam: 2 };
    const out = createDroplet();
    expect(splashDroplet(0, 0, 1, bounds, out).alpha).toBe(0);
    splashDroplet(0, 0.3, -1, bounds, out);
    expect(out.z).toBeLessThan(0);
    expect(out.alpha).toBeGreaterThan(0);
  });
});

describe("isHeavyTrialPose", () => {
  it("is false for a gentle lean and true once rolled over or sunk", () => {
    expect(isHeavyTrialPose({ roll: 0.3, sink: 0 })).toBe(false);
    expect(isHeavyTrialPose({ roll: -2, sink: 0 })).toBe(true);
    expect(isHeavyTrialPose({ roll: 0, sink: 2 })).toBe(true);
  });
});

describe("playback reset by the store", () => {
  it("clears the last run when a new trial starts or the trial ends", () => {
    const { useShipBuilderStore } = jest.requireActual(
      "@/lib/ship-builder/state/store"
    );
    const { trialPlayback } = jest.requireActual("../trialPlayback");
    const store = useShipBuilderStore.getState();
    store.startTrial("stormy");
    writePlayback(runTrial(TOP_HEAVY), trialPlayback);
    expect(trialPlayback.sink).toBeGreaterThan(0);
    useShipBuilderStore.getState().startTrial("stormy");
    expect(trialPlayback.sink).toBe(0);
    expect(trialPlayback.capsizedAt).toBeNull();
    writePlayback(runTrial(TOP_HEAVY), trialPlayback);
    useShipBuilderStore.getState().endTrial();
    expect(trialPlayback.roll).toBe(0);
    expect(trialPlayback.doneAt).toBeNull();
  });

  it("keeps the sunk pose when following her down", () => {
    const { useShipBuilderStore } = jest.requireActual(
      "@/lib/ship-builder/state/store"
    );
    const { trialPlayback } = jest.requireActual("../trialPlayback");
    useShipBuilderStore.getState().startTrial("calm", 5);
    const sunk = { ...runTrial(TOP_HEAVY), outcome: "sank" as const };
    useShipBuilderStore.getState().finishTrial(sunk);
    writePlayback(sunk, trialPlayback);
    useShipBuilderStore.getState().descend();
    expect(useShipBuilderStore.getState().trial.status).toBe("running");
    expect(trialPlayback.sink).toBe(sunk.pose.sink);
    useShipBuilderStore.getState().endTrial();
  });
});

describe("writeInstantPlayback", () => {
  it("leaves a capsized ship rolled over on the surface, not sunk", () => {
    const target: TrialPlayback = {} as TrialPlayback;
    resetPlayback(target);
    const result = runTrial(TOP_HEAVY);
    expect(result.pose.sink).toBeGreaterThan(0);
    writeInstantPlayback(result, target);
    expect(Math.abs(target.roll)).toBeGreaterThan(2);
    expect(target.sink).toBe(0);
  });

  it("does not touch a ship that survived", () => {
    const target: TrialPlayback = {} as TrialPlayback;
    resetPlayback(target);
    writeInstantPlayback(runTrial(STEADY), target);
    expect(target.sink).toBe(0);
    expect(Math.abs(target.roll)).toBeLessThan(0.5);
  });
});

describe("advanceEffectsClock", () => {
  it("keeps bubbles moving and fades them out after the trial ends", () => {
    const target: TrialPlayback = {} as TrialPlayback;
    resetPlayback(target);
    let clock = freshClock(TOP_HEAVY);
    while (clock.state.phase !== "done") {
      clock = advanceTrial(TOP_HEAVY, clock, 0.05);
      writePlayback(clock.state, target);
    }
    const atDone = target.time;
    expect(bubbleIntensity(target)).toBe(1);
    // Real 60 fps frames after the sim has stopped.
    for (let frame = 0; frame < 60; frame++)
      advanceEffectsClock(1 / 60, 1, target);
    expect(target.time).toBeCloseTo(atDone + 1, 5);
    const midFade = bubbleIntensity(target);
    expect(midFade).toBeGreaterThan(0);
    expect(midFade).toBeLessThan(1);
    for (let frame = 0; frame < 300; frame++)
      advanceEffectsClock(1 / 60, 1, target);
    expect(bubbleIntensity(target)).toBe(0);
  });
});

/** A still timeline of `seconds`, its last state logging these events. */
function stillTimeline(seconds: number, events: SimEvent[] = []): Timeline {
  const first = createTrial(STEADY);
  const count = Math.round(seconds / SIM_STEP_S) + 1;
  return {
    states: Array.from({ length: count }, (_, i) => ({
      ...first,
      time: i * SIM_STEP_S,
      events: i === count - 1 ? events : [],
    })),
    descended: false,
  };
}

describe("timeline clock", () => {
  it("plays at frame speed times the test speed and stops at the end", () => {
    const clock = startTimelineClock(stillTimeline(2), 0);
    advanceTimelineClock(clock, 0.05);
    expect(clock.time).toBeCloseTo(0.05, 9);
    advanceTimelineClock(clock, 0.05, 10);
    expect(clock.time).toBeCloseTo(0.55, 9);
    for (let i = 0; i < 100; i++) advanceTimelineClock(clock, 0.1, 10);
    expect(clock.time).toBe(2);
    expect(isTimelineClockDone(clock)).toBe(true);
  });

  it("slows down around the break", () => {
    const clock = startTimelineClock(
      stillTimeline(10, [{ at: 5, kind: "broke" }]),
      5.2
    );
    advanceTimelineClock(clock, 0.1);
    expect(clock.speed).toBe(SLOW_MO_SPEED);
    expect(clock.time).toBeCloseTo(5.2 + 0.1 * SLOW_MO_SPEED, 9);
  });

  it("starts at a test jump and never moves past a test hold", () => {
    const timeline = stillTimeline(10);
    expect(startTimelineClock(timeline, 0, 3).time).toBe(3);
    expect(startTimelineClock(timeline, 0, 500).time).toBe(10);
    // "Follow her down" starts at the end even with an earlier jump time.
    expect(startTimelineClock(timeline, 8, 3).time).toBe(8);

    const held = startTimelineClock(timeline, 0, 3);
    advanceTimelineClock(held, 0.1, 1, 3);
    expect(held.time).toBe(3);
  });
});

describe("writeTimelinePlayback", () => {
  const TOP_HEAVY_TIMELINE = buildTimeline(TOP_HEAVY);

  it("shows the state at a time with the milestones reached by then", () => {
    const target: TrialPlayback = {} as TrialPlayback;
    resetPlayback(target);
    writeTimelinePlayback(
      TOP_HEAVY_TIMELINE,
      timelineEnd(TOP_HEAVY_TIMELINE),
      target
    );
    expect(target.phase).toBe("done");
    expect(target.capsizedAt).not.toBeNull();
    expect(target.doneAt).toBe(target.time);

    // Scrubbing back to the start forgets the later milestones.
    writeTimelinePlayback(TOP_HEAVY_TIMELINE, 0, target);
    expect(target.time).toBe(0);
    expect(target.capsizedAt).toBeNull();
    expect(target.sinkingAt).toBeNull();
    expect(target.doneAt).toBeNull();
  });
});
