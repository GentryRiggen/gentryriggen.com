import { act, render } from "@testing-library/react";
import { createFakeAudio } from "@/components/game-audio/testing/fakeAudio";
import type { VoiceEngine } from "@/components/game-audio/primitives";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { createSceneRuntime } from "@/components/shipwreck/scene/runtime";
import type { SceneRuntime } from "@/components/shipwreck/scene/runtime";
import { useShipwreckSound } from "../useShipwreckSound";
import { playCue } from "../voices";

jest.mock("../voices", () => {
  const actual = jest.requireActual("../voices");
  return { ...actual, playCue: jest.fn(actual.playCue) };
});

const audio = createFakeAudio();
let current: VoiceEngine | null = null;
const listeners: ((e: VoiceEngine) => void)[] = [];
const fakeResilient = {
  isSupported: () => true,
  engine: () => current,
  onEngine: (l: (e: VoiceEngine) => void) => {
    listeners.push(l);
    return () => {};
  },
};
jest.mock("@/components/game-audio/useResilientAudio", () => ({
  useResilientAudio: () => fakeResilient,
}));

function makeEngine(): VoiceEngine {
  const ctx = new (
    window as unknown as { AudioContext: new () => AudioContext }
  ).AudioContext();
  return {
    ctx,
    bus: ctx.createGain(),
    white: ctx.createBuffer(1, 1, 100),
    brown: ctx.createBuffer(1, 1, 100),
  };
}

interface ProbeProps {
  store: ReturnType<typeof createPlaybackStore>;
  active: boolean;
  enabled: boolean;
  runtime?: SceneRuntime;
}
function Probe({ store, active, enabled, runtime }: ProbeProps) {
  useShipwreckSound(store, active, enabled, runtime);
  return null;
}

describe("useShipwreckSound", () => {
  beforeEach(() => {
    audio.install();
    audio.reset();
    current = makeEngine();
  });
  afterEach(() => audio.uninstall());

  /** The night bus: the first gain wired straight into the engine's bus. */
  function nightBus(engine: VoiceEngine) {
    return audio.nodes.find((n) =>
      n.connect.mock.calls.some((c: unknown[]) => c[0] === engine.bus)
    );
  }

  it("silences everything at once when sound goes off, and back on", () => {
    const engine = current!;
    const store = createPlaybackStore();
    const { rerender } = render(<Probe store={store} active enabled />);
    act(() => store.getState().start(titanic, titanic.realNight));
    act(() => store.getState().pump(20));
    const bus = nightBus(engine);
    expect(bus).toBeTruthy();
    rerender(<Probe store={store} active enabled={false} />);
    const off = bus!.gain.setTargetAtTime.mock.calls.at(-1);
    expect(off?.[0]).toBe(0);
    rerender(<Probe store={store} active enabled />);
    const on = bus!.gain.setTargetAtTime.mock.calls.at(-1);
    expect(on?.[0]).toBe(1);
  });

  it("keeps the beds through a hidden spell and refreshes them on show", () => {
    const store = createPlaybackStore();
    render(<Probe store={store} active enabled />);
    act(() => store.getState().start(titanic, titanic.realNight));
    act(() => store.getState().pump(20));
    const sources = audio.sources.length;
    expect(sources).toBeGreaterThan(0);
    const engine = current;
    // Hidden: the kit hands out no engine; a store change lands meanwhile.
    current = null;
    // Past the beds' 0.2 s update gap, so this change reaches them.
    const now = jest
      .spyOn(performance, "now")
      .mockReturnValue(performance.now() + 10_000);
    act(() => store.getState().pause());
    now.mockRestore();
    for (const s of audio.sources) expect(s.stop).not.toHaveBeenCalled();
    // Shown again with the same context: nothing rebuilt, nothing stopped.
    current = engine;
    jest.useFakeTimers();
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      jest.runAllTimers();
    });
    jest.useRealTimers();
    expect(audio.sources.length).toBe(sources);
    for (const s of audio.sources) expect(s.stop).not.toHaveBeenCalled();
  });

  it("plays her afternoon's cues and engines bed for the Lusitania", () => {
    const store = createPlaybackStore();
    render(<Probe store={store} active enabled />);
    act(() => store.getState().start(lusitania, lusitania.realNight));
    const before = audio.sources.length;
    act(() => store.getState().pump(1));
    // The torpedo thud (t = 0) sounds, with beds built on the same engine.
    expect(audio.sources.length).toBeGreaterThan(before);
  });

  it("hears the walk: a splash on going in, the scrape while paused", () => {
    jest.useFakeTimers();
    try {
      const mock = playCue as jest.Mock;
      const store = createPlaybackStore();
      const runtime = createSceneRuntime();
      render(<Probe store={store} active enabled runtime={runtime} />);
      act(() => store.getState().start(titanic, titanic.realNight));
      act(() => store.getState().pump(20));
      act(() => store.getState().pause());
      act(() => store.getState().startWalk());
      mock.mockClear();
      const cues = () => mock.mock.calls.map((c) => c[1]);
      // Sliding while paused: the walk timer hears it.
      runtime.walkSlide = 1;
      act(() => jest.advanceTimersByTime(500));
      expect(cues()).toContain("scrape");
      runtime.walkSlide = 0;
      runtime.walkSplash += 1;
      act(() => store.getState().wentInWater());
      act(() => jest.advanceTimersByTime(1000));
      expect(cues().filter((c) => c === "splash")).toHaveLength(1);
      // Walk off: no more walk cues.
      act(() => store.getState().leaveWalk());
      mock.mockClear();
      runtime.walkSlide = 1;
      act(() => jest.advanceTimersByTime(5000));
      expect(cues()).not.toContain("scrape");
    } finally {
      jest.useRealTimers();
    }
  });

  it("builds the storm beds and plays her swell at t = 0 for the Fitzgerald", () => {
    const mock = playCue as jest.Mock;
    const store = createPlaybackStore();
    render(<Probe store={store} active enabled />);
    act(() => store.getState().start(fitzgerald, fitzgerald.realNight));
    mock.mockClear();
    const before = audio.sources.length;
    act(() => store.getState().pump(1));
    expect(audio.sources.length).toBeGreaterThan(before);
    expect(store.getState().t).toBe(0);
    // Her collision event at t = 0 is the storm's swell, once playback moves.
    act(() => store.getState().play());
    act(() => store.getState().tick(0.1, 0));
    expect(mock.mock.calls.map((c) => c[1])).toContain("swell");
  });
});
