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
