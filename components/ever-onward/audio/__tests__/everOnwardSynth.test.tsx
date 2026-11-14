import { act } from "react";
import { render } from "@testing-library/react";
import {
  createFakeAudio,
  type FakeContext,
} from "../../../game-audio/testing/fakeAudio";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import { GROW_UI } from "../../universes/grow";
import {
  createEverOnwardSynth,
  everOnwardSynth,
  HEALTH_CHECK_MS,
  MUSIC_LEVEL,
} from "../everOnwardSynth";
import { TAP_LEVEL } from "../voices";
import { everOnwardChannels } from "../soundSettings";
import useEverOnwardAudio from "../useEverOnwardAudio";

function Probe() {
  useEverOnwardAudio(lightUniverse, newRun(lightUniverse));
  return null;
}

describe("Ever Onward synth without AudioContext", () => {
  it("never throws and enable reports failure", () => {
    const synth = createEverOnwardSynth();
    expect(synth.enable()).toBe(false);
    expect(() => {
      synth.tap(0);
      synth.buy(0, true);
      synth.cue("ending");
      synth.setPhase(1);
      synth.setStorm(true);
      synth.pause();
      synth.resume();
    }).not.toThrow();
  });

  it("the hook mounts and unmounts quietly", () => {
    const { unmount } = render(<Probe />);
    expect(() => unmount()).not.toThrow();
  });
});

describe("Ever Onward synth with a fake AudioContext", () => {
  const audio = createFakeAudio();
  beforeEach(() => {
    audio.reset();
    audio.install();
  });
  afterEach(() => audio.uninstall());

  it("keeps taps clearly under the music bed", () => {
    expect(TAP_LEVEL).toBeLessThanOrEqual(0.4);
    expect(TAP_LEVEL).toBeLessThan(MUSIC_LEVEL);
  });

  it("plays a tap only after enable, and caps polyphony", () => {
    const synth = createEverOnwardSynth();
    synth.tap(0);
    expect(audio.sources).toHaveLength(0);
    expect(synth.enable()).toBe(true);
    for (let i = 0; i < 20; i += 1) synth.tap(0, i);
    // Six voices, three oscillators each.
    expect(audio.sources.length).toBe(6 * 3);
    synth.dispose();
  });

  it("never opens an audio session while music and sound are both off", () => {
    const synth = createEverOnwardSynth();
    synth.setMusicEnabled(false);
    synth.setEffectsEnabled(false);
    expect(synth.enable()).toBe(false);
    synth.setEffectsEnabled(true);
    expect(synth.enable()).toBe(true);
    synth.dispose();
  });

  it("is silent with effects off and while paused", () => {
    const synth = createEverOnwardSynth();
    synth.enable();
    synth.setEffectsEnabled(false);
    synth.tap(1);
    synth.buy(1, false);
    expect(audio.sources).toHaveLength(0);
    synth.setEffectsEnabled(true);
    synth.pause();
    synth.tap(1);
    expect(audio.sources).toHaveLength(0);
    synth.dispose();
  });

  it("rate-limits the affordable chime", () => {
    const synth = createEverOnwardSynth();
    synth.enable();
    synth.cue("affordable", 0);
    const afterFirst = audio.sources.length;
    synth.cue("affordable", 300);
    expect(audio.sources.length).toBe(afterFirst);
    synth.cue("affordable", 2000);
    expect(audio.sources.length).toBeGreaterThan(afterFirst);
    synth.dispose();
  });
});

describe("Grow audio on the synth", () => {
  const audio = createFakeAudio();
  beforeEach(() => {
    audio.reset();
    audio.install();
  });
  afterEach(() => audio.uninstall());

  it("switches to Grow's score when a Grow phase is set", () => {
    const synth = createEverOnwardSynth();
    synth.enable();
    synth.setPhase(0, GROW_UI.audio);
    const afterYard = audio.sources.length;
    expect(afterYard).toBeGreaterThan(0);
    synth.setPhase(2, GROW_UI.audio);
    expect(audio.sources.length).toBeGreaterThan(afterYard);
    synth.dispose();
  });

  it.each(["buzz", "ribbon", "flutter", "bloom"] as const)(
    "plays the %s cue",
    (name) => {
      const synth = createEverOnwardSynth();
      synth.enable();
      const before = audio.sources.length;
      synth.cue(name);
      expect(audio.sources.length).toBeGreaterThan(before);
      synth.dispose();
    }
  );
});

describe("Ever Onward sound after leaving the tab", () => {
  const audio = createFakeAudio();
  beforeEach(() => {
    audio.reset();
    audio.install();
    localStorage.clear();
    act(() => {
      everOnwardChannels.music.resetMemory();
      everOnwardChannels.effects.resetMemory();
    });
  });
  afterEach(() => audio.uninstall());

  const setVisibility = (state: "hidden" | "visible") => {
    Object.defineProperty(document, "visibilityState", {
      value: state,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  };

  it("hidden then visible resumes the context and restarts the music", async () => {
    const { unmount } = render(<Probe />);
    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    const ctx = audio.contexts[0] as unknown as {
      resume: jest.Mock;
      currentTime: number;
    };
    await act(async () => {});
    act(() => setVisibility("hidden"));
    expect(audio.contexts[0]).toBeDefined();
    const before = audio.sources.length;
    ctx.currentTime = 500;
    await act(async () => {
      setVisibility("visible");
    });
    expect(ctx.resume).toHaveBeenCalled();
    expect(audio.sources.length).toBeGreaterThan(before);
    unmount();
    everOnwardSynth.dispose();
  });

  it("an interrupted context is resumed by the next gesture, every time", async () => {
    const { unmount } = render(<Probe />);
    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    const ctx = audio.contexts[0] as unknown as {
      state: string;
      resume: jest.Mock;
    };
    ctx.state = "interrupted";
    ctx.resume.mockClear();
    await act(async () => {
      window.dispatchEvent(new Event("touchend"));
    });
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe("running");
    ctx.state = "suspended";
    await act(async () => {
      window.dispatchEvent(new Event("keydown"));
    });
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    unmount();
    everOnwardSynth.dispose();
  });

  it("does not bring music back when the music toggle is off", async () => {
    act(() => everOnwardChannels.music.set(false));
    const { unmount } = render(<Probe />);
    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    act(() => setVisibility("hidden"));
    const before = audio.sources.length;
    await act(async () => {
      setVisibility("visible");
    });
    expect(audio.sources.length).toBe(before);
    unmount();
    everOnwardSynth.dispose();
    act(() => everOnwardChannels.music.resetMemory());
  });
});

describe("Ever Onward channel settings", () => {
  beforeEach(() => localStorage.clear());

  it("default on and persist an off switch", () => {
    act(() => {
      everOnwardChannels.music.resetMemory();
      everOnwardChannels.effects.resetMemory();
    });
    expect(everOnwardChannels.music.get()).toBe(true);
    act(() => everOnwardChannels.music.set(false));
    expect(localStorage.getItem("ever-onward:ui:music")).toBe("off");
    act(() => everOnwardChannels.music.resetMemory());
    expect(everOnwardChannels.music.get()).toBe(false);
    act(() => everOnwardChannels.music.set(true));
  });
});

describe("Ever Onward sound that comes back dead", () => {
  const audio = createFakeAudio();
  let synth: ReturnType<typeof createEverOnwardSynth>;

  beforeEach(() => {
    jest.useFakeTimers();
    audio.reset();
    audio.install();
    synth = createEverOnwardSynth();
    synth.setPhase(0);
    expect(synth.enable()).toBe(true);
  });
  afterEach(() => {
    synth.dispose();
    audio.uninstall();
    jest.useRealTimers();
  });

  const first = () => audio.contexts[0] as unknown as FakeContext;
  const comeBack = () => {
    synth.pause();
    synth.resume();
  };

  it("a clock that stays still after coming back marks it broken", () => {
    comeBack();
    expect(first().state).toBe("running");
    jest.advanceTimersByTime(HEALTH_CHECK_MS);
    expect(synth.isBroken()).toBe(true);
  });

  it("a clock that moves on is left alone", () => {
    comeBack();
    first().currentTime = 0.5;
    jest.advanceTimersByTime(HEALTH_CHECK_MS);
    expect(synth.isBroken()).toBe(false);
    synth.wake();
    expect(audio.contexts).toHaveLength(1);
  });

  it("a resume that never answers marks it broken", () => {
    synth.pause();
    first().resume.mockImplementation(() => new Promise<void>(() => {}));
    synth.resume();
    expect(first().state).toBe("suspended");
    jest.advanceTimersByTime(HEALTH_CHECK_MS);
    expect(synth.isBroken()).toBe(true);
  });

  it("the next tap builds a new context and brings the music back", () => {
    comeBack();
    jest.advanceTimersByTime(HEALTH_CHECK_MS);
    const sourcesBefore = audio.sources.length;
    synth.wake();
    expect(first().close).toHaveBeenCalled();
    expect(audio.contexts).toHaveLength(2);
    expect(synth.isBroken()).toBe(false);
    expect(audio.sources.length).toBeGreaterThan(sourcesBefore);
    // Effects play on the new context.
    const before = audio.sources.length;
    synth.tap(0);
    expect(audio.sources.length).toBeGreaterThan(before);
  });

  it("a tap spots a frozen clock straight away, without waiting", () => {
    synth.resume();
    jest.setSystemTime(Date.now() + 300);
    synth.wake();
    expect(audio.contexts).toHaveLength(2);
  });

  it("fast taps can't hide a frozen clock", () => {
    synth.resume();
    for (let i = 0; i < 10; i += 1) {
      jest.setSystemTime(Date.now() + 100);
      if (audio.contexts.length > 1) break;
      synth.wake();
    }
    expect(audio.contexts).toHaveLength(2);
  });

  it("taps on a healthy context never rebuild it", () => {
    for (let i = 0; i < 10; i += 1) {
      first().currentTime += 0.1;
      jest.advanceTimersByTime(100);
      synth.wake();
    }
    jest.advanceTimersByTime(HEALTH_CHECK_MS);
    expect(synth.isBroken()).toBe(false);
    expect(audio.contexts).toHaveLength(1);
  });

  it("an interruption while showing marks it broken", () => {
    first().setState("interrupted");
    expect(synth.isBroken()).toBe(true);
  });

  it("suspending for a hidden tab is not a fault", () => {
    synth.pause();
    jest.advanceTimersByTime(HEALTH_CHECK_MS * 4);
    expect(synth.isBroken()).toBe(false);
  });

  it("the hooks repair it on the next gesture", () => {
    synth.dispose();
    const { unmount } = render(<Probe />);
    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    const ctx = audio.contexts.at(-1) as unknown as FakeContext;
    const count = audio.contexts.length;
    act(() => ctx.setState("interrupted"));
    act(() => {
      window.dispatchEvent(new Event("click"));
    });
    expect(ctx.close).toHaveBeenCalled();
    expect(audio.contexts).toHaveLength(count + 1);
    unmount();
    everOnwardSynth.dispose();
  });
});
