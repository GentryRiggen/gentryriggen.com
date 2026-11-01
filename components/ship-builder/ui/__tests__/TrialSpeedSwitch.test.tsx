import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  getTrialSpeed,
  parseTrialSpeed,
  trialSpeedSetting,
} from "../../hooks/useTrialSpeed";
import {
  publishEscape,
  resetEscape,
} from "@/lib/ship-builder/state/escapeLive";
import { startSwimming } from "@/lib/ship-builder/walk/escape";
import TrialSpeedSwitch from "../TrialSpeedSwitch";

beforeEach(() => {
  localStorage.clear();
  act(() => trialSpeedSetting.resetMemory());
  act(() => resetEscape());
});

describe("TrialSpeedSwitch", () => {
  it("shows all six speeds with 1x pressed", () => {
    render(<TrialSpeedSwitch />);
    expect(screen.getByRole("group", { name: "Speed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1x" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "2x" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    for (const name of ["3x", "5x", "10x", "20x"])
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("clicking 20x sets it, and junk stored values fall back to 1x", async () => {
    const user = userEvent.setup();
    render(<TrialSpeedSwitch />);
    await user.click(screen.getByRole("button", { name: "20x" }));
    expect(getTrialSpeed()).toBe(20);
    expect(parseTrialSpeed("7")).toBe(1);
    expect(parseTrialSpeed("abc")).toBe(1);
    expect(parseTrialSpeed("10")).toBe(10);
  });

  it("clicking 3x presses it and sets the speed", async () => {
    const user = userEvent.setup();
    render(<TrialSpeedSwitch />);
    await user.click(screen.getByRole("button", { name: "3x" }));
    expect(screen.getByRole("button", { name: "3x" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(getTrialSpeed()).toBe(3);
  });

  it("arrow keys move between the speeds", async () => {
    const user = userEvent.setup();
    render(<TrialSpeedSwitch />);
    screen.getByRole("button", { name: "1x" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "2x" })).toHaveFocus();
    expect(getTrialSpeed()).toBe(2);
    await user.keyboard(
      "{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}"
    );
    expect(screen.getByRole("button", { name: "1x" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "20x" })).toHaveFocus();
    expect(getTrialSpeed()).toBe(20);
  });

  it("Home and End jump to the slowest and fastest", async () => {
    const user = userEvent.setup();
    render(<TrialSpeedSwitch />);
    screen.getByRole("button", { name: "1x" }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("button", { name: "20x" })).toHaveFocus();
    expect(getTrialSpeed()).toBe(20);
    await user.keyboard("{Home}");
    expect(screen.getByRole("button", { name: "1x" })).toHaveFocus();
    expect(getTrialSpeed()).toBe(1);
  });

  it("is a single Tab stop on the picked speed", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">before</button>
        <TrialSpeedSwitch />
        <button type="button">after</button>
      </>
    );
    await user.click(screen.getByRole("button", { name: "5x" }));
    screen.getByRole("button", { name: "before" }).focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "5x" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
  });

  it("holds 1x and hides while the walker swims, then comes back", () => {
    act(() => trialSpeedSetting.set(10));
    render(<TrialSpeedSwitch />);
    act(() =>
      publishEscape({
        phase: startSwimming({ x: 0, z: 0 }, 0, 1),
        boardable: null,
        pickup: null,
      })
    );
    expect(screen.queryByRole("group", { name: "Speed" })).toBeNull();
    expect(getTrialSpeed()).toBe(1);
    act(() => resetEscape());
    expect(screen.getByRole("group", { name: "Speed" })).toBeInTheDocument();
    expect(getTrialSpeed()).toBe(10);
  });
});
