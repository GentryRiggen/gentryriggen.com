import { createMusicPlayer, LOOKAHEAD_S, TICK_MS } from "../musicPlayer";
import type { MusicSpec } from "../music";
import { createFakeAudio, FakeContext } from "../testing/fakeAudio";

const SPEC: MusicSpec = {
  id: "t1",
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

const audio = createFakeAudio();

function setup() {
  const ctx = new FakeContext(audio);
  const destination = {} as AudioNode;
  const player = createMusicPlayer(ctx as unknown as AudioContext, destination);
  return { ctx, player };
}

beforeEach(() => {
  jest.useFakeTimers();
  audio.reset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("music player", () => {
  it("schedules the first bars right away and more as the clock moves", () => {
    const { ctx, player } = setup();
    player.start(SPEC);
    const first = audio.sources.length;
    expect(first).toBeGreaterThan(0);
    expect(player.isPlaying()).toBe(true);

    // Nothing more is needed until the audio clock gets near the horizon.
    jest.advanceTimersByTime(TICK_MS);
    expect(audio.sources.length).toBe(first);

    ctx.currentTime += LOOKAHEAD_S * 2;
    jest.advanceTimersByTime(TICK_MS);
    expect(audio.sources.length).toBeGreaterThan(first);
  });

  it("never schedules more than the lookahead holds", () => {
    const { ctx, player } = setup();
    player.start(SPEC);
    for (let i = 0; i < 20; i += 1) {
      ctx.currentTime += 0.4;
      jest.advanceTimersByTime(TICK_MS);
    }
    // Two-second bars and a 1.6 s lookahead: about one bar of notes in flight.
    const live = audio.sources.filter(
      (node) => node.stop.mock.calls[0]?.[0] > ctx.currentTime
    );
    expect(live.length).toBeLessThan(40);
  });

  it("disconnects each note when it ends", () => {
    const { player } = setup();
    player.start(SPEC);
    const note = audio.sources[0];
    expect(note.onended).toEqual(expect.any(Function));
    note.onended?.();
    expect(note.disconnect).toHaveBeenCalled();
  });

  it("fades out on stop and leaves no timers behind", () => {
    const { player } = setup();
    player.start(SPEC);
    player.stop();
    expect(player.isPlaying()).toBe(false);
    jest.advanceTimersByTime(5000);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("stops scheduling on pause and carries on after resume", () => {
    const { ctx, player } = setup();
    player.start(SPEC);
    player.pause();
    expect(jest.getTimerCount()).toBe(0);
    const before = audio.sources.length;
    ctx.currentTime += 10;
    jest.advanceTimersByTime(TICK_MS * 3);
    expect(audio.sources.length).toBe(before);
    player.resume();
    expect(audio.sources.length).toBeGreaterThan(before);
    expect(jest.getTimerCount()).toBe(1);
  });

  it("does not resume a bed that was stopped", () => {
    const { player } = setup();
    player.start(SPEC);
    player.stop();
    player.resume();
    jest.advanceTimersByTime(5000);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("ducks only while playing, and applies every duck", () => {
    const { ctx, player } = setup();
    const gainsBefore = audio.nodes.length;
    player.duck(0.5, 0.3);
    player.start(SPEC);
    expect(audio.nodes.length).toBeGreaterThan(gainsBefore);
    const duckNode = audio.nodes[0];
    duckNode.gain.setTargetAtTime.mockClear();
    player.duck(0.5, 0.3);
    expect(duckNode.gain.setTargetAtTime.mock.calls.length).toBe(2);
    ctx.currentTime += 0.01;
    player.duck(0.5, 0.3);
    expect(duckNode.gain.setTargetAtTime.mock.calls.length).toBe(4);
  });

  it("restarts at bar zero for a different piece, not for the same one", () => {
    const { ctx, player } = setup();
    player.start(SPEC);
    const first = audio.sources.length;
    ctx.currentTime += 0.5;
    player.start({ ...SPEC, tempo: 100 });
    // The same id keeps its place: no extra bars beyond what the horizon needs.
    expect(audio.sources.length).toBe(first);
    player.start({ ...SPEC, id: "t2" });
    expect(audio.sources.length).toBeGreaterThan(first);
  });

  it("disposes every timer and node link", () => {
    const { player } = setup();
    player.start(SPEC);
    player.dispose();
    expect(jest.getTimerCount()).toBe(0);
    expect(player.isPlaying()).toBe(false);
  });
});
