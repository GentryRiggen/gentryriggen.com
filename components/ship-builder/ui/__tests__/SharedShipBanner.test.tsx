import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { listShips } from "@/lib/ship-builder/persist/local";
import { useSharedLinkStore } from "@/lib/ship-builder/state/sharedLink";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import SharedShipBanner from "../SharedShipBanner";

function arriveByLink(name: string) {
  const ship = { ...useShipBuilderStore.getState().ship, name };
  act(() => {
    useShipBuilderStore.getState().loadShip(ship, null);
    useSharedLinkStore.getState().show(useShipBuilderStore.getState().ship);
  });
  return ship;
}

describe("SharedShipBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useShipBuilderStore.setState(createInitialState());
      useSharedLinkStore.getState().dismiss();
    });
  });

  it("shows nothing when the ship did not come from a link", () => {
    render(<SharedShipBanner />);
    expect(screen.queryByText(/a friend shared/i)).not.toBeInTheDocument();
  });

  it("greets the player and names the ship", () => {
    arriveByLink("Sea Queen");
    render(<SharedShipBanner />);
    expect(screen.getByText(/a friend shared this ship/i)).toBeInTheDocument();
    expect(screen.getByText("Sea Queen")).toBeInTheDocument();
  });

  it("keeps a copy in My Ships and goes away", async () => {
    arriveByLink("Sea Queen");
    const user = userEvent.setup();
    render(<SharedShipBanner />);
    await user.click(screen.getByRole("button", { name: "Keep a copy" }));
    expect(listShips().map((s) => s.name)).toEqual(["Sea Queen"]);
    expect(useShipBuilderStore.getState().savedId).not.toBeNull();
    expect(screen.queryByText(/a friend shared/i)).not.toBeInTheDocument();
  });

  it("starts a new ship for Build your own", async () => {
    arriveByLink("Sea Queen");
    const user = userEvent.setup();
    render(<SharedShipBanner />);
    await user.click(screen.getByRole("button", { name: "Build your own" }));
    expect(useShipBuilderStore.getState().ship.name).not.toBe("Sea Queen");
    expect(screen.queryByText(/a friend shared/i)).not.toBeInTheDocument();
  });

  it("goes away when dismissed", async () => {
    arriveByLink("Sea Queen");
    const user = userEvent.setup();
    render(<SharedShipBanner />);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/a friend shared/i)).not.toBeInTheDocument();
  });
});
