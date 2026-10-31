import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ViewControls from "../ViewControls";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  localStorage.clear();
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("ViewControls", () => {
  it("sets camera presets", async () => {
    const user = userEvent.setup();
    render(<ViewControls />);
    const top = screen.getByRole("button", { name: "Top view" });
    const side = screen.getByRole("button", { name: "Side view" });
    expect(top).toHaveAttribute("aria-pressed", "false");
    await user.click(top);
    expect(store().camera.view).toBe("top");
    expect(top).toHaveAttribute("aria-pressed", "true");
    expect(side).toHaveAttribute("aria-pressed", "false");
  });

  it("switches to the below and three-quarter views", async () => {
    const user = userEvent.setup();
    render(<ViewControls />);
    await user.click(screen.getByRole("button", { name: "Below view" }));
    expect(store().camera.view).toBe("below");
    await user.click(
      screen.getByRole("button", { name: "Three-quarter view" })
    );
    expect(store().camera.view).toBe("three-quarter");
  });

  it("offers three sea states and remembers the choice", async () => {
    const user = userEvent.setup();
    render(<ViewControls />);
    const calm = screen.getByRole("button", { name: "Calm sea" });
    const stormy = screen.getByRole("button", { name: "Stormy sea" });
    expect(calm).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Choppy sea" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await user.click(stormy);
    expect(stormy).toHaveAttribute("aria-pressed", "true");
    expect(calm).toHaveAttribute("aria-pressed", "false");
    expect(localStorage.getItem("ship-builder:ui:sea")).toBe("stormy");
    await user.click(calm);
  });

  it("offers day, sunset and night and remembers the choice", async () => {
    const user = userEvent.setup();
    render(<ViewControls />);
    const day = screen.getByRole("button", { name: "Day" });
    const sunset = screen.getByRole("button", { name: "Sunset" });
    const night = screen.getByRole("button", { name: "Night" });
    expect(day).toHaveAttribute("aria-pressed", "true");
    expect(night).toHaveAttribute("aria-pressed", "false");
    await user.click(night);
    expect(night).toHaveAttribute("aria-pressed", "true");
    expect(day).toHaveAttribute("aria-pressed", "false");
    expect(localStorage.getItem("ship-builder:ui:time")).toBe("night");
    await user.click(sunset);
    expect(sunset).toHaveAttribute("aria-pressed", "true");
    expect(night).toHaveAttribute("aria-pressed", "false");
    await user.click(day);
  });

  it("keeps showing the main choices while a trial shows its own", () => {
    render(<ViewControls />);
    act(() => store().openTrialSetup("storm"));
    act(() => store().setTrialLook({ time: "night" }));
    expect(screen.getByRole("button", { name: "Calm sea" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Day" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Night" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("pauses the sea and time chips while a trial is on", () => {
    render(<ViewControls />);
    act(() => store().startTrial("calm"));
    for (const name of ["Calm sea", "Stormy sea", "Day", "Sunset", "Night"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    act(() => store().endTrial());
    expect(screen.getByRole("button", { name: "Night" })).toBeEnabled();
  });
});
