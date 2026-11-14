type Speech = typeof import("../speech");

// The voice pick is cached per module load: each test gets a fresh one.
let speak: Speech["speak"];
let stopSpeaking: Speech["stopSpeaking"];

class FakeUtterance {
  text: string;
  volume = 1;
  rate = 1;
  lang = "";
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

type Listener = () => void;

function setup(initial: unknown[]) {
  const state = { voices: initial };
  const listeners = new Set<Listener>();
  const spoken: FakeUtterance[] = [];
  const synth = {
    speaking: false,
    pending: false,
    speak: jest.fn((u: FakeUtterance) => {
      spoken.push(u);
    }),
    cancel: jest.fn(() => {
      spoken.length = 0;
    }),
    resume: jest.fn(),
    getVoices: jest.fn((): unknown[] => state.voices),
    addEventListener: jest.fn((_: string, l: Listener) => listeners.add(l)),
    removeEventListener: jest.fn((_: string, l: Listener) =>
      listeners.delete(l)
    ),
  };
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: synth,
  });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: FakeUtterance,
  });
  return {
    state,
    synth,
    spoken,
    fire: () => [...listeners].forEach((l) => l()),
  };
}

const VOICE = { name: "Zoe (Premium)", lang: "en-US", default: false };
const LONG = "Sentence one is here. ".repeat(40);

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetModules();
  ({ speak, stopSpeaking } = jest.requireActual<Speech>("../speech"));
});
afterEach(() => {
  stopSpeaking();
  jest.useRealTimers();
});

it("waits for voices that load late, then uses the best one", () => {
  const env = setup([]);
  const onEnd = jest.fn();
  speak("Hello there.", onEnd);
  expect(env.synth.speak).not.toHaveBeenCalled();
  env.state.voices = [VOICE];
  env.fire();
  expect(env.spoken[0].voice).toBe(VOICE);
  expect(env.synth.resume).toHaveBeenCalled();
});

it("goes on with the default voice after a second without voices", () => {
  const env = setup([]);
  speak("Hello again.", jest.fn());
  jest.advanceTimersByTime(1000);
  expect(env.spoken).toHaveLength(1);
  expect(env.spoken[0].voice).toBeNull();
  expect(env.spoken[0].lang).toBe("en-US");
});

it("starts after a short delay when it replaces speech in progress", () => {
  const env = setup([VOICE]);
  speak("First one.", jest.fn());
  env.synth.speaking = true;
  speak("Second one.", jest.fn());
  expect(env.synth.cancel).toHaveBeenCalledTimes(2);
  expect(env.spoken).toHaveLength(0);
  jest.advanceTimersByTime(100);
  expect(env.spoken.map((u) => u.text)).toEqual(["Second one."]);
});

it("drops a delayed start that was stopped meanwhile", () => {
  const env = setup([VOICE]);
  env.synth.speaking = true;
  speak("Never heard.", jest.fn());
  stopSpeaking();
  jest.advanceTimersByTime(500);
  expect(env.spoken).toHaveLength(0);
});

it("ends the run when the engine never starts", () => {
  const env = setup([VOICE]);
  const onEnd = jest.fn();
  speak("Stuck.", onEnd);
  jest.advanceTimersByTime(1999);
  expect(onEnd).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(env.synth.cancel).toHaveBeenCalled();
});

it("keeps going when it started, or the engine is busy", () => {
  const env = setup([VOICE]);
  const onEnd = jest.fn();
  speak("Fine.", onEnd);
  env.spoken[0].onstart?.();
  jest.advanceTimersByTime(5000);
  expect(onEnd).not.toHaveBeenCalled();
});

it("ends the whole run once when a chunk fails", () => {
  const env = setup([VOICE]);
  const onEnd = jest.fn();
  speak(LONG, onEnd);
  const [first, second] = env.spoken;
  first.onstart?.();
  const chunks = env.spoken.length;
  expect(chunks).toBeGreaterThan(1);
  first.onerror?.();
  second.onerror?.();
  env.spoken[env.spoken.length - 1]?.onend?.();
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(env.synth.cancel).toHaveBeenCalled();
});

it("a stale failure doesn't cancel the newer speech", () => {
  const env = setup([VOICE]);
  const oldEnd = jest.fn();
  speak("Old speech.", oldEnd);
  const old = env.spoken[0];
  speak("New speech.", jest.fn());
  env.synth.cancel.mockClear();
  old.onerror?.();
  expect(env.synth.cancel).not.toHaveBeenCalled();
});
