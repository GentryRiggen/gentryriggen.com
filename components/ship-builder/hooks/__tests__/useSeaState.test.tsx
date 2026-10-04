import { act, renderHook } from "@testing-library/react";
import useSeaState from "../useSeaState";

const KEY = "ship-builder:ui:sea";

afterEach(() => {
  jest.restoreAllMocks();
  window.localStorage.clear();
});

describe("useSeaState", () => {
  it("defaults to calm and persists a choice across remounts", () => {
    const first = renderHook(() => useSeaState());
    expect(first.result.current.seaState).toBe("calm");
    act(() => first.result.current.setSeaState("stormy"));
    expect(first.result.current.seaState).toBe("stormy");
    first.unmount();
    expect(window.localStorage.getItem(KEY)).toBe("stormy");
    const second = renderHook(() => useSeaState());
    expect(second.result.current.seaState).toBe("stormy");
  });

  it("ignores unknown stored values", () => {
    window.localStorage.setItem(KEY, "hurricane");
    const { result } = renderHook(() => useSeaState());
    expect(result.current.seaState).toBe("calm");
  });

  // Keep this last: a failed write switches the module to its in-memory value.
  it("still switches when storage throws", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { result } = renderHook(() => useSeaState());
    act(() => result.current.setSeaState("choppy"));
    expect(result.current.seaState).toBe("choppy");
  });
});
