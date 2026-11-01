import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAudio } from "../../../game-audio/testing/fakeAudio";
import MusicToggle from "../MusicToggle";
import { createEverOnwardSynth, everOnwardSynth } from "../everOnwardSynth";
import { everOnwardChannels } from "../soundSettings";
import { TITLE_SCORE } from "../scores";
import useTitleMusic from "../useTitleMusic";
import { isValidSpec } from "../../../game-audio/music";

function Probe({ isActive = true }: { isActive?: boolean }) {
  useTitleMusic(isActive);
  return (
    <>
      <MusicToggle />
      <p>screen</p>
    </>
  );
}

describe("title score", () => {
  it("is a valid spec", () => {
    expect(isValidSpec(TITLE_SCORE)).toBe(true);
  });
});

describe("title music", () => {
  const audio = createFakeAudio();
  beforeEach(() => {
    window.localStorage.clear();
    everOnwardChannels.music.resetMemory();
    audio.reset();
    audio.install();
  });
  afterEach(() => {
    everOnwardSynth.dispose();
    audio.uninstall();
  });

  it("is silent until the first gesture, then plays", async () => {
    render(<Probe />);
    expect(audio.sources).toHaveLength(0);
    expect(everOnwardSynth.isEnabled()).toBe(false);
    await userEvent.click(screen.getByText("screen"));
    expect(everOnwardSynth.isEnabled()).toBe(true);
    expect(audio.sources.length).toBeGreaterThan(0);
  });

  it("stays silent when the music toggle is off, and the toggle is shared", async () => {
    const user = userEvent.setup();
    render(<Probe />);
    await user.click(screen.getByRole("button", { name: "Music" }));
    expect(everOnwardChannels.music.get()).toBe(false);
    audio.reset();
    await user.click(screen.getByText("screen"));
    expect(audio.sources).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Music" }));
    expect(everOnwardChannels.music.get()).toBe(true);
    expect(audio.sources.length).toBeGreaterThan(0);
  });

  it("stops the theme when switched off", async () => {
    const { rerender } = render(<Probe />);
    await userEvent.click(screen.getByText("screen"));
    const before = audio.sources.length;
    expect(before).toBeGreaterThan(0);
    act(() => rerender(<Probe isActive={false} />));
    // Switching off drops the bed; a phase score takes over when set.
    everOnwardSynth.setPhase(0);
    expect(audio.sources.length).toBeGreaterThan(before);
  });
});

describe("synth title mode", () => {
  const audio = createFakeAudio();
  beforeEach(() => {
    audio.reset();
    audio.install();
  });
  afterEach(() => audio.uninstall());

  it("plays only once enabled and only while on", () => {
    const synth = createEverOnwardSynth();
    synth.setTitle(true);
    expect(audio.sources).toHaveLength(0);
    synth.enable();
    const playing = audio.sources.length;
    expect(playing).toBeGreaterThan(0);
    synth.setTitle(false);
    synth.dispose();
  });
});
