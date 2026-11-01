import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChannelToggles from "../ChannelToggles";
import { createChannelSettings } from "../channels";

const settings = createChannelSettings("toggle-test");

function renderToggles(isSoundOn: boolean) {
  return render(
    <ChannelToggles
      settings={settings}
      isSoundOn={isSoundOn}
      buttonClass="off"
      pressedButtonClass="on"
    />
  );
}

beforeEach(() => {
  localStorage.clear();
  act(() => {
    settings.music.resetMemory();
    settings.effects.resetMemory();
  });
});

describe("ChannelToggles", () => {
  it("adds a Voice switch only for settings with a voice", async () => {
    const voiced = createChannelSettings("toggle-voice-test", { voice: true });
    act(() => voiced.voice.resetMemory());
    const user = userEvent.setup();
    render(
      <ChannelToggles
        settings={voiced}
        isSoundOn
        buttonClass="off"
        pressedButtonClass="on"
      />
    );
    const voice = screen.getByRole("button", { name: "Voice" });
    expect(voice).toHaveAttribute("aria-pressed", "true");
    await user.click(voice);
    expect(voiced.voice.get()).toBe(false);
    expect(localStorage.getItem("toggle-voice-test:ui:voice")).toBe("off");
  });

  it("has no Voice switch otherwise", () => {
    renderToggles(true);
    expect(screen.queryByRole("button", { name: "Voice" })).toBeNull();
  });

  it("shows nothing while sound is off", () => {
    const { container } = renderToggles(false);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows music and effects, both on by default", () => {
    renderToggles(true);
    expect(screen.getByRole("button", { name: "Music" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      screen.getByRole("button", { name: "Sound effects" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("switches music and effects independently", async () => {
    const user = userEvent.setup();
    renderToggles(true);
    await user.click(screen.getByRole("button", { name: "Music" }));
    expect(screen.getByRole("button", { name: "Music" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(
      screen.getByRole("button", { name: "Sound effects" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(settings.music.get()).toBe(false);
    expect(settings.effects.get()).toBe(true);
    await user.click(screen.getByRole("button", { name: "Sound effects" }));
    expect(settings.effects.get()).toBe(false);
  });
});
