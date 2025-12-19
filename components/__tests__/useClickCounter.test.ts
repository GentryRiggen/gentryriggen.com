import { renderHook, act } from "@testing-library/react";
import { useClickCounter } from "../hooks/useClickCounter";

describe("useClickCounter", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("returns handleClick function and isBouncing state", () => {
    const onThresholdReached = jest.fn();
    const { result } = renderHook(() =>
      useClickCounter(onThresholdReached, false)
    );

    expect(result.current.handleClick).toBeDefined();
    expect(typeof result.current.handleClick).toBe("function");
    expect(typeof result.current.isBouncing).toBe("boolean");
    expect(result.current.isBouncing).toBe(false);
  });

  it("sets isBouncing to true when clicked", () => {
    const onThresholdReached = jest.fn();
    const { result } = renderHook(() =>
      useClickCounter(onThresholdReached, false)
    );

    act(() => {
      result.current.handleClick();
    });

    expect(result.current.isBouncing).toBe(true);
  });

  it("resets isBouncing after animation duration", () => {
    const onThresholdReached = jest.fn();
    const { result } = renderHook(() =>
      useClickCounter(onThresholdReached, false)
    );

    act(() => {
      result.current.handleClick();
    });

    expect(result.current.isBouncing).toBe(true);

    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(result.current.isBouncing).toBe(false);
  });

  it("calls onThresholdReached after 3 clicks", () => {
    const onThresholdReached = jest.fn();
    const { result } = renderHook(() =>
      useClickCounter(onThresholdReached, false)
    );

    act(() => {
      result.current.handleClick();
      result.current.handleClick();
      result.current.handleClick();
    });

    expect(onThresholdReached).toHaveBeenCalledTimes(1);
  });

  it("resets click count after timeout", () => {
    const onThresholdReached = jest.fn();
    const { result } = renderHook(() =>
      useClickCounter(onThresholdReached, false)
    );

    act(() => {
      result.current.handleClick();
      result.current.handleClick();
    });

    // Wait for timeout (1000ms)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Click once more - should not trigger threshold
    act(() => {
      result.current.handleClick();
    });

    expect(onThresholdReached).not.toHaveBeenCalled();
  });

  it("does not count clicks during cooldown", () => {
    const onThresholdReached = jest.fn();
    const { result } = renderHook(() =>
      useClickCounter(onThresholdReached, true)
    );

    act(() => {
      result.current.handleClick();
      result.current.handleClick();
      result.current.handleClick();
    });

    // Should not trigger threshold because clicks are ignored during cooldown
    expect(onThresholdReached).not.toHaveBeenCalled();
  });

  it("shows shake animation during cooldown", () => {
    const onThresholdReached = jest.fn();
    const { result } = renderHook(() =>
      useClickCounter(onThresholdReached, true)
    );

    act(() => {
      result.current.handleClick();
    });

    expect(result.current.isBouncing).toBe(true);

    // Shake animation duration is 500ms during cooldown
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isBouncing).toBe(false);
  });

  it("resets click count when threshold is reached", () => {
    const onThresholdReached = jest.fn();
    const { result } = renderHook(() =>
      useClickCounter(onThresholdReached, false)
    );

    act(() => {
      result.current.handleClick();
      result.current.handleClick();
      result.current.handleClick();
    });

    expect(onThresholdReached).toHaveBeenCalledTimes(1);

    // Click count should be reset, so next click should not trigger
    act(() => {
      result.current.handleClick();
    });

    expect(onThresholdReached).toHaveBeenCalledTimes(1);
  });

  it("clears previous timeout when clicked again", () => {
    const onThresholdReached = jest.fn();
    const { result } = renderHook(() =>
      useClickCounter(onThresholdReached, false)
    );

    act(() => {
      result.current.handleClick();
    });

    // Click again before timeout
    act(() => {
      jest.advanceTimersByTime(500);
      result.current.handleClick();
    });

    // Fast-forward to original timeout
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Click count should still be 2 (timeout was reset)
    act(() => {
      result.current.handleClick();
    });

    expect(onThresholdReached).toHaveBeenCalledTimes(1);
  });
});
