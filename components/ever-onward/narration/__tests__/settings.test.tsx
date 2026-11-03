import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NarrationSettings from "../NarrationSettings";
import {
  NARRATION_STORAGE_KEY,
  getNarrationSettings,
  setNarrationSettings,
  reloadNarrationSettings,
} from "../settings";

beforeEach(() => {
  window.localStorage.clear();
  act(() => reloadNarrationSettings());
});

describe("narration settings", () => {
  it("defaults to on, with auto-play off", () => {
    expect(getNarrationSettings()).toEqual({
      isEnabled: true,
      isAutoPlay: false,
      rate: 1,
    });
  });

  it("saves choices per device and reads them back", async () => {
    const user = userEvent.setup();
    render(<NarrationSettings />);
    await user.click(
      screen.getByRole("checkbox", { name: "Read new messages automatically" })
    );
    expect(
      JSON.parse(window.localStorage.getItem(NARRATION_STORAGE_KEY) ?? "{}")
    ).toEqual({ isEnabled: true, isAutoPlay: true, rate: 1 });

    act(() => reloadNarrationSettings());
    expect(getNarrationSettings().isAutoPlay).toBe(true);
  });

  it("keeps a saved speed only when it is one of the steps", () => {
    window.localStorage.setItem(
      NARRATION_STORAGE_KEY,
      JSON.stringify({ isEnabled: true, isAutoPlay: false, rate: 1.75 })
    );
    act(() => reloadNarrationSettings());
    expect(getNarrationSettings().rate).toBe(1.75);
    window.localStorage.setItem(
      NARRATION_STORAGE_KEY,
      JSON.stringify({ isEnabled: true, isAutoPlay: false, rate: 9 })
    );
    act(() => reloadNarrationSettings());
    expect(getNarrationSettings().rate).toBe(1);
  });

  it("sets the speed from the Menu, back to normal and up again", async () => {
    setNarrationSettings({ rate: 2 });
    const user = userEvent.setup();
    render(<NarrationSettings />);
    const speed = screen.getByTestId("eo-menu-speed");
    expect(speed).toHaveTextContent("2×");
    for (let i = 0; i < 4; i += 1)
      await user.click(screen.getByRole("button", { name: "Slower" }));
    expect(speed).toHaveTextContent("1×");
    expect(getNarrationSettings().rate).toBe(1);
    await user.click(screen.getByRole("button", { name: "Faster" }));
    expect(getNarrationSettings().rate).toBe(1.25);
  });

  it("disables auto-play when narration is off", async () => {
    const user = userEvent.setup();
    render(<NarrationSettings />);
    await user.click(screen.getByRole("checkbox", { name: "Narration" }));
    expect(
      screen.getByRole("checkbox", { name: "Read new messages automatically" })
    ).toBeDisabled();
  });

  it("falls back to defaults on garbage in storage", () => {
    window.localStorage.setItem(NARRATION_STORAGE_KEY, "{nope");
    act(() => reloadNarrationSettings());
    expect(getNarrationSettings().isEnabled).toBe(true);
  });
});
