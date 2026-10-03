import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Toolbar from "../Toolbar";
import { listShips } from "@/lib/ship-builder/persist/local";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  localStorage.clear();
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("Toolbar", () => {
  it("changes hull length", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.click(screen.getByRole("button", { name: "Lengthen hull" }));
    expect(screen.getByTestId("hull-length")).toHaveTextContent("9 segments");
    await user.click(screen.getByRole("button", { name: "Shorten hull" }));
    expect(screen.getByTestId("hull-length")).toHaveTextContent("8 segments");
  });

  it("enables undo after a change and renames the ship", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Lengthen hull" }));
    expect(undo).toBeEnabled();
    const name = screen.getByLabelText("Ship name");
    await user.clear(name);
    await user.type(name, "Olympic");
    expect(store().ship.name).toBe("Olympic");
  });

  it("only enables rotate for grid tools and delete with a selection", () => {
    render(<Toolbar />);
    expect(screen.getByRole("button", { name: "Rotate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    act(() => store().selectTool("deck-2x1"));
    expect(screen.getByRole("button", { name: "Rotate" })).toBeEnabled();
  });

  it("saves to My Ships", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(listShips()).toHaveLength(1);
    expect(store().savedId).toBe(listShips()[0].id);
    expect(store().notice?.text).toBe("Saved to My Ships");
  });

  it("sets camera presets", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    const top = screen.getByRole("button", { name: "Top view" });
    const side = screen.getByRole("button", { name: "Side view" });
    expect(top).toHaveAttribute("aria-pressed", "false");
    await user.click(top);
    expect(store().camera.view).toBe("top");
    expect(top).toHaveAttribute("aria-pressed", "true");
    expect(side).toHaveAttribute("aria-pressed", "false");
  });

  it("returns focus to My Ships when the dialog closes", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    const myShips = screen.getByRole("button", { name: "My Ships" });
    await user.click(myShips);
    expect(
      screen.getByRole("dialog", { name: "My Ships" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(myShips).toHaveFocus();
  });
});
