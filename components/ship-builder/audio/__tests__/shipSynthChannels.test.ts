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
