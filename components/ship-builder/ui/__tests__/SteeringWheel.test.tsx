import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { SHIP_KINDS } from "@/lib/ship-builder/model/kinds";
import { resetSailInput, sailInput } from "@/lib/ship-builder/state/sailInput";
import SteeringWheel from "../SteeringWheel";
import { controlsForKind } from "../controlsForKind";

/** jsdom's pointer events drop coordinates, so set them explicitly. */
function pointer(
  type: "pointerDown" | "pointerMove" | "pointerUp",
  element: Element,
  x: number,
  y: number
) {
  const event = createEvent[type](element, { pointerId: 1 });
  Object.defineProperty(event, "clientX", { value: x });
  Object.defineProperty(event, "clientY", { value: y });
  fireEvent(element, event);
}

function mockCentre(element: Element) {
  element.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
}

const originalMatchMedia = window.matchMedia;

beforeEach(() => resetSailInput());
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("SteeringWheel", () => {
  it("turns the rudder by the angle dragged, 270 degrees lock to lock", () => {
    render(<SteeringWheel kind="liner" />);
    const wheel = screen.getByRole("img");
    mockCentre(wheel);
    pointer("pointerDown", wheel, 50, 0); // straight up
    pointer("pointerMove", wheel, 100, 50); // 90 degrees clockwise
    expect(sailInput.rudder).toBeCloseTo(90 / 135);
    pointer("pointerMove", wheel, 50, 100); // 180 degrees: past the lock
    expect(sailInput.rudder).toBe(1);
    pointer("pointerMove", wheel, 0, 50); // 90 degrees anticlockwise
    expect(sailInput.rudder).toBeCloseTo(-90 / 135);
  });

  it("springs back to centre on release", () => {
    jest.useFakeTimers();
    try {
      render(<SteeringWheel kind="navy" />);
      const wheel = screen.getByRole("img");
      mockCentre(wheel);
      pointer("pointerDown", wheel, 50, 0);
      pointer("pointerMove", wheel, 100, 50);
      expect(sailInput.rudder).not.toBe(0);
      pointer("pointerUp", wheel, 100, 50);
      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(sailInput.rudder).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it("snaps back at once when motion is reduced", () => {
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as never;
    render(<SteeringWheel kind="cargo" />);
    const wheel = screen.getByRole("img");
    mockCentre(wheel);
    pointer("pointerDown", wheel, 50, 0);
    pointer("pointerMove", wheel, 100, 50);
    pointer("pointerUp", wheel, 100, 50);
    expect(sailInput.rudder).toBe(0);
  });

  it("blocks touch scrolling so a drag steers", () => {
    render(<SteeringWheel kind="cruise" />);
    expect(screen.getByRole("img").className).toContain("touch-none");
  });

  it.each(SHIP_KINDS)("renders the %s wheel", (kind) => {
    render(<SteeringWheel kind={kind} />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "data-variant",
      controlsForKind[kind].wheelStyle.variant
    );
  });
});
