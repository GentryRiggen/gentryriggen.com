import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { soundSetting } from "../../audio/soundSetting";
import { trialSynth } from "../../audio/synth";
import SoundToggle from "../SoundToggle";

jest.mock("../../audio/synth", () => ({
  isAudioSupported: jest.fn(() => true),
  trialSynth: {
    enable: jest.fn(() => true),
    disable: jest.fn(),
    isEnabled: jest.fn(() => false),
  },
}));

const { isAudioSupported } = jest.requireMock("../../audio/synth") as {
  isAudioSupported: jest.Mock;
};

beforeEach(() => {
  localStorage.clear();
  act(() => soundSetting.resetMemory());
  jest.clearAllMocks();
  isAudioSupported.mockReturnValue(true);
});

describe("SoundToggle", () => {
  it("starts off and turns on from a click, starting the audio", async () => {
    const user = userEvent.setup();
    render(<SoundToggle />);
    const button = await screen.findByRole("button", { name: "Sound off" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(trialSynth.enable).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Sound on" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(localStorage.getItem("ship-builder:ui:sound")).toBe("on");
  });

  it("turns off again and forgets the choice", async () => {
    const user = userEvent.setup();
    render(<SoundToggle />);
    await user.click(await screen.findByRole("button", { name: "Sound off" }));
    await user.click(screen.getByRole("button", { name: "Sound on" }));
    expect(trialSynth.disable).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sound off" })).toBeVisible();
    expect(localStorage.getItem("ship-builder:ui:sound")).toBeNull();
  });

  it("stays off when the audio engine cannot start", async () => {
    (trialSynth.enable as jest.Mock).mockReturnValueOnce(false);
    const user = userEvent.setup();
    render(<SoundToggle />);
    await user.click(await screen.findByRole("button", { name: "Sound off" }));
    expect(screen.getByRole("button", { name: "Sound off" })).toBeVisible();
  });

  it("starts remembered sound on the first tap", async () => {
    localStorage.setItem("ship-builder:ui:sound", "on");
    const user = userEvent.setup();
    render(<SoundToggle />);
    await screen.findByRole("button", { name: "Sound on" });
    expect(trialSynth.enable).not.toHaveBeenCalled();
    await user.click(document.body);
    expect(trialSynth.enable).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without Web Audio", () => {
    isAudioSupported.mockReturnValue(false);
    const { container } = render(<SoundToggle />);
    expect(container).toBeEmptyDOMElement();
  });
});
