import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { resetWalkInput, walkInput } from "@/lib/ship-builder/state/walkInput";
import WalkJoystick from "../WalkJoystick";
import WalkLookLayer from "../WalkLookLayer";

/** jsdom's pointer events drop coordinates, so set them explicitly. */
function pointer(
  type: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel",
  element: Element,
  x: number,
  y: number
) {
  const event = createEvent[type](element, { pointerId: 1 });
  Object.defineProperty(event, "clientX", { value: x });
  Object.defineProperty(event, "clientY", { value: y });
  fireEvent(element, event);
}

function mockBox(element: Element) {
  element.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 128, height: 128 }) as DOMRect;
}

beforeEach(() => resetWalkInput());

describe("WalkJoystick", () => {
  function setup() {
    render(<WalkJoystick />);
    const stick = screen.getByRole("group", { name: /walk joystick/i });
    mockBox(stick);
    return stick;
  }

  it("walks forward when dragged up and back when dragged down", () => {
    const stick = setup();
    pointer("pointerDown", stick, 64, 64);
    pointer("pointerMove", stick, 64, 0); // far up
    expect(walkInput.forward).toBeCloseTo(1);
    expect(walkInput.strafe).toBeCloseTo(0);
    pointer("pointerMove", stick, 64, 128);
    expect(walkInput.forward).toBeCloseTo(-1);
  });

  it("strafes right when dragged right and left when dragged left", () => {
    const stick = setup();
    pointer("pointerDown", stick, 64, 64);
    pointer("pointerMove", stick, 128, 64);
    expect(walkInput.strafe).toBeCloseTo(1);
    pointer("pointerMove", stick, 0, 64);
    expect(walkInput.strafe).toBeCloseTo(-1);
  });

  it("clamps to a circle so a diagonal is no faster", () => {
    const stick = setup();
    pointer("pointerDown", stick, 64, 64);
    pointer("pointerMove", stick, 128, 0);
    expect(Math.hypot(walkInput.forward, walkInput.strafe)).toBeCloseTo(1);
  });

  it("ignores tiny movements inside the dead zone", () => {
    const stick = setup();
    pointer("pointerDown", stick, 64, 64);
    pointer("pointerMove", stick, 64, 62);
    expect(walkInput.forward).toBe(0);
    expect(walkInput.strafe).toBe(0);
  });

  it("reads half-way as less than full speed", () => {
    const stick = setup();
    pointer("pointerDown", stick, 64, 64);
    pointer("pointerMove", stick, 64, 46); // half of the 36px travel
    expect(walkInput.forward).toBeGreaterThan(0.2);
    expect(walkInput.forward).toBeLessThan(0.8);
  });

  it("returns to centre on release and on cancel", () => {
    const stick = setup();
    pointer("pointerDown", stick, 64, 64);
    pointer("pointerMove", stick, 64, 0);
    pointer("pointerUp", stick, 64, 0);
    expect(walkInput.forward).toBe(0);
    pointer("pointerDown", stick, 64, 64);
    pointer("pointerMove", stick, 128, 64);
    pointer("pointerCancel", stick, 128, 64);
    expect(walkInput.strafe).toBe(0);
  });
});

describe("WalkLookLayer", () => {
  function setup() {
    render(<WalkLookLayer />);
    return screen.getByTestId("walk-look-layer");
  }

  it("turns right when dragged right and left when dragged left", () => {
    const layer = setup();
    pointer("pointerDown", layer, 200, 100);
    pointer("pointerMove", layer, 230, 100);
    expect(walkInput.turn).toBeGreaterThan(0);
    pointer("pointerMove", layer, 170, 100);
    expect(walkInput.turn).toBeLessThan(0);
  });

  it("clamps the turn to full speed", () => {
    const layer = setup();
    pointer("pointerDown", layer, 200, 100);
    pointer("pointerMove", layer, 900, 100);
    expect(walkInput.turn).toBe(1);
  });

  it("stops turning on release", () => {
    const layer = setup();
    pointer("pointerDown", layer, 200, 100);
    pointer("pointerMove", layer, 260, 100);
    pointer("pointerUp", layer, 260, 100);
    expect(walkInput.turn).toBe(0);
  });

  it("does not move the walk axes", () => {
    const layer = setup();
    pointer("pointerDown", layer, 200, 100);
    pointer("pointerMove", layer, 260, 20);
    expect(walkInput.forward).toBe(0);
    expect(walkInput.strafe).toBe(0);
  });
});
