import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { planeSynth } from "../../audio/planeSynth";
import { soundSetting } from "../../audio/soundSetting";
import SoundToggle from "../SoundToggle";

beforeEach(() => {
  window.localStorage.clear();
  act(() => soundSetting.resetMemory());
  (window as unknown as { AudioContext: unknown }).AudioContext = class {};
});

afterEach(() => {
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  jest.restoreAllMocks();
});

describe("SoundToggle", () => {
  it("renders nothing when audio is unsupported", () => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    const { container } = render(<SoundToggle />);
    expect(container).toBeEmptyDOMElement();
  });

  it("starts off, turns on inside the click, and turns off again", async () => {
    const enable = jest.spyOn(planeSynth, "enable").mockReturnValue(true);
    const disable = jest.spyOn(planeSynth, "disable").mockImplementation();
    render(<SoundToggle />);
    const button = screen.getByRole("button", { name: "Sound" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);
    expect(enable).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("plane-builder:ui:sound")).toBe("on");

    await userEvent.click(button);
    expect(disable).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("stays off when the audio engine cannot start", async () => {
    jest.spyOn(planeSynth, "enable").mockReturnValue(false);
    render(<SoundToggle />);
    const button = screen.getByRole("button", { name: "Sound" });
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
  });
});
