import { act, render, screen } from "@testing-library/react";
import {
  publishEscape,
  resetEscape,
} from "@/lib/ship-builder/state/escapeLive";
import WarmthMeter from "../WarmthMeter";

function swim(warmth: number, since = 1) {
  publishEscape({
    phase: {
      kind: "swimming",
      since,
      swimmer: { x: 0, z: 0, yaw: 0, warmth, kick: 0 },
      warned: false,
    },
    boardable: null,
    pickup: null,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  act(() => resetEscape());
});
afterEach(() => jest.useRealTimers());

describe("WarmthMeter", () => {
  it("is hidden unless swimming", () => {
    render(<WarmthMeter />);
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("follows the swimmer's warmth in percent", () => {
    render(<WarmthMeter />);
    act(() => swim(0.8));
    const meter = screen.getByRole("meter", { name: "Warmth" });
    expect(meter.getAttribute("aria-valuenow")).toBe("80");
    act(() => {
      swim(0.4); // same phase: only the live copy changes
      jest.advanceTimersByTime(200);
    });
    expect(meter.getAttribute("aria-valuenow")).toBe("40");
  });
});
