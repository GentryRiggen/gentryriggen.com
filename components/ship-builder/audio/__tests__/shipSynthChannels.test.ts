import { createFakeAudio } from "../../../game-audio/testing/fakeAudio";
import type { MusicSpec } from "../../../game-audio/music";
import { SHANTY } from "../shanty";
import { createTrialSynth } from "../synth";

const audio = createFakeAudio();

beforeEach(() => {
  jest.useFakeTimers();
  audio.reset();
  audio.install();
});

afterEach(() => {
  audio.uninstall();
  jest.useRealTimers();
});

const sourceCount = () => audio.sources.length;

describe("ship synth channels", () => {
  it("plays nothing before audio is unlocked, music included", () => {
    const synth = createTrialSynth();
    synth.setMusic(SHANTY);
    synth.play({ kind: "place" });
    expect(sourceCount()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("starts the music bed on the unlock, not before", () => {
    const synth = createTrialSynth();
    synth.setMusic(SHANTY);
    synth.enable();
    expect(jest.getTimerCount()).toBe(1);
  });

  it("keeps music off when its switch is off, and starts it when flipped on", () => {
    const synth = createTrialSynth();
    synth.setMusicEnabled(false);
    synth.setMusic(SHANTY);
    synth.enable();
    expect(jest.getTimerCount()).toBe(0);
    synth.setMusicEnabled(true);
    expect(jest.getTimerCount()).toBe(1);
  });

  it("stops the music and its timer when it is switched off", () => {
    const synth = createTrialSynth();
    synth.setMusic(SHANTY);
    synth.enable();
    synth.setMusicEnabled(false);
    jest.advanceTimersByTime(5000);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("silences sound effects without touching the music", () => {
    const synth = createTrialSynth();
    synth.setMusic(SHANTY);
    synth.enable();
    synth.setEffectsEnabled(false);
    const before = sourceCount();
    synth.play({ kind: "place" });
    expect(sourceCount()).toBe(before);
    expect(jest.getTimerCount()).toBe(1);
    synth.setEffectsEnabled(true);
    synth.play({ kind: "place" });
    expect(sourceCount()).toBeGreaterThan(before);
  });

  it("makes a one-shot for every new cue, and each cleans up after itself", () => {
    const synth = createTrialSynth();
    synth.enable();
    const kinds = [
      { kind: "place" },
      { kind: "remove" },
      { kind: "paint" },
      { kind: "undo" },
      { kind: "redo" },
      { kind: "horn" },
      { kind: "bell" },
      { kind: "groan" },
      { kind: "funnel-crash" },
      { kind: "sting", outcome: "survived" },
      { kind: "sting", outcome: "sank" },
    ] as const;
    for (const cue of kinds) {
      const before = sourceCount();
      synth.play(cue);
      expect(sourceCount()).toBeGreaterThan(before);
    }
    // Every started source tears its graph down when it ends.
    for (const source of audio.sources) {
      if (source.onended) {
        source.onended();
        expect(source.disconnect).toHaveBeenCalled();
      }
    }
  });

  it("cuts the world beds and the music on pause, then wakes both", () => {
    const synth = createTrialSynth();
    synth.setMusic(SHANTY);
    synth.enable();
    synth.setBeds({ wash: 0.5, wind: 0.5, thrum: 0, bow: 0, rush: 0 });
    synth.pause();
    expect(jest.getTimerCount()).toBe(0);
    const [context] = audio.contexts;
    expect(context.suspend).toHaveBeenCalled();
    synth.resume();
    expect(context.resume).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);
  });

  it("makes no one-shots while paused", () => {
    const synth = createTrialSynth();
    synth.enable();
    synth.pause();
    const before = sourceCount();
    synth.play({ kind: "horn" });
    expect(sourceCount()).toBe(before);
  });

  it("switches piece when given another bed", () => {
    const synth = createTrialSynth();
    const other: MusicSpec = { ...SHANTY, id: "other" };
    synth.enable();
    synth.setMusic(SHANTY);
    const first = sourceCount();
    synth.setMusic(other);
    expect(sourceCount()).toBeGreaterThan(first);
    expect(jest.getTimerCount()).toBe(1);
  });

  it("stops music when the scene hands it nothing", () => {
    const synth = createTrialSynth();
    synth.enable();
    synth.setMusic(SHANTY);
    synth.setMusic(null);
    jest.advanceTimersByTime(5000);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("ship synth lifetime", () => {
  it("frees the graph and suspends when the last holder leaves", () => {
    const synth = createTrialSynth();
    const release = synth.acquire();
    synth.setMusic(SHANTY);
    synth.enable();
    const [context] = audio.contexts;
    const sources = [...audio.sources];
    expect(sources.length).toBeGreaterThan(0);
    release();
    expect(context.suspend).toHaveBeenCalled();
    // Every held source (beds, oscillators) was stopped.
    const held = sources.filter((s) => s.start.mock.calls.length > 0);
    expect(held.every((s) => s.stop.mock.calls.length > 0)).toBe(true);
    jest.advanceTimersByTime(5000);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("waits for every holder before freeing", () => {
    const synth = createTrialSynth();
    const a = synth.acquire();
    const b = synth.acquire();
    synth.enable();
    const [context] = audio.contexts;
    a();
    expect(context.suspend).not.toHaveBeenCalled();
    b();
    expect(context.suspend).toHaveBeenCalledTimes(1);
  });

  it("releasing twice does nothing extra", () => {
    const synth = createTrialSynth();
    const release = synth.acquire();
    synth.enable();
    const [context] = audio.contexts;
    release();
    release();
    expect(context.suspend).toHaveBeenCalledTimes(1);
  });

  it("rebuilds cleanly on remount: music and beds come back", () => {
    const synth = createTrialSynth();
    const release = synth.acquire();
    synth.setMusic(SHANTY);
    synth.enable();
    release();
    synth.setMusic(null);
    const before = audio.sources.length;
    const again = synth.acquire();
    synth.setMusic(SHANTY);
    expect(audio.contexts).toHaveLength(1);
    expect(audio.sources.length).toBeGreaterThan(before);
    expect(audio.contexts[0].resume).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(1);
    synth.play({ kind: "place" });
    again();
  });

  it("plays the challenge sting for each star count", () => {
    const synth = createTrialSynth();
    synth.acquire();
    synth.enable();
    for (const stars of [0, 1, 2, 3]) {
      const before = audio.sources.length;
      synth.play({ kind: "challenge", stars });
      expect(audio.sources.length).toBeGreaterThan(before);
    }
  });

  it("reports whether a cue would be heard", () => {
    const synth = createTrialSynth();
    expect(synth.canPlay()).toBe(false);
    synth.acquire();
    synth.enable();
    expect(synth.canPlay()).toBe(true);
    synth.setEffectsEnabled(false);
    expect(synth.canPlay()).toBe(false);
    synth.setEffectsEnabled(true);
    synth.pause();
    expect(synth.canPlay()).toBe(false);
  });

  it("routes the music through the master bus", () => {
    const synth = createTrialSynth();
    synth.acquire();
    synth.setMusic(SHANTY);
    synth.enable();
    // The first gain made is the engine bus; the music's duck gain feeds a
    // chain that ends at it.
    const bus = audio.nodes[0];
    const connectedToBus = audio.nodes.some((n) =>
      n.connect.mock.calls.some(([target]) => target === bus)
    );
    expect(connectedToBus).toBe(true);
  });
});
