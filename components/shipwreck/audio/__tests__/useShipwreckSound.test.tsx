import { act, render } from "@testing-library/react";
import { createFakeAudio } from "@/components/game-audio/testing/fakeAudio";
import type { VoiceEngine } from "@/components/game-audio/primitives";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { useShipwreckSound } from "../useShipwreckSound";

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
}
function Probe({ store, active, enabled }: ProbeProps) {
  useShipwreckSound(store, active, enabled);
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
});
