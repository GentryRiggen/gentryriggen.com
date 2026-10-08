import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { gridPart, testShip } from "@/lib/ship-builder/testing";
import SeaTrialButton from "../SeaTrialButton";
import { getWalkState } from "@/lib/ship-builder/state/walkLive";
import WalkButton from "../WalkButton";

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
  it("opens the start card, then walks from the chosen spot", async () => {
    act(() => store().loadShip(testShip(), null));
    const user = userEvent.setup();
    render(<WalkButton />);
    const button = screen.getByRole("button", { name: "Walk" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Add a deck to walk on")).toBeNull();

    await user.click(button);
    expect(store().walk.status).toBe("idle");
    expect(button).toHaveAttribute("aria-expanded", "true");
    const card = screen.getByRole("dialog", {
      name: "Where do you want to start?",
    });
    expect(button).toHaveAttribute("aria-controls", card.id);
    expect(screen.getByRole("button", { name: "Middle" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Back (stern)" }));
    expect(store().walk.status).toBe("walking");
    expect(getWalkState()!.x).toBeGreaterThan(18);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("toggles the card closed when Walk is tapped again", async () => {
    act(() => store().loadShip(testShip(), null));
    const user = userEvent.setup();
    render(<WalkButton />);
    await user.click(screen.getByRole("button", { name: "Walk" }));
    await user.click(screen.getByRole("button", { name: "Walk" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(store().walk.status).toBe("idle");
  });

  it("stays closed once the ship can no longer be walked, even after a redo", async () => {
    act(() => store().loadShip(testShip(), null));
    const user = userEvent.setup();
    render(<WalkButton />);
    await user.click(screen.getByRole("button", { name: "Walk" }));
    act(() => store().loadShip(NO_DECK, null));
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => store().loadShip(testShip(), null));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when focus tabs out of it", async () => {
    act(() => store().loadShip(testShip(), null));
    const user = userEvent.setup();
    render(
      <>
        <WalkButton />
        <button type="button">Elsewhere</button>
      </>
    );
    await user.click(screen.getByRole("button", { name: "Walk" }));
    // Middle has focus: Back, then out of the card.
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape, hands focus back and keeps the key to itself", async () => {
    act(() => store().loadShip(testShip(), null));
    const user = userEvent.setup();
    const onWindowKey = jest.fn();
    window.addEventListener("keydown", onWindowKey);
    render(<WalkButton />);
    await user.click(screen.getByRole("button", { name: "Walk" }));
    await user.keyboard("{Escape}");
    window.removeEventListener("keydown", onWindowKey);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Walk" })).toHaveFocus();
    expect(onWindowKey).not.toHaveBeenCalled();
  });

  it("closes when you press somewhere else", async () => {
    act(() => store().loadShip(testShip(), null));
    const user = userEvent.setup();
    render(
      <>
        <p>elsewhere</p>
        <WalkButton />
      </>
    );
    await user.click(screen.getByRole("button", { name: "Walk" }));
    await user.click(screen.getByText("elsewhere"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(store().walk.status).toBe("idle");
  });

  it("is disabled with a hint when there is nowhere to stand", async () => {
    act(() => store().loadShip(NO_DECK, null));
    render(<WalkButton />);
    const button = screen.getByRole("button", { name: "Walk" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Add a deck to walk on");
    await userEvent.setup().click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
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
