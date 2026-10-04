import { act } from "react";
import { renderHook } from "@testing-library/react";
import { createTrial } from "@/lib/ship-builder/sim/seaTrial";
import type { SimState, TrialInput } from "@/lib/ship-builder/sim/types";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import {
  clearLiveTrial,
  getLiveTrialState,
  LIVE_TRIAL_INTERVAL_MS,
  publishLiveTrial,
  useLiveTrialState,
} from "../liveTrial";

const INPUT: TrialInput = {
  ship: { stabilityRatio: 0, listAngle: 0, beam: 5 },
  sea: "calm",
};

function stateAt(time: number): SimState {
  return { ...createTrial(INPUT), time };
}

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
  act(() => clearLiveTrial());
});

describe("liveTrial store", () => {
  it("starts empty and publishes the first state at once", () => {
    expect(getLiveTrialState()).toBeNull();
    const first = stateAt(0);
    act(() => publishLiveTrial(first, 1000));
    expect(getLiveTrialState()).toBe(first);
  });

  it("throttles to the interval and lets a forced publish through", () => {
    act(() => publishLiveTrial(stateAt(0), 1000));
    const quick = stateAt(0.02);
    act(() => publishLiveTrial(quick, 1000 + LIVE_TRIAL_INTERVAL_MS - 1));
    expect(getLiveTrialState()?.time).toBe(0);

    act(() => publishLiveTrial(quick, 1000 + LIVE_TRIAL_INTERVAL_MS));
    expect(getLiveTrialState()).toBe(quick);

    const last = stateAt(9);
    act(() => publishLiveTrial(last, 1000 + LIVE_TRIAL_INTERVAL_MS + 1, true));
    expect(getLiveTrialState()).toBe(last);
  });

  it("re-renders hook users and clears when a new run starts", () => {
    const { result } = renderHook(() => useLiveTrialState());
    expect(result.current).toBeNull();

    const published = stateAt(1);
    act(() => publishLiveTrial(published, 5000));
    expect(result.current).toBe(published);

    act(() => useShipBuilderStore.getState().startTrial("calm"));
    expect(result.current).toBeNull();
  });

  it("clears when the trial is left", () => {
    act(() => useShipBuilderStore.getState().startTrial("calm"));
    act(() => publishLiveTrial(stateAt(1), 5000));
    act(() => useShipBuilderStore.getState().endTrial());
    expect(getLiveTrialState()).toBeNull();
  });
});
