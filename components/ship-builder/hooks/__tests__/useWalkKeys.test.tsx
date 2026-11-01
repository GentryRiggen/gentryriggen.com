import { act, fireEvent, render } from "@testing-library/react";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { resetWalkInput, walkInput } from "@/lib/ship-builder/state/walkInput";
import { takeEscapeRequest } from "@/lib/ship-builder/state/escapeActions";
import {
  publishEscape,
  resetEscape,
} from "@/lib/ship-builder/state/escapeLive";
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

const boatInReach = () =>
  act(() =>
    publishEscape({
      phase: { kind: "aboard" },
      boardable: { boatId: "b", kind: "davit" },
      pickup: null,
    })
  );

beforeEach(() => {
  act(() => resetEscape());
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

  it("asks for a jump with Space, but not outside a walk", () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: " " });
    expect(walkInput.jump).toBe(false);
    startWalking();
    fireEvent.keyDown(window, { key: " " });
    expect(walkInput.jump).toBe(true);
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

  it("boards with a fresh E press when a boat is in reach", () => {
    render(<Harness />);
    startWalking();
    boatInReach();
    fireEvent.keyDown(window, { key: "e" });
    expect(takeEscapeRequest()).toBe("board");
    expect(walkInput.turn).toBe(0);
  });

  it("never boards from an auto-repeated E", () => {
    render(<Harness />);
    startWalking();
    boatInReach();
    fireEvent.keyDown(window, { key: "e", repeat: true });
    expect(takeEscapeRequest()).toBeNull();
  });

  it("keeps turning, not boarding, while E is held past a boat", () => {
    render(<Harness />);
    startWalking();
    fireEvent.keyDown(window, { key: "e" });
    expect(walkInput.turn).toBe(1);
    boatInReach();
    fireEvent.keyDown(window, { key: "e", repeat: true });
    fireEvent.keyDown(window, { key: "e" });
    expect(takeEscapeRequest()).toBeNull();
    expect(walkInput.turn).toBe(1);
    // Let go and press again: now it boards.
    fireEvent.keyUp(window, { key: "e" });
    fireEvent.keyDown(window, { key: "e" });
    expect(takeEscapeRequest()).toBe("board");
  });

  it("does nothing unless walking", () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: "w" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(walkInput).toEqual({ forward: 0, strafe: 0, turn: 0, jump: false });
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
