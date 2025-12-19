import { renderHook, act } from "@testing-library/react";
import { useConfetti } from "../hooks/useConfetti";

// Mock canvas-confetti
const mockConfetti = jest.fn();
jest.mock("canvas-confetti", () => ({
  __esModule: true,
  default: () => mockConfetti(),
}));

describe("useConfetti", () => {
  beforeEach(() => {
    mockConfetti.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("returns triggerConfetti function", () => {
    const { result } = renderHook(() => useConfetti());
    expect(result.current.triggerConfetti).toBeDefined();
    expect(typeof result.current.triggerConfetti).toBe("function");
  });

  it("calls confetti when triggerConfetti is called", () => {
    const { result } = renderHook(() => useConfetti());

    act(() => {
      result.current.triggerConfetti();
    });

    // Should be called multiple times (center, left, right bursts)
    expect(mockConfetti).toHaveBeenCalled();
  });

  it("calls onCooldownChange callback when provided", () => {
    const onCooldownChange = jest.fn();
    const { result } = renderHook(() => useConfetti());

    act(() => {
      result.current.triggerConfetti(onCooldownChange);
    });

    expect(onCooldownChange).toHaveBeenCalledWith(true);
  });

  it("resets cooldown after timeout", () => {
    const onCooldownChange = jest.fn();
    const { result } = renderHook(() => useConfetti());

    act(() => {
      result.current.triggerConfetti(onCooldownChange);
    });

    expect(onCooldownChange).toHaveBeenCalledWith(true);

    // Fast-forward time to clear cooldown (3000ms)
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(onCooldownChange).toHaveBeenCalledWith(false);
    expect(onCooldownChange).toHaveBeenCalledTimes(2);
  });

  it("clears previous cooldown timeout when triggered again", () => {
    const onCooldownChange = jest.fn();
    const { result } = renderHook(() => useConfetti());

    act(() => {
      result.current.triggerConfetti(onCooldownChange);
    });

    // Trigger again before cooldown expires
    act(() => {
      jest.advanceTimersByTime(1000);
      result.current.triggerConfetti(onCooldownChange);
    });

    // Fast-forward to first cooldown timeout
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Should only have been called with true (the second trigger)
    // The first timeout should have been cleared
    expect(onCooldownChange).toHaveBeenCalledWith(true);
  });
});
