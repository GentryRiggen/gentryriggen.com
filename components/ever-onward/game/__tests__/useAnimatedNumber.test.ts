import { act, renderHook } from "@testing-library/react";
import { useAnimatedNumber } from "../useAnimatedNumber";

function setReducedMotion(isReduced: boolean) {
  (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
    matches: isReduced && query.includes("reduce"),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
}

describe("useAnimatedNumber", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setReducedMotion(false);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts at the target", () => {
    const { result } = renderHook(() => useAnimatedNumber(40));
    expect(result.current).toBe(40);
  });

  it("eases toward a new target and lands exactly on it", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useAnimatedNumber(value),
      { initialProps: { value: 0 } }
    );
    rerender({ value: 100 });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe(100);
  });

  it("retargets from where it is, not from the old start", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useAnimatedNumber(value),
      { initialProps: { value: 0 } }
    );
    rerender({ value: 100 });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    const midway = result.current;
    rerender({ value: 0 });
    act(() => {
      jest.advanceTimersByTime(40);
    });
    expect(result.current).toBeLessThan(midway);
    expect(result.current).toBeGreaterThan(0);
  });

  it("jumps straight to the target with reduced motion", () => {
    setReducedMotion(true);
    const { result, rerender } = renderHook(
      ({ value }) => useAnimatedNumber(value),
      { initialProps: { value: 0 } }
    );
    rerender({ value: 500 });
    expect(result.current).toBe(500);
  });
});
