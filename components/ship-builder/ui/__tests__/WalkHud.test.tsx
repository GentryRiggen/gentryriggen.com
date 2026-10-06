import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { testShip } from "@/lib/ship-builder/testing";
import { resetWalkInput, walkInput } from "@/lib/ship-builder/state/walkInput";
import WalkHud from "../WalkHud";

const store = () => useShipBuilderStore.getState();
const originalMatchMedia = window.matchMedia;

function mockReducedMotion(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function startWalking() {
  act(() => {
    store().loadShip(testShip(), null);
    store().startWalk();
  });
}

beforeEach(() => {
  resetWalkInput();
  act(() => useShipBuilderStore.setState(createInitialState()));
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  jest.useRealTimers();
});

describe("WalkHud", () => {
  it("shows only while walking", () => {
    render(<WalkHud />);
    expect(screen.queryByRole("button", { name: "Stop walking" })).toBeNull();
    expect(screen.queryByRole("group", { name: /walk joystick/i })).toBeNull();
    startWalking();
    expect(
      screen.getByRole("button", { name: "Stop walking" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /walk joystick/i })
    ).toBeInTheDocument();
  });

  it("stops the walk from the button", async () => {
    startWalking();
    render(<WalkHud />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Stop walking" }));
    expect(store().walk.status).toBe("idle");
  });

  it("keeps the overlay out of the way of the scene", () => {
    startWalking();
    const { container } = render(<WalkHud />);
    expect(container.firstChild).toHaveClass("pointer-events-none");
    expect(screen.getByRole("button", { name: "Stop walking" })).toHaveClass(
      "pointer-events-auto"
    );
  });

  it("asks for a jump when the jump button is pressed", () => {
    startWalking();
    render(<WalkHud />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Jump" }));
    expect(walkInput.jump).toBe(true);
  });

  it("walks with the keys while mounted", () => {
    startWalking();
    render(<WalkHud />);
    fireEvent.keyDown(window, { key: "w" });
    expect(walkInput.forward).toBe(1);
  });

  it("fades the hint after a few seconds", () => {
    jest.useFakeTimers();
    startWalking();
    render(<WalkHud />);
    const hint = screen.getByText(
      "Drag to look · stick to walk · jump to climb"
    );
    expect(hint).toHaveClass("opacity-100");
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(hint).toHaveClass("opacity-0");
  });

  it("fades the hint on first input", () => {
    startWalking();
    render(<WalkHud />);
    fireEvent.keyDown(window, { key: "w" });
    expect(
      screen.getByText("Drag to look · stick to walk · jump to climb")
    ).toHaveClass("opacity-0");
  });

  it("fades the hint on a first touch of the view", () => {
    startWalking();
    render(<WalkHud />);
    fireEvent.pointerDown(screen.getByTestId("walk-look-layer"));
    expect(
      screen.getByText("Drag to look · stick to walk · jump to climb")
    ).toHaveClass("opacity-0");
  });

  it("does not animate the hint under reduced motion", () => {
    mockReducedMotion(true);
    startWalking();
    render(<WalkHud />);
    expect(
      screen.getByText("Drag to look · stick to walk · jump to climb")
    ).not.toHaveClass("transition-opacity");
  });
});

describe("WalkHud Hit with an iceberg", () => {
  it("sinks the ship from walk mode, then goes away", async () => {
    const user = userEvent.setup();
    startWalking();
    render(<WalkHud />);
    await user.click(
      screen.getByRole("button", { name: "Hit with an iceberg" })
    );
    expect(store().trial).toMatchObject({ status: "running" });
    expect(store().walk.status).toBe("walking");
    expect(
      screen.queryByRole("button", { name: "Hit with an iceberg" })
    ).not.toBeInTheDocument();
  });
});
