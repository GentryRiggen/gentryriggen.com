import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import useKeyboardShortcuts from "../useKeyboardShortcuts";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

function Harness() {
  useKeyboardShortcuts();
  return <input aria-label="Ship name" />;
}

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("useKeyboardShortcuts", () => {
  it("rotates with R and cancels with Escape", () => {
    render(<Harness />);
    act(() => store().selectTool("deck-2x1"));
    fireEvent.keyDown(window, { key: "r" });
    expect(store().tool).toMatchObject({ rotation: 90 });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(store().tool).toEqual({ kind: "none" });
  });

  it("undoes and redoes with Ctrl/Cmd+Z", () => {
    render(<Harness />);
    act(() => {
      store().selectTool("deck-1x1");
      store().placeAt({ kind: "grid", level: 0, x: 0, z: 0 });
    });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(store().ship.parts).toHaveLength(0);
    fireEvent.keyDown(window, { key: "Z", metaKey: true, shiftKey: true });
    expect(store().ship.parts).toHaveLength(1);
  });

  it("deletes the selection with Delete or Backspace", () => {
    render(<Harness />);
    act(() => {
      store().selectTool("deck-1x1");
      store().placeAt({ kind: "grid", level: 0, x: 0, z: 0 });
      store().cancel();
      store().select(store().ship.parts[0].id);
    });
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(store().ship.parts).toHaveLength(0);
  });

  it("ignores keys typed into inputs", () => {
    render(<Harness />);
    act(() => store().selectTool("deck-2x1"));
    fireEvent.keyDown(screen.getByLabelText("Ship name"), { key: "r" });
    expect(store().tool).toMatchObject({ rotation: 0 });
  });
});
