import { act } from "react";
import {
  createChannelSettings,
  prefersReducedMotion,
  REDUCED_MOTION_GAIN,
  shouldPlayEffects,
  shouldPlayMusic,
  softnessGain,
  type ChannelState,
  watchReducedMotion,
} from "../channels";

const ON: ChannelState = {
  isUnlocked: true,
  isMusicOn: true,
  isEffectsOn: true,
  isTabHidden: false,
};

describe("channel settings", () => {
  beforeEach(() => localStorage.clear());

  it("defaults both music and effects to on", () => {
    const { music, effects } = createChannelSettings("test-a");
    act(() => {
      music.resetMemory();
      effects.resetMemory();
    });
    expect(music.get()).toBe(true);
    expect(effects.get()).toBe(true);
  });

  it("remembers an off switch per game, and independently", () => {
    const first = createChannelSettings("test-b");
    const second = createChannelSettings("test-c");
    act(() => first.music.set(false));
    expect(localStorage.getItem("test-b:ui:music")).toBe("off");
    expect(first.music.get()).toBe(false);
    expect(first.effects.get()).toBe(true);
    expect(second.music.get()).toBe(true);
  });

  it("goes back to on and clears the stored key", () => {
    const { music } = createChannelSettings("test-d");
    act(() => music.set(false));
    act(() => music.set(true));
    expect(localStorage.getItem("test-d:ui:music")).toBeNull();
  });
});

describe("what should be heard", () => {
  it("plays music only after the unlock, with the switch on and the tab shown", () => {
    expect(shouldPlayMusic(ON)).toBe(true);
    expect(shouldPlayMusic({ ...ON, isUnlocked: false })).toBe(false);
    expect(shouldPlayMusic({ ...ON, isMusicOn: false })).toBe(false);
    expect(shouldPlayMusic({ ...ON, isTabHidden: true })).toBe(false);
  });

  it("keeps music and effects separate", () => {
    const musicOnly = { ...ON, isEffectsOn: false };
    expect(shouldPlayMusic(musicOnly)).toBe(true);
    expect(shouldPlayEffects(musicOnly)).toBe(false);
    const effectsOnly = { ...ON, isMusicOn: false };
    expect(shouldPlayMusic(effectsOnly)).toBe(false);
    expect(shouldPlayEffects(effectsOnly)).toBe(true);
  });

  it("silences effects before the unlock and while the tab is hidden", () => {
    expect(shouldPlayEffects({ ...ON, isUnlocked: false })).toBe(false);
    expect(shouldPlayEffects({ ...ON, isTabHidden: true })).toBe(false);
  });
});

describe("reduced motion", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  function mockPreference(matches: boolean) {
    window.matchMedia = jest.fn(() => ({ matches })) as never;
  }

  it("lowers the whole mix when asked for less motion", () => {
    mockPreference(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(softnessGain()).toBe(REDUCED_MOTION_GAIN);
  });

  it("leaves the mix alone otherwise", () => {
    mockPreference(false);
    expect(softnessGain()).toBe(1);
  });
});

describe("watchReducedMotion", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  it("reports changes live and stops when told to", () => {
    const listeners = new Set<() => void>();
    window.matchMedia = jest.fn(() => ({
      matches: false,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    })) as never;
    const onChange = jest.fn();
    const stop = watchReducedMotion(onChange);
    listeners.forEach((fn) => fn());
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    expect(listeners.size).toBe(0);
  });
});
