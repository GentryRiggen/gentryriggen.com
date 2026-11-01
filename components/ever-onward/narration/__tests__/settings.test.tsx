import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NarrationSettings from "../NarrationSettings";
import {
  NARRATION_STORAGE_KEY,
  getNarrationSettings,
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
    ).toEqual({ isEnabled: true, isAutoPlay: true });

    act(() => reloadNarrationSettings());
    expect(getNarrationSettings().isAutoPlay).toBe(true);
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
