import { act, renderHook } from "@testing-library/react";
import {
  useShipBuilderStore,
  type TrialSlice,
} from "@/lib/ship-builder/state/store";
import useSeaState, { getSeaState } from "../useSeaState";
import useTimeOfDay, { getTimeOfDay } from "../useTimeOfDay";

const SEA_KEY = "ship-builder:ui:sea";
const TIME_KEY = "ship-builder:ui:time";

function useLook() {
  return { sea: useSeaState().seaState, time: useTimeOfDay().timeOfDay };
}

function setTrial(trial: TrialSlice) {
  act(() => useShipBuilderStore.setState({ trial }));
}

const sim = { ship: {}, sea: "calm", length: 10, funnels: [] };

beforeEach(() => {
  window.localStorage.setItem(SEA_KEY, "stormy");
  window.localStorage.setItem(TIME_KEY, "night");
});

afterEach(() => {
  act(() => useShipBuilderStore.setState({ trial: { status: "idle" } }));
  window.localStorage.clear();
});

describe("the trial look", () => {
  it("is the main sea and time while no trial is on", () => {
    const { result } = renderHook(useLook);
    expect(result.current).toEqual({ sea: "stormy", time: "night" });
  });

  it("follows a running trial's look", () => {
    const { result } = renderHook(useLook);
    setTrial({
      status: "running",
      runId: 1,
      descending: true,
      input: sim as never,
      look: { sea: "choppy", time: "sunset" },
    });
    expect(result.current).toEqual({ sea: "choppy", time: "sunset" });
    // The main choices are untouched.
    expect(getSeaState()).toBe("stormy");
    expect(getTimeOfDay()).toBe("night");
  });

  it("shows the storm's wild sea", () => {
    const { result } = renderHook(useLook);
    setTrial({
      status: "result",
      runId: 1,
      descending: true,
      input: sim as never,
      state: {} as never,
      look: { sea: "wild", time: "day" },
    });
    expect(result.current).toEqual({ sea: "wild", time: "day" });
  });

  it("does not force night on an iceberg trial", () => {
    const { result } = renderHook(useLook);
    setTrial({
      status: "running",
      runId: 1,
      descending: true,
      input: { ...sim, iceberg: { impactX: 3 } } as never,
      look: { sea: "calm", time: "day" },
    });
    expect(result.current.time).toBe("day");
  });

  it("follows the look while aiming, and goes back to main after", () => {
    const { result } = renderHook(useLook);
    setTrial({ status: "aiming", look: { sea: "calm", time: "sunset" } });
    expect(result.current).toEqual({ sea: "calm", time: "sunset" });
    setTrial({ status: "idle" });
    expect(result.current).toEqual({ sea: "stormy", time: "night" });
  });

  it("is filled from the main choices when a trial starts", () => {
    act(() => useShipBuilderStore.getState().startTrial("calm"));
    const { trial } = useShipBuilderStore.getState();
    expect(trial.status === "running" && trial.look).toEqual({
      sea: "stormy",
      time: "night",
    });
  });

  it("is filled from the main choices when aiming", () => {
    act(() => useShipBuilderStore.getState().aimIceberg());
    const { trial } = useShipBuilderStore.getState();
    expect(trial.status === "aiming" && trial.look).toEqual({
      sea: "stormy",
      time: "night",
    });
  });
});
