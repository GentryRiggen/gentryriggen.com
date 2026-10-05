import { createTrialSynth } from "../synth";

interface FakeParam {
  value: number;
  setTargetAtTime: jest.Mock;
  setValueAtTime: jest.Mock;
  cancelScheduledValues: jest.Mock;
}

const params: FakeParam[] = [];
const contexts: { suspend: jest.Mock; resume: jest.Mock }[] = [];

function param(value = 0): FakeParam {
  const p: FakeParam = {
    value,
    setTargetAtTime: jest.fn(),
    setValueAtTime: jest.fn(),
    cancelScheduledValues: jest.fn(),
  };
  params.push(p);
  return p;
}

function node() {
  return {
    gain: param(1),
    frequency: param(),
    detune: param(),
    Q: param(),
    connect: jest.fn((next: unknown) => next),
    start: jest.fn(),
  };
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
  createOscillator = node;
  createBufferSource = node;
  createDynamicsCompressor = node;
  createBuffer = () => ({ getChannelData: () => new Float32Array(300) });
}

beforeEach(() => {
  params.length = 0;
  contexts.length = 0;
  (window as unknown as { AudioContext: unknown }).AudioContext =
    FakeAudioContext;
});

afterEach(() => {
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
});

function targetCalls(): number {
  return params.reduce(
    (sum, p) => sum + p.setTargetAtTime.mock.calls.length,
    0
  );
}

describe("trial synth", () => {
  it("only talks to the audio thread when a value changes", () => {
    const synth = createTrialSynth();
    expect(synth.enable()).toBe(true);
    synth.setAmbient({ sea: true, hum: true });
    synth.setMuffle(0.5);
    synth.setSpeed(1);
    const settled = targetCalls();

    for (let frame = 0; frame < 30; frame += 1) {
      synth.setAmbient({ sea: true, hum: true });
      synth.setMuffle(0.5 + frame * 0.0001);
      synth.setSpeed(1);
    }
    expect(targetCalls()).toBe(settled);

    synth.setMuffle(0.9);
    expect(targetCalls()).toBeGreaterThan(settled);
    const afterMuffle = targetCalls();
    synth.setAmbient({ sea: false, hum: true });
    expect(targetCalls()).toBe(afterMuffle + 1);
  });

  it("pause cuts the beds at once and suspends; resume wakes the context", () => {
    const synth = createTrialSynth();
    synth.enable();
    synth.setAmbient({ sea: true, hum: true });
    const [context] = contexts;

    synth.pause();
    expect(context.suspend).toHaveBeenCalledTimes(1);
    expect(synth.isEnabled()).toBe(true);
    expect(
      params.filter((p) => p.cancelScheduledValues.mock.calls.length > 0)
    ).toHaveLength(2);

    context.resume.mockClear();
    synth.resume();
    expect(context.resume).toHaveBeenCalledTimes(1);

    // The beds come back on the next frame's ambient.
    const before = targetCalls();
    synth.setAmbient({ sea: true, hum: true });
    expect(targetCalls()).toBe(before + 2);
  });

  it("does not resume a synth that was turned off", () => {
    const synth = createTrialSynth();
    synth.enable();
    synth.disable();
    const [context] = contexts;
    context.resume.mockClear();
    synth.resume();
    expect(context.resume).not.toHaveBeenCalled();
  });
});
