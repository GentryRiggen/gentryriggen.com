import { fireEvent, render, screen } from "@testing-library/react";
import { playOnSilent } from "../../../game-audio/audioSession";
import PlayOnSilentToggle from "../PlayOnSilentToggle";

type Nav = Navigator & { audioSession?: { type: string } };

describe("PlayOnSilentToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    playOnSilent.resetMemory();
    (navigator as Nav).audioSession = { type: "ambient" };
  });
  afterEach(() => {
    delete (navigator as Nav).audioSession;
  });

  it("is a labelled switch, off by default, with a plain explanation", () => {
    render(<PlayOnSilentToggle />);
    const toggle = screen.getByRole("switch", { name: "Play sound on silent" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveAccessibleDescription(/pause your podcast or music/);
  });

  it("flips aria-checked and the audio session when pressed", () => {
    render(<PlayOnSilentToggle />);
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect((navigator as Nav).audioSession?.type).toBe("playback");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect((navigator as Nav).audioSession?.type).toBe("ambient");
  });
});
