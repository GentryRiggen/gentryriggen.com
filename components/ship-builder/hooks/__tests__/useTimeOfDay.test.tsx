import { act, renderHook } from "@testing-library/react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import useTimeOfDay from "../useTimeOfDay";

const KEY = "ship-builder:ui:time";

afterEach(() => {
  jest.restoreAllMocks();
  window.localStorage.clear();
});

describe("useTimeOfDay", () => {
  it("defaults to calm and persists a choice across remounts", () => {
    const first = renderHook(() => useTimeOfDay());
    expect(first.result.current.timeOfDay).toBe("day");
    act(() => first.result.current.setTimeOfDay("night"));
    expect(first.result.current.timeOfDay).toBe("night");
    first.unmount();
    expect(window.localStorage.getItem(KEY)).toBe("night");
    const second = renderHook(() => useTimeOfDay());
    expect(second.result.current.timeOfDay).toBe("night");
  });

  it("ignores unknown stored values", () => {
    window.localStorage.setItem(KEY, "hurricane");
    const { result } = renderHook(() => useTimeOfDay());
    expect(result.current.timeOfDay).toBe("day");
  });

  it("is night during an iceberg trial without changing the saved choice", () => {
    const { result } = renderHook(() => useTimeOfDay());
    const ship = useShipBuilderStore.getState().ship;
    const sim = { ship: {}, sea: "calm" };
    act(() =>
      useShipBuilderStore.setState({
        trial: {
          status: "running",
          runId: 1,
          input: { ...sim, iceberg: { impactX: 3 } } as never,
        },
      })
    );
    expect(result.current.timeOfDay).toBe("night");
    expect(window.localStorage.getItem(KEY)).toBeNull();
    act(() =>
      useShipBuilderStore.setState({
        trial: { status: "running", runId: 2, input: sim as never },
      })
    );
    expect(result.current.timeOfDay).toBe("day");
    act(() =>
      useShipBuilderStore.setState({ trial: { status: "idle" }, ship })
    );
  });

  // Keep this last: a failed write switches the module to its in-memory value.
  it("still switches when storage throws", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { result } = renderHook(() => useTimeOfDay());
    act(() => result.current.setTimeOfDay("sunset"));
    expect(result.current.timeOfDay).toBe("sunset");
  });
});
