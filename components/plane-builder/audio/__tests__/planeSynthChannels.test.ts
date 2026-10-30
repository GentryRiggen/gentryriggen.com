import { createFakeAudio } from "../../../game-audio/testing/fakeAudio";
import { musicForWorld } from "../worldMusic";
import { SILENT_FLIGHT } from "../planeBeds";
import { createPlaneSynth, type PlaneCue } from "../planeSynth";

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

const ALL_CUES: PlaneCue[] = [
  "launch",
  "coin",
  "ring",
  "bump",
  "shield",
  "crash",
  "land",
  "fuel",
  "flag",
  "cheer",
  "buy",
  "boost",
  "nearMiss",
  "ghostPass",
  "daily",
];

describe("plane synth sound pass", () => {
  it("has a one-shot for every cue, including nearMiss for the near-miss track", () => {
    const synth = createPlaneSynth();
    synth.enable();
    for (const cue of ALL_CUES) {
      const before = sourceCount();
      synth.play(cue);
      expect(sourceCount()).toBeGreaterThan(before);
    }
  });

  it("starts the music only after the unlock, and only while music is on", () => {
    const synth = createPlaneSynth();
    synth.setMusic(musicForWorld("meadow"));
    expect(jest.getTimerCount()).toBe(0);
    synth.enable();
    expect(jest.getTimerCount()).toBe(1);
    synth.setMusicEnabled(false);
    jest.advanceTimersByTime(5000);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("changes mood with the world", () => {
    const synth = createPlaneSynth();
    synth.enable();
    synth.setMusic(musicForWorld("meadow"));
    const first = sourceCount();
    synth.setMusic(musicForWorld("storm"));
    expect(sourceCount()).toBeGreaterThan(first);
    expect(jest.getTimerCount()).toBe(1);
  });

  it("mutes effects but keeps the music going", () => {
    const synth = createPlaneSynth();
    synth.setMusic(musicForWorld("canyon"));
    synth.enable();
    synth.setEffectsEnabled(false);
    const before = sourceCount();
    synth.play("coin");
    expect(sourceCount()).toBe(before);
    expect(jest.getTimerCount()).toBe(1);
  });

  it("whooshes once on the boost press, not for as long as it is held", () => {
    const synth = createPlaneSynth();
    synth.enable();
    const boosting = {
      ...SILENT_FLIGHT,
      engine: 1,
      speed: 0.5,
      boosting: true,
    };
    const before = sourceCount();
    synth.setFlight(boosting);
    const afterPress = sourceCount();
    expect(afterPress).toBeGreaterThan(before);
    synth.setFlight({ ...boosting, speed: 0.6 });
    expect(sourceCount()).toBe(afterPress);
    synth.setFlight({ ...boosting, boosting: false, engine: 0.5 });
    synth.setFlight(boosting);
    expect(sourceCount()).toBeGreaterThan(afterPress);
  });

  it("beeps for a stall warning on the audio clock, faster when nearer", () => {
    const synth = createPlaneSynth();
    synth.enable();
    const [context] = audio.contexts;
    const warn = (stall: number) =>
      synth.setFlight({ ...SILENT_FLIGHT, stall });

    const before = sourceCount();
    warn(0.1);
    const firstBeep = sourceCount();
    expect(firstBeep).toBeGreaterThan(before);
    // Same instant: it waits its turn.
    warn(0.1);
    expect(sourceCount()).toBe(firstBeep);
    context.currentTime += 0.5;
    warn(0.1);
    expect(sourceCount()).toBe(firstBeep);
    context.currentTime += 0.3;
    warn(0.1);
    expect(sourceCount()).toBeGreaterThan(firstBeep);

    // Nearly stalled: the gap is much shorter.
    const urgentStart = sourceCount();
    context.currentTime += 1;
    warn(1);
    const afterUrgent = sourceCount();
    expect(afterUrgent).toBeGreaterThan(urgentStart);
    context.currentTime += 0.35;
    warn(1);
    expect(sourceCount()).toBeGreaterThan(afterUrgent);
  });

  it("stays quiet when there is no stall, and when effects are off", () => {
    const synth = createPlaneSynth();
    synth.enable();
    const before = sourceCount();
    synth.setFlight({ ...SILENT_FLIGHT, speed: 0.4 });
    expect(sourceCount()).toBe(before);
    synth.setEffectsEnabled(false);
    synth.setFlight({ ...SILENT_FLIGHT, stall: 1, boosting: true, engine: 1 });
    expect(sourceCount()).toBe(before);
  });

  it("cuts everything and its timer on pause, and wakes on resume", () => {
    const synth = createPlaneSynth();
    synth.setMusic(musicForWorld("beach"));
    synth.enable();
    synth.pause();
    expect(jest.getTimerCount()).toBe(0);
    const [context] = audio.contexts;
    expect(context.suspend).toHaveBeenCalled();
    const before = sourceCount();
    synth.play("crash");
    expect(sourceCount()).toBe(before);
    synth.resume();
    expect(jest.getTimerCount()).toBe(1);
  });

  it("keeps setEngine working for the old call sites", () => {
    const synth = createPlaneSynth();
    synth.enable();
    expect(() => synth.setEngine(0.5)).not.toThrow();
    expect(() => synth.setEngine(0)).not.toThrow();
  });
});

describe("plane synth lifetime", () => {
  it("frees the engine, wind and music when the last holder leaves", () => {
    const synth = createPlaneSynth();
    const release = synth.acquire();
    synth.setMusic(musicForWorld("meadow"));
    synth.enable();
    const [context] = audio.contexts;
    const started = audio.sources.filter((s) => s.start.mock.calls.length > 0);
    expect(started.length).toBeGreaterThan(0);
    release();
    expect(context.suspend).toHaveBeenCalled();
    expect(
      started
        .filter((s) => !s.onended)
        .every((s) => s.stop.mock.calls.length > 0)
    ).toBe(true);
    jest.advanceTimersByTime(5000);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("restarts cleanly on remount", () => {
    const synth = createPlaneSynth();
    const release = synth.acquire();
    synth.enable();
    release();
    synth.setMusic(null);
    const before = audio.sources.length;
    synth.acquire();
    synth.setMusic(musicForWorld("storm"));
    expect(audio.contexts).toHaveLength(1);
    expect(audio.sources.length).toBeGreaterThan(before);
    expect(jest.getTimerCount()).toBe(1);
    const sources = audio.sources.length;
    synth.setFlight({ ...SILENT_FLIGHT, engine: 1, boosting: true });
    expect(audio.sources.length).toBeGreaterThan(sources);
  });

  it("routes the music through the master bus", () => {
    const synth = createPlaneSynth();
    synth.acquire();
    synth.setMusic(musicForWorld("meadow"));
    synth.enable();
    const bus = audio.nodes[0];
    expect(
      audio.nodes.some((n) =>
        n.connect.mock.calls.some(([target]) => target === bus)
      )
    ).toBe(true);
  });

  it("has a DUCK-backed nearMiss cue", () => {
    const synth = createPlaneSynth();
    synth.acquire();
    synth.enable();
    const before = audio.sources.length;
    synth.play("nearMiss");
    expect(audio.sources.length).toBeGreaterThan(before);
  });
});
