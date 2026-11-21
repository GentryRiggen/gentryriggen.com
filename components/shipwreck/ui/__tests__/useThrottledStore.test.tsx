import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { useThrottledStore } from "../useTimelineEnd";

describe("useThrottledStore", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("re-renders at most every 250 ms while the store changes each frame", () => {
    const store = createPlaybackStore();
    const seen: number[] = [];
    function Probe() {
      const v = useThrottledStore(store, (s) => s.computedT);
      useEffect(() => {
        seen.push(v);
      });
      return null;
    }
    render(<Probe />);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    const before = seen.length;
    // One simulated second at 60 frames.
    for (let i = 1; i <= 60; i += 1) {
      act(() => {
        store.setState({ computedT: i });
        jest.advanceTimersByTime(16);
      });
    }
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(seen.length - before).toBeLessThanOrEqual(6);
    expect(seen[seen.length - 1]).toBe(60);
  });
});
