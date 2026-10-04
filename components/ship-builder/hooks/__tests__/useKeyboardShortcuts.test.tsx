import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import useKeyboardShortcuts from "../useKeyboardShortcuts";
import MyShipsDialog from "../../ui/MyShipsDialog";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { gridPart, testShip } from "@/lib/ship-builder/testing";

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

  it("ignores shortcuts while a modal dialog is open", () => {
    const { rerender } = render(
      <>
        <Harness />
        <MyShipsDialog onClose={jest.fn()} />
      </>
    );
    act(() => {
      store().selectTool("deck-1x1");
      store().placeAt({ kind: "grid", level: 0, x: 0, z: 0 });
      store().cancel();
      store().select(store().ship.parts[0].id);
    });
    const parts = store().ship.parts;
    fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), {
      key: "Backspace",
    });
    fireEvent.keyDown(window, { key: "Delete" });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(store().ship.parts).toBe(parts);

    rerender(<Harness />);
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(store().ship.parts).toHaveLength(0);
  });

  it("ignores keys typed into inputs", () => {
    render(<Harness />);
    act(() => store().selectTool("deck-2x1"));
    fireEvent.keyDown(screen.getByLabelText("Ship name"), { key: "r" });
    expect(store().tool).toMatchObject({ rotation: 0 });
  });

  it("deletes the selection with the Delete key", () => {
    render(<Harness />);
    act(() => {
      store().selectTool("deck-1x1");
      store().placeAt({ kind: "grid", level: 0, x: 0, z: 0 });
      store().cancel();
      store().select(store().ship.parts[0].id);
    });
    fireEvent.keyDown(window, { key: "Delete" });
    expect(store().ship.parts).toHaveLength(0);
  });

  it("cancels a pending removal with Escape and keeps the tool", () => {
    render(<Harness />);
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([
          gridPart("a", "deck-1x1", 0, 2, 1),
          gridPart("b", "deck-1x1", 1, 2, 1),
        ]),
        selectedId: "a",
        tool: { kind: "place", type: "deck-2x1", rotation: 0 },
        pendingRemoval: { kind: "part", ids: ["a", "b"] },
      })
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(store().pendingRemoval).toBeNull();
    expect(store().tool).toMatchObject({ kind: "place", type: "deck-2x1" });
    expect(store().ship.parts).toHaveLength(2);
  });

  it("does not rotate on Ctrl+R or Alt+R", () => {
    render(<Harness />);
    act(() => store().selectTool("deck-2x1"));
    fireEvent.keyDown(window, { key: "r", ctrlKey: true });
    fireEvent.keyDown(window, { key: "r", altKey: true });
    expect(store().tool).toMatchObject({ rotation: 0 });
  });
});

describe("Escape during a sea trial", () => {
  it("ends the trial and focuses the Sea trial button", () => {
    const raf = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        cb(0);
        return 0;
      });
    render(
      <>
        <Harness />
        <button id="sea-trial-button">Sea trial</button>
      </>
    );
    act(() => store().startTrial("calm"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(store().trial.status).toBe("idle");
    expect(document.activeElement?.id).toBe("sea-trial-button");
    raf.mockRestore();
  });
});
