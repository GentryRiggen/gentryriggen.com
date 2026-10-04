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

  it("changes the beam and disables the buttons at the limits", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    const wider = screen.getByRole("button", { name: "Wider" });
    const narrower = screen.getByRole("button", { name: "Narrower" });
    expect(screen.getByTestId("beam-width")).toHaveTextContent("4 wide");
    await user.click(wider);
    expect(screen.getByTestId("beam-width")).toHaveTextContent("5 wide");
    await user.click(wider);
    await user.click(wider);
    expect(screen.getByTestId("beam-width")).toHaveTextContent("7 wide");
    expect(wider).toBeDisabled();
    for (let i = 0; i < 4; i++) await user.click(narrower);
    expect(screen.getByTestId("beam-width")).toHaveTextContent("3 wide");
    expect(narrower).toBeDisabled();
    expect(wider).toBeEnabled();
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

  it("toggles paint mode with the Paint button", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    const paint = screen.getByRole("button", { name: "Paint" });
    expect(paint).toHaveAttribute("aria-pressed", "false");
    await user.click(paint);
    expect(store().tool.kind).toBe("paint");
    expect(paint).toHaveAttribute("aria-pressed", "true");
    await user.click(paint);
    expect(store().tool).toEqual({ kind: "none" });
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

  it("updates the same My Ships entry when saved twice", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    const save = screen.getByRole("button", { name: "Save" });
    await user.click(save);
    const savedId = store().savedId;
    await user.click(save);
    expect(listShips()).toHaveLength(1);
    expect(store().savedId).toBe(savedId);
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

  it("switches to the below view", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    const below = screen.getByRole("button", { name: "Below view" });
    expect(below).toHaveAttribute("aria-pressed", "false");
    await user.click(below);
    expect(store().camera.view).toBe("below");
    expect(below).toHaveAttribute("aria-pressed", "true");
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

  it("blurs the ship name input on Escape", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    const name = screen.getByLabelText("Ship name");
    await user.click(name);
    expect(name).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(name).not.toHaveFocus();
  });
});
