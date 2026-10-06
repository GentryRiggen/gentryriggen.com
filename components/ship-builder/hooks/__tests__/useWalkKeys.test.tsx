import { act, fireEvent, render } from "@testing-library/react";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { resetWalkInput, walkInput } from "@/lib/ship-builder/state/walkInput";
import useKeyboardShortcuts from "../useKeyboardShortcuts";
import useWalkKeys from "../useWalkKeys";

function Harness() {
  useWalkKeys();
  useKeyboardShortcuts();
  return <input aria-label="Ship name" />;
}

const store = () => useShipBuilderStore.getState();

function startWalking() {
  act(() => store().startWalk());
}

beforeEach(() => {
  resetWalkInput();
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("useWalkKeys", () => {
  it("walks forward and back with W/S and the up/down arrows", () => {
    render(<Harness />);
    startWalking();
    fireEvent.keyDown(window, { key: "w" });
    expect(walkInput.forward).toBe(1);
    fireEvent.keyUp(window, { key: "w" });
    expect(walkInput.forward).toBe(0);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(walkInput.forward).toBe(-1);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(walkInput.forward).toBe(0);
    fireEvent.keyUp(window, { key: "ArrowDown" });
    expect(walkInput.forward).toBe(1);
  });

  it("strafes with A/D", () => {
    render(<Harness />);
    startWalking();
    fireEvent.keyDown(window, { key: "d" });
    expect(walkInput.strafe).toBe(1);
    fireEvent.keyUp(window, { key: "d" });
    fireEvent.keyDown(window, { key: "a" });
    expect(walkInput.strafe).toBe(-1);
    fireEvent.keyUp(window, { key: "a" });
    expect(walkInput.strafe).toBe(0);
  });

  it("turns with the left/right arrows and Q/E", () => {
    render(<Harness />);
    startWalking();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(walkInput.turn).toBe(1);
    fireEvent.keyUp(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "q" });
    expect(walkInput.turn).toBe(-1);
    fireEvent.keyUp(window, { key: "q" });
    fireEvent.keyDown(window, { key: "e" });
    expect(walkInput.turn).toBe(1);
    fireEvent.keyUp(window, { key: "e" });
    expect(walkInput.turn).toBe(0);
    expect(walkInput.strafe).toBe(0);
  });

  it("does nothing unless walking", () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: "w" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(walkInput).toEqual({ forward: 0, strafe: 0, turn: 0 });
  });

  it("leaves keys to a text field", () => {
    const { getByLabelText } = render(<Harness />);
    startWalking();
    fireEvent.keyDown(getByLabelText("Ship name"), { key: "w" });
    expect(walkInput.forward).toBe(0);
  });

  it("prevents the page scrolling on arrows", () => {
    render(<Harness />);
    startWalking();
    expect(fireEvent.keyDown(window, { key: "ArrowDown" })).toBe(false);
  });

  it("leaves Escape to the shortcuts hook, which stops walking", () => {
    render(<Harness />);
    startWalking();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(store().walk.status).toBe("idle");
  });

  it("stops when the window loses focus", () => {
    render(<Harness />);
    startWalking();
    fireEvent.keyDown(window, { key: "w" });
    fireEvent.blur(window);
    expect(walkInput.forward).toBe(0);
  });

  it("resets the input when it unmounts", () => {
    const { unmount } = render(<Harness />);
    startWalking();
    fireEvent.keyDown(window, { key: "w" });
    unmount();
    expect(walkInput.forward).toBe(0);
  });
});
