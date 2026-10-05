import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import BreakModeSwitch from "../BreakModeSwitch";
import IcebergAimHint from "../IcebergAimHint";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("BreakModeSwitch", () => {
  it("shows the three modes with Real pressed and its help text", () => {
    render(<BreakModeSwitch />);
    const group = screen.getByRole("group", { name: "How she breaks" });
    expect(group).toHaveAccessibleDescription(/like the real one did/);
    expect(screen.getByRole("button", { name: "Real" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Break her" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(
      screen.getByRole("button", { name: "Hold together" })
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("sets the store's break mode and updates the help", async () => {
    const user = userEvent.setup();
    render(<BreakModeSwitch />);
    await user.click(screen.getByRole("button", { name: "Hold together" }));
    expect(store().breakMode).toBe("never");
    expect(
      screen.getByRole("button", { name: "Hold together" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("group", { name: "How she breaks" })
    ).toHaveAccessibleDescription(/one piece/);

    await user.click(screen.getByRole("button", { name: "Break her" }));
    expect(store().breakMode).toBe("always");
  });

  it("sits in the aim panel", () => {
    render(<IcebergAimHint />);
    expect(screen.queryByRole("group", { name: "How she breaks" })).toBeNull();
    act(() => store().aimIceberg());
    expect(
      screen.getByRole("group", { name: "How she breaks" })
    ).toBeInTheDocument();
    // Cancel still takes focus so Esc-less keyboard users can back out.
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });
});
