import { act } from "react";
import { render } from "@testing-library/react";
import { createFakeAudio } from "../../../game-audio/testing/fakeAudio";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import { createEverOnwardSynth } from "../everOnwardSynth";
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
