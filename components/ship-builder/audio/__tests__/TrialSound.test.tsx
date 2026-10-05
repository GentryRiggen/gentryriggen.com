import { act } from "react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { soundSetting } from "../soundSetting";
import { trialSynth } from "../synth";
import TrialSound from "../TrialSound";

jest.mock("@react-three/fiber", () => ({ useFrame: jest.fn() }));
jest.mock("../synth", () => ({
  isAudioSupported: jest.fn(() => true),
  trialSynth: {
    enable: jest.fn(() => true),
    disable: jest.fn(),
    isEnabled: jest.fn(() => false),
    pause: jest.fn(),
    resume: jest.fn(),
    play: jest.fn(),
    setAmbient: jest.fn(),
    setMuffle: jest.fn(),
    setSpeed: jest.fn(),
  },
}));

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  localStorage.clear();
  act(() => soundSetting.resetMemory());
  setVisibility("visible");
  jest.clearAllMocks();
  (trialSynth.isEnabled as jest.Mock).mockReturnValue(false);
});

describe("TrialSound unlock", () => {
  it("starts remembered sound on the first tap, once", async () => {
    localStorage.setItem("ship-builder:ui:sound", "on");
    const user = userEvent.setup();
    render(<TrialSound />);
    expect(trialSynth.enable).not.toHaveBeenCalled();
    await user.click(document.body);
    await user.click(document.body);
    expect(trialSynth.enable).toHaveBeenCalledTimes(1);
  });

  it("does nothing while sound is off", async () => {
    const user = userEvent.setup();
    render(<TrialSound />);
    await user.click(document.body);
    expect(trialSynth.enable).not.toHaveBeenCalled();
  });

  it("turns the setting off when the engine cannot start", async () => {
    localStorage.setItem("ship-builder:ui:sound", "on");
    (trialSynth.enable as jest.Mock).mockReturnValueOnce(false);
    const user = userEvent.setup();
    render(<TrialSound />);
    await user.click(document.body);
    expect(localStorage.getItem("ship-builder:ui:sound")).toBeNull();
  });

  it("stops listening when unmounted", async () => {
    localStorage.setItem("ship-builder:ui:sound", "on");
    const user = userEvent.setup();
    const { unmount } = render(<TrialSound />);
    unmount();
    await user.click(document.body);
    expect(trialSynth.enable).not.toHaveBeenCalled();
  });
});

describe("TrialSound lifecycle", () => {
  it("silences the held sounds when unmounted", () => {
    const { unmount } = render(<TrialSound />);
    unmount();
    expect(trialSynth.setAmbient).toHaveBeenCalledWith({
      sea: false,
      hum: false,
    });
  });

  it("pauses when the tab is hidden and resumes when it is back", () => {
    render(<TrialSound />);
    setVisibility("hidden");
    expect(trialSynth.pause).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    expect(trialSynth.resume).toHaveBeenCalledTimes(1);
  });

  it("renders nothing", () => {
    const { container } = render(<TrialSound />);
    expect(container).toBeEmptyDOMElement();
  });
});
