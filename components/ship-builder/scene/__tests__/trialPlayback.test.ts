import { createTrial, runTrial } from "@/lib/ship-builder/sim/seaTrial";
import { SIM_STEP_S, type TrialInput } from "@/lib/ship-builder/sim/types";
import {
  advanceTrial,
  jumpTrial,
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
      phase: "capsizing",
      time: 5,
      capsizedAt: 5,
      sinkingAt: null,
      doneAt: null,
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
