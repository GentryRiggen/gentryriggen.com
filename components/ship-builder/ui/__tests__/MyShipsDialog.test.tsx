import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyShipsDialog from "../MyShipsDialog";
import { listShips, saveShip } from "@/lib/ship-builder/persist/local";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { testShip } from "@/lib/ship-builder/testing";

beforeEach(() => {
  localStorage.clear();
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("MyShipsDialog", () => {
  it("shows an empty state", () => {
    render(<MyShipsDialog onClose={jest.fn()} />);
    expect(screen.getByText(/No saved ships yet/)).toBeInTheDocument();
  });

  it("loads a saved ship and closes", async () => {
    const saved = saveShip({ ...testShip([], 10), name: "Olympic" }, null)!;
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<MyShipsDialog onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Load Olympic" }));
    expect(useShipBuilderStore.getState().ship.hull.lengthSegments).toBe(10);
    expect(useShipBuilderStore.getState().savedId).toBe(saved.id);
    expect(onClose).toHaveBeenCalled();
  });

  it("renames a saved ship", async () => {
    saveShip({ ...testShip(), name: "Olympic" }, null);
    const user = userEvent.setup();
    render(<MyShipsDialog onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: "Rename Olympic" }));
    const input = screen.getByLabelText("New name for Olympic");
    await user.clear(input);
    await user.type(input, "Britannic{Enter}");
    expect(listShips()[0].name).toBe("Britannic");
    expect(screen.getByText("Britannic")).toBeInTheDocument();
  });

  it("deletes only after confirming", async () => {
    saveShip({ ...testShip(), name: "Olympic" }, null);
    const user = userEvent.setup();
    render(<MyShipsDialog onClose={jest.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "My Ships" });
    await user.click(
      within(dialog).getByRole("button", { name: "Delete Olympic" })
    );
    expect(listShips()).toHaveLength(1);
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm delete Olympic" })
    );
    expect(listShips()).toHaveLength(0);
  });
});
