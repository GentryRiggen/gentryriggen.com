import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { gridPart, testShip } from "@/lib/ship-builder/testing";
import SeaTrialButton from "../SeaTrialButton";
import WalkButton from "../WalkButton";
import WalkStopButton from "../WalkStopButton";

const store = () => useShipBuilderStore.getState();

const NO_DECK = testShip(
  Array.from({ length: 12 }, (_, i) => i * 2).flatMap((x) =>
    [0, 2].map((z) => gridPart(`p${x}${z}`, "pool", 0, x, z))
  )
);

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("WalkButton", () => {
  it("starts walking when there is a deck to stand on", async () => {
    act(() => store().loadShip(testShip(), null));
    render(<WalkButton />);
    const button = screen.getByRole("button", { name: "Walk" });
    expect(button).toBeEnabled();
    expect(screen.queryByText("Add a deck to walk on")).toBeNull();
    await userEvent.setup().click(button);
    expect(store().walk.status).toBe("walking");
  });

  it("is disabled with a hint when there is nowhere to stand", () => {
    act(() => store().loadShip(NO_DECK, null));
    render(<WalkButton />);
    const button = screen.getByRole("button", { name: "Walk" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Add a deck to walk on");
  });

  it("hides with the Sea trial button while walking", () => {
    act(() => store().loadShip(testShip(), null));
    render(<SeaTrialButton beside={<WalkButton />} />);
    expect(screen.getByRole("button", { name: "Walk" })).toBeInTheDocument();
    act(() => store().startWalk());
    expect(screen.queryByRole("button", { name: "Walk" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sea trial" })).toBeNull();
    act(() => store().stopWalk());
    expect(screen.getByRole("button", { name: "Walk" })).toBeInTheDocument();
  });
});

describe("WalkStopButton", () => {
  it("shows only while walking and stops the walk", async () => {
    act(() => store().loadShip(testShip(), null));
    render(<WalkStopButton />);
    expect(screen.queryByRole("button", { name: "Stop walking" })).toBeNull();
    act(() => store().startWalk());
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Stop walking" }));
    expect(store().walk.status).toBe("idle");
  });
});
