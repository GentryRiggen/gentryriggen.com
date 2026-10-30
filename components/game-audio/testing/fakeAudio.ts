/**
 * A minimal fake Web Audio context for unit tests. It counts what a synth
 * creates and what it tears down, so tests can check for node leaks.
 */

export interface FakeParam {
  value: number;
  setTargetAtTime: jest.Mock;
  setValueAtTime: jest.Mock;
  linearRampToValueAtTime: jest.Mock;
  exponentialRampToValueAtTime: jest.Mock;
  cancelScheduledValues: jest.Mock;
}

export interface FakeNode {
  gain: FakeParam;
  frequency: FakeParam;
  detune: FakeParam;
  Q: FakeParam;
  type?: string;
  buffer?: unknown;
  loop?: boolean;
  onended: (() => void) | null;
  connect: jest.Mock;
  disconnect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
}

export interface FakeAudio {
  contexts: FakeContext[];
  /** Every oscillator and buffer source created, in order. */
  sources: FakeNode[];
  /** Every node created. */
  nodes: FakeNode[];
  install: () => void;
  uninstall: () => void;
  reset: () => void;
}

export class FakeContext {
  currentTime = 0;
  sampleRate = 100;
  destination = {};
  suspend = jest.fn(() => Promise.resolve());
  resume = jest.fn(() => Promise.resolve());
  createGain: () => FakeNode;
  createBiquadFilter: () => FakeNode;
  createOscillator: () => FakeNode;
  createBufferSource: () => FakeNode;
  createDynamicsCompressor: () => FakeNode;
  createBuffer = () => ({ getChannelData: () => new Float32Array(300) });

  constructor(audio: FakeAudio) {
    const make = (isSource: boolean) => () => {
      const node = makeNode();
      audio.nodes.push(node);
      if (isSource) audio.sources.push(node);
      return node;
    };
    this.createGain = make(false);
    this.createBiquadFilter = make(false);
    this.createDynamicsCompressor = make(false);
    this.createOscillator = make(true);
    this.createBufferSource = make(true);
    audio.contexts.push(this);
  }
}

function makeParam(value = 0): FakeParam {
  return {
    value,
    setTargetAtTime: jest.fn(),
    setValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
    cancelScheduledValues: jest.fn(),
  };
}

function makeNode(): FakeNode {
  return {
    gain: makeParam(1),
    frequency: makeParam(),
    detune: makeParam(),
    Q: makeParam(),
    onended: null,
    connect: jest.fn((next: unknown) => next),
    disconnect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  };
}

export function createFakeAudio(): FakeAudio {
  const audio: FakeAudio = {
    contexts: [],
    sources: [],
    nodes: [],
    install() {
      (window as unknown as { AudioContext: unknown }).AudioContext = class {
        constructor() {
          return new FakeContext(audio);
        }
      };
    },
    uninstall() {
      delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    },
    reset() {
      audio.contexts.length = 0;
      audio.sources.length = 0;
      audio.nodes.length = 0;
    },
  };
  return audio;
}
