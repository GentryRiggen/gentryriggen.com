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
});
