import {
  createPlaneSynth,
  isAudioSupported,
  type PlaneCue,
} from "../planeSynth";
import { cueForEvent, engineLevel } from "../flightCues";

interface FakeParam {
  value: number;
  setTargetAtTime: jest.Mock;
  setValueAtTime: jest.Mock;
  linearRampToValueAtTime: jest.Mock;
  exponentialRampToValueAtTime: jest.Mock;
  cancelScheduledValues: jest.Mock;
}

const params: FakeParam[] = [];
const contexts: { suspend: jest.Mock; resume: jest.Mock }[] = [];
let oscillators = 0;

function param(value = 0): FakeParam {
  const p: FakeParam = {
    value,
    setTargetAtTime: jest.fn(),
    setValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
    cancelScheduledValues: jest.fn(),
  };
  params.push(p);
  return p;
}

function node() {
  const self = {
    gain: param(1),
    frequency: param(),
    detune: param(),
    Q: param(),
    connect: jest.fn((next: unknown) => next),
    disconnect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  };
  return self;
}

class FakeAudioContext {
  currentTime = 0;
  sampleRate = 100;
  destination = {};
  suspend = jest.fn(() => Promise.resolve());
  resume = jest.fn(() => Promise.resolve());
  constructor() {
    contexts.push(this);
  }
  createGain = node;
  createBiquadFilter = node;
  createOscillator = () => {
    oscillators += 1;
    return node();
  };
  createBufferSource = node;
  createDynamicsCompressor = node;
  createBuffer = () => ({ getChannelData: () => new Float32Array(300) });
}

function installFake() {
  (window as unknown as { AudioContext: unknown }).AudioContext =
    FakeAudioContext;
}

function removeFake() {
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
}

beforeEach(() => {
  params.length = 0;
  contexts.length = 0;
  oscillators = 0;
});

afterEach(removeFake);

const ALL_CUES: PlaneCue[] = [
  "launch",
  "coin",
  "ring",
  "bump",
  "shield",
  "crash",
  "land",
  "cheer",
  "buy",
];

describe("planeSynth without audio support", () => {
  it("reports no support and every method is a safe no-op", () => {
    removeFake();
    const synth = createPlaneSynth();
    expect(isAudioSupported()).toBe(false);
    expect(synth.enable()).toBe(false);
    expect(synth.isEnabled()).toBe(false);
    expect(() => {
      for (const cue of ALL_CUES) synth.play(cue);
      synth.setEngine(1);
      synth.pause();
      synth.resume();
      synth.disable();
    }).not.toThrow();
  });
});

describe("planeSynth with audio", () => {
  beforeEach(installFake);

  it("touches nothing before enable()", () => {
    const synth = createPlaneSynth();
    synth.play("coin");
    synth.setEngine(1);
    expect(contexts).toHaveLength(0);
    expect(oscillators).toBe(0);
  });

  it("enable() starts the context and play creates oscillators", () => {
    const synth = createPlaneSynth();
    expect(synth.enable()).toBe(true);
    expect(synth.isEnabled()).toBe(true);
    const idle = oscillators;
    synth.play("coin");
    expect(oscillators).toBe(idle + 2);
  });

  it("builds every cue without error", () => {
    const synth = createPlaneSynth();
    synth.enable();
    for (const cue of ALL_CUES) expect(() => synth.play(cue)).not.toThrow();
  });

  it("disable() suspends and silences later cues", () => {
    const synth = createPlaneSynth();
    synth.enable();
    synth.disable();
    expect(contexts[0].suspend).toHaveBeenCalledTimes(1);
    const before = oscillators;
    synth.play("coin");
    expect(oscillators).toBe(before);
  });

  it("only sends engine changes that matter", () => {
    const synth = createPlaneSynth();
    synth.enable();
    const targets = () =>
      params.reduce((sum, p) => sum + p.setTargetAtTime.mock.calls.length, 0);
    synth.setEngine(0.5);
    const settled = targets();
    expect(settled).toBeGreaterThan(0);
    for (let frame = 0; frame < 30; frame += 1) synth.setEngine(0.5);
    expect(targets()).toBe(settled);
    synth.setEngine(1);
    expect(targets()).toBeGreaterThan(settled);
  });

  it("pause() suspends but stays enabled, and resume() wakes it", () => {
    const synth = createPlaneSynth();
    synth.enable();
    const [context] = contexts;
    synth.pause();
    expect(context.suspend).toHaveBeenCalledTimes(1);
    expect(synth.isEnabled()).toBe(true);
    context.resume.mockClear();
    synth.resume();
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it("does not resume a synth that was turned off", () => {
    const synth = createPlaneSynth();
    synth.enable();
    synth.disable();
    contexts[0].resume.mockClear();
    synth.resume();
    expect(contexts[0].resume).not.toHaveBeenCalled();
  });
});

describe("flight cues", () => {
  it("maps sim events to sounds", () => {
    expect(cueForEvent({ type: "coin", index: 0 })).toBe("coin");
    expect(cueForEvent({ type: "landed" })).toBe("land");
    expect(cueForEvent({ type: "crash" })).toBe("crash");
    expect(cueForEvent({ type: "stalled" })).toBeNull();
  });

  it("sets the engine level from boost and fuel", () => {
    expect(engineLevel(true, 5, true, true)).toBe(1);
    expect(engineLevel(true, 5, true, false)).toBe(0.5);
    expect(engineLevel(true, 0, true, true)).toBe(0);
    expect(engineLevel(false, 5, true, true)).toBe(0);
    expect(engineLevel(true, 5, false, true)).toBe(0);
  });
});
