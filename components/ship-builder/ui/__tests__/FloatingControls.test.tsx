import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HelpButton, { resetCoachForTests } from "../HelpButton";
import PlacementHint from "../PlacementHint";
import SelectionBar from "../SelectionBar";
import UndoRedo from "../UndoRedo";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { gridPart, testShip } from "@/lib/ship-builder/testing";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  localStorage.clear();
  resetCoachForTests();
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("UndoRedo", () => {
  it("enables undo after a change and redo after undoing it", async () => {
    const user = userEvent.setup();
    render(<UndoRedo />);
    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();
    act(() => store().changeHullLength(1));
    expect(undo).toBeEnabled();
    await user.click(undo);
    expect(redo).toBeEnabled();
    await user.click(redo);
    expect(store().ship.hull.lengthSegments).toBe(9);
  });
});

describe("SelectionBar", () => {
  it("shows Delete only while a part is selected", async () => {
    const user = userEvent.setup();
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([gridPart("a", "deck-1x1", 0, 2, 1)]),
      })
    );
    render(<SelectionBar />);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    act(() => useShipBuilderStore.setState({ selectedId: "a" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(store().ship.parts).toHaveLength(0);
  });
});

describe("PlacementHint controls", () => {
  it("offers Rotate only while placing a grid part", async () => {
    const user = userEvent.setup();
    render(<PlacementHint />);
    expect(screen.queryByRole("button", { name: "Rotate" })).toBeNull();
    act(() => store().selectTool("deck-2x1"));
    await user.click(screen.getByRole("button", { name: "Rotate" }));
    const tool = store().tool;
    expect(tool.kind === "place" && tool.rotation).toBe(90);
  });

  it("shows paint mode with Colours and Done", async () => {
    const user = userEvent.setup();
    const onOpenColours = jest.fn();
    render(<PlacementHint onOpenColours={onOpenColours} />);
    act(() => store().selectPaint("red"));
    expect(screen.getByText(/Painting/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Colours" }));
    expect(onOpenColours).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(store().tool).toEqual({ kind: "none" });
  });
});

describe("HelpButton", () => {
  it("opens and closes the gesture list", async () => {
    const user = userEvent.setup();
    render(<HelpButton />);
    const help = screen.getByRole("button", { name: "Help" });
    expect(help).toHaveAttribute("aria-expanded", "false");
    await user.click(help);
    expect(screen.getByRole("dialog", { name: "How to build" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(help).toHaveFocus();
  });

  it("shows the first-run tip once and remembers Got it", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<HelpButton />);
    expect(screen.getByText(/Pick a part on the left/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText(/Pick a part on the left/)).toBeNull();
    expect(localStorage.getItem("ship-builder:ui:coach-seen")).toBe("1");
    unmount();
    render(<HelpButton />);
    expect(screen.queryByText(/Pick a part on the left/)).toBeNull();
  });

  it("dismisses the tip when the help popover opens", async () => {
    const user = userEvent.setup();
    render(<HelpButton />);
    expect(screen.getByRole("note")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.queryByRole("note")).toBeNull();
    expect(localStorage.getItem("ship-builder:ui:coach-seen")).toBe("1");
  });

  it("closes on Escape even when focus is elsewhere, and links aria-controls only while open", async () => {
    const user = userEvent.setup();
    render(<HelpButton />);
    const help = screen.getByRole("button", { name: "Help" });
    expect(help).not.toHaveAttribute("aria-controls");
    await user.click(help);
    expect(help).toHaveAttribute("aria-controls");
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(help).not.toHaveAttribute("aria-controls");
  });

  it("drops the tip once a part is picked", () => {
    render(<HelpButton />);
    act(() => store().selectTool("deck-1x1"));
    expect(screen.queryByText(/Pick a part on the left/)).toBeNull();
  });

  it("still works when storage throws", async () => {
    const user = userEvent.setup();
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    render(<HelpButton />);
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText(/Pick a part on the left/)).toBeNull();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe("SelectionBar and PlacementHint", () => {
  it("never show together: selecting a part drops the active tool", () => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([gridPart("a", "deck-1x1", 0, 2, 1)]),
      })
    );
    render(
      <>
        <PlacementHint />
        <SelectionBar />
      </>
    );
    act(() => store().selectTool("deck-1x1"));
    act(() => store().select("a"));
    expect(store().tool.kind).toBe("none");
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("hides the bar while a tool is active even if a part is selected", () => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([gridPart("a", "deck-1x1", 0, 2, 1)]),
        selectedId: "a",
      })
    );
    render(<SelectionBar />);
    act(() => store().selectTool("deck-1x1"));
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });
});
