import { createMusicPlayer, mergeDuck, NO_DUCK } from "../musicPlayer";
import type { MusicSpec } from "../music";
import { createFakeAudio, FakeContext } from "../testing/fakeAudio";

const SPEC: MusicSpec = {
  id: "d1",
  tempo: 120,
  beatsPerBar: 4,
  rootMidi: 60,
  scale: [0, 2, 4, 5, 7, 9, 11],
  progression: [0, 3],
  leadDensity: 0.5,
  leadRange: [0, 7],
  padWave: "sine",
  leadWave: "triangle",
  isStrummed: false,
  level: 1,
  seed: 3,
};

describe("mergeDuck", () => {
  it("starts a fresh duck when none is in force", () => {
    expect(mergeDuck(NO_DUCK, 10, 0.5, 2)).toEqual({ depth: 0.5, until: 12 });
  });

  it("break then creak: the shallow, short creak cannot cancel the break", () => {
    const afterBreak = mergeDuck(NO_DUCK, 10, 0.85, 4);
    const afterCreak = mergeDuck(afterBreak, 10.5, 0.25, 0.8);
    expect(afterCreak.depth).toBe(0.85);
    expect(afterCreak.until).toBe(14);
  });

  it("crash then coin: the coin's tiny duck leaves the crash's alone", () => {
    const afterCrash = mergeDuck(NO_DUCK, 5, 0.75, 1.4);
    const afterCoin = mergeDuck(afterCrash, 5.1, 0.12, 0.2);
    expect(afterCoin).toEqual(afterCrash);
  });

  it("a deeper, longer duck deepens and extends the one in force", () => {
    const first = mergeDuck(NO_DUCK, 0, 0.25, 0.8);
    const second = mergeDuck(first, 0.2, 0.85, 4);
    expect(second).toEqual({ depth: 0.85, until: 4.2 });
  });

  it("forgets an old duck once it has released", () => {
    const old = mergeDuck(NO_DUCK, 0, 0.85, 1);
    expect(mergeDuck(old, 2, 0.1, 0.2)).toEqual({ depth: 0.1, until: 2.2 });
  });

  it("clamps the depth", () => {
    expect(mergeDuck(NO_DUCK, 0, 3, 1).depth).toBe(1);
    expect(mergeDuck(NO_DUCK, 0, -1, 1).depth).toBe(0);
  });
});

describe("the player's duck", () => {
  const audio = createFakeAudio();
  beforeEach(() => {
    jest.useFakeTimers();
    audio.reset();
  });
  afterEach(() => jest.useRealTimers());

  function setup() {
    const ctx = new FakeContext(audio);
    const player = createMusicPlayer(
      ctx as unknown as AudioContext,
      {} as AudioNode
    );
    player.start(SPEC);
    const duckParam = audio.nodes[0].gain;
    return { ctx, player, duckParam };
  }

  it("keeps the deeper dip when a shallow duck follows straight after", () => {
    const { ctx, player, duckParam } = setup();
    player.duck(0.85, 4);
    ctx.currentTime += 0.02;
    player.duck(0.25, 0.8);
    const last = duckParam.setTargetAtTime.mock.calls.slice(-2);
    // Target floor stays at 1 - 0.85, released at the break's own time.
    expect(last[0][0]).toBeCloseTo(0.15);
    expect(last[1][0]).toBe(1);
    expect(last[1][1]).toBeCloseTo(4);
  });
});

describe("pause, stop and resume", () => {
  const audio = createFakeAudio();
  beforeEach(() => {
    jest.useFakeTimers();
    audio.reset();
  });
  afterEach(() => jest.useRealTimers());

  function setup() {
    const ctx = new FakeContext(audio);
    const player = createMusicPlayer(
      ctx as unknown as AudioContext,
      {} as AudioNode
    );
    return { ctx, player };
  }

  it("pause stops and disconnects every note already scheduled", () => {
    const { player } = setup();
    player.start(SPEC);
    const notes = [...audio.sources];
    expect(notes.length).toBeGreaterThan(0);
    player.pause();
    for (const note of notes) {
      expect(note.stop).toHaveBeenCalledTimes(2);
      expect(note.disconnect).toHaveBeenCalled();
    }
  });

  it("resume schedules fresh bars only: nothing is doubled", () => {
    const { ctx, player } = setup();
    player.start(SPEC);
    const before = audio.sources.length;
    player.pause();
    ctx.currentTime += 5;
    player.resume();
    const fresh = audio.sources.slice(before);
    expect(fresh.length).toBeGreaterThan(0);
    // Every note from before the pause is dead; only the new bars are live.
    const dead = audio.sources.slice(0, before);
    expect(dead.every((n) => n.disconnect.mock.calls.length > 0)).toBe(true);
    expect(fresh.every((n) => n.disconnect.mock.calls.length === 0)).toBe(true);
  });

  it("clears the duck and fade state on pause", () => {
    const { player } = setup();
    player.start(SPEC);
    const duckParam = audio.nodes[0].gain;
    player.duck(0.8, 3);
    duckParam.setValueAtTime.mockClear();
    player.pause();
    expect(duckParam.cancelScheduledValues).toHaveBeenCalled();
    expect(duckParam.setValueAtTime).toHaveBeenCalledWith(
      1,
      expect.any(Number)
    );
    const levelParam = audio.nodes[2].gain;
    expect(levelParam.setValueAtTime).toHaveBeenCalledWith(
      0,
      expect.any(Number)
    );
  });

  it("a new duck after a resume is not held back by an old one", () => {
    const { ctx, player } = setup();
    player.start(SPEC);
    player.duck(0.9, 10);
    player.pause();
    player.resume();
    ctx.currentTime += 0.01;
    player.duck(0.2, 0.3);
    const duckParam = audio.nodes[0].gain;
    const last = duckParam.setTargetAtTime.mock.calls.slice(-2);
    expect(last[0][0]).toBeCloseTo(0.8);
  });

  it("stop flushes the fading notes once the fade is over", () => {
    const { player } = setup();
    player.start(SPEC);
    const notes = [...audio.sources];
    player.stop();
    expect(notes.some((n) => n.disconnect.mock.calls.length > 0)).toBe(false);
    jest.advanceTimersByTime(2000);
    for (const note of notes) {
      expect(note.disconnect).toHaveBeenCalled();
    }
  });

  it("restarting mid-fade drops the old notes instead of stacking", () => {
    const { ctx, player } = setup();
    player.start(SPEC);
    const old = [...audio.sources];
    player.stop();
    ctx.currentTime += 0.3;
    player.start(SPEC);
    for (const note of old) expect(note.disconnect).toHaveBeenCalled();
    jest.advanceTimersByTime(2000);
    expect(player.isPlaying()).toBe(true);
    expect(jest.getTimerCount()).toBe(1);
  });
});
