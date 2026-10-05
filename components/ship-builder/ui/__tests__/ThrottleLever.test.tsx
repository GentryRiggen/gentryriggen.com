import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { resetSailInput, sailInput } from "@/lib/ship-builder/state/sailInput";
import ThrottleLever from "../ThrottleLever";

function pointer(
  type: "pointerDown" | "pointerMove",
  element: Element,
  y: number
) {
  const event = createEvent[type](element, { pointerId: 1 });
  Object.defineProperty(event, "clientY", { value: y });
  fireEvent(element, event);
}

function mockTrack(element: Element) {
  // 130px tall: 100px of ahead above stop and 30px of reverse below it.
  element.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 56, height: 130 }) as DOMRect;
}

beforeEach(() => resetSailInput());

describe("ThrottleLever", () => {
  it("maps the drag position to throttle from full ahead to reverse", () => {
    render(<ThrottleLever kind="liner" />);
    const lever = screen.getByRole("slider");
    mockTrack(lever);
    pointer("pointerDown", lever, 0);
    expect(sailInput.throttle).toBe(1);
    pointer("pointerMove", lever, 50);
    expect(sailInput.throttle).toBeCloseTo(0.5);
    pointer("pointerMove", lever, 130);
    expect(sailInput.throttle).toBeCloseTo(-0.3);
    pointer("pointerMove", lever, 500);
    expect(sailInput.throttle).toBeCloseTo(-0.3);
  });

  it("clicks into the stop detent", () => {
    render(<ThrottleLever kind="cargo" />);
    const lever = screen.getByRole("slider");
    mockTrack(lever);
    pointer("pointerDown", lever, 98); // a hair above stop
    expect(sailInput.throttle).toBe(0);
  });

  it("is a keyboard-operable slider", () => {
    render(<ThrottleLever kind="navy" />);
    const lever = screen.getByRole("slider");
    fireEvent.keyDown(lever, { key: "ArrowUp" });
    expect(sailInput.throttle).toBeCloseTo(0.1);
    expect(lever).toHaveAttribute("aria-valuenow", "10");
    fireEvent.keyDown(lever, { key: "ArrowDown" });
    expect(sailInput.throttle).toBe(0);
    expect(lever).toHaveAttribute("aria-valuetext", "Stop");
    fireEvent.keyDown(lever, { key: "ArrowDown" });
    expect(sailInput.throttle).toBeCloseTo(-0.1);
    fireEvent.keyDown(lever, { key: "Home" });
    expect(sailInput.throttle).toBe(1);
    fireEvent.keyDown(lever, { key: "End" });
    expect(sailInput.throttle).toBeCloseTo(-0.3);
  });

  it("has a hit area at least 44px wide and blocks touch scrolling", () => {
    render(<ThrottleLever kind="cruise" />);
    const lever = screen.getByRole("slider");
    expect(lever.className).toContain("w-14");
    expect(lever.className).toContain("touch-none");
  });
});
