import { act, fireEvent, render } from "@testing-library/react";
import { resetSailInput, sailInput } from "@/lib/ship-builder/state/sailInput";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import useDriveKeys from "../useDriveKeys";
import useKeyboardShortcuts from "../useKeyboardShortcuts";

function Harness() {
  useDriveKeys();
  useKeyboardShortcuts();
  return <input aria-label="Ship name" />;
}

const store = () => useShipBuilderStore.getState();

function startSailing() {
  act(() => {
    store().openDrive();
    store().startDrive({ seed: 1, kinds: ["buoy"], density: "some" });
  });
}

beforeEach(() => {
  resetSailInput();
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("useDriveKeys", () => {
  it("steers while an arrow or A/D is held and centres on release", () => {
    render(<Harness />);
    startSailing();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(sailInput.rudder).toBe(-1);
    fireEvent.keyUp(window, { key: "ArrowLeft" });
    expect(sailInput.rudder).toBe(0);
    fireEvent.keyDown(window, { key: "d" });
    expect(sailInput.rudder).toBe(1);
    fireEvent.keyDown(window, { key: "a" });
    expect(sailInput.rudder).toBe(0);
    fireEvent.keyUp(window, { key: "a" });
    expect(sailInput.rudder).toBe(1);
    fireEvent.keyUp(window, { key: "d" });
    expect(sailInput.rudder).toBe(0);
  });

  it("steps the throttle through stop and Space stops", () => {
    render(<Harness />);
    startSailing();
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(sailInput.throttle).toBe(0.25);
    fireEvent.keyDown(window, { key: "w" });
    expect(sailInput.throttle).toBe(0.5);
    fireEvent.keyDown(window, { key: " " });
    expect(sailInput.throttle).toBe(0);
    fireEvent.keyDown(window, { key: "s" });
    expect(sailInput.throttle).toBe(-0.3);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(sailInput.throttle).toBe(-0.3);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(sailInput.throttle).toBe(0);
  });

  it("does nothing unless sailing", () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(sailInput).toEqual({ throttle: 0, rudder: 0 });
  });

  it("leaves keys to a text field", () => {
    const { getByLabelText } = render(<Harness />);
    startSailing();
    fireEvent.keyDown(getByLabelText("Ship name"), { key: "w" });
    expect(sailInput.throttle).toBe(0);
  });

  it("prevents the page scrolling on arrows", () => {
    render(<Harness />);
    startSailing();
    const notPrevented = fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(notPrevented).toBe(false);
  });

  it("leaves Escape to the shortcuts hook, which ends the drive", () => {
    render(<Harness />);
    startSailing();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(store().drive.status).toBe("idle");
  });

  it("centres the controls when it unmounts", () => {
    const { unmount } = render(<Harness />);
    startSailing();
    fireEvent.keyDown(window, { key: "ArrowUp" });
    unmount();
    expect(sailInput.throttle).toBe(0);
  });
});
