import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BelowDeck from "../BelowDeck";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("BelowDeck", () => {
  it("has a heading and plain-words help", () => {
    render(<BelowDeck />);
    expect(
      screen.getByRole("heading", { name: "Below deck" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Tap a wall to add it/)).toBeVisible();
  });

  it("cycles a wall in the store with each tap, and undoes", async () => {
    const user = userEvent.setup();
    render(<BelowDeck />);
    const slot = () => screen.getByRole("button", { name: /^Wall 2:/ });
    await user.click(slot());
    expect(store().ship.hull.bulkheads).toEqual([{ at: 2, height: "low" }]);
    expect(slot()).toHaveAccessibleName("Wall 2: low. Tap to change.");
    await user.click(slot());
    await user.click(slot());
    await user.click(slot());
    expect(store().ship.hull.bulkheads).toBeUndefined();
    act(() => store().undo());
    expect(store().ship.hull.bulkheads).toEqual([{ at: 2, height: "deck" }]);
  });

  it("is read-only during a trial", () => {
    act(() => store().startTrial("calm"));
    render(<BelowDeck />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
