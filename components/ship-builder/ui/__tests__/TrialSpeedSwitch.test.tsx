import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getTrialSpeed, trialSpeedSetting } from "../../hooks/useTrialSpeed";
import TrialSpeedSwitch from "../TrialSpeedSwitch";

beforeEach(() => {
  localStorage.clear();
  act(() => trialSpeedSetting.resetMemory());
});

describe("TrialSpeedSwitch", () => {
  it("shows 1x, 2x and 3x with 1x pressed", () => {
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
    expect(screen.getByRole("button", { name: "3x" })).toBeInTheDocument();
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
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("button", { name: "1x" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "3x" })).toHaveFocus();
    expect(getTrialSpeed()).toBe(3);
  });
});
