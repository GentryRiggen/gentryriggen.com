import { act, renderHook } from "@testing-library/react";
import useShowAllParts from "../useShowAllParts";

const KEY = "ship-builder:ui:show-all-parts";

afterEach(() => {
  jest.restoreAllMocks();
  window.localStorage.clear();
});

describe("useShowAllParts", () => {
  it("defaults to off and persists a choice across remounts", () => {
    const first = renderHook(() => useShowAllParts());
    expect(first.result.current.showAll).toBe(false);
    act(() => first.result.current.setShowAll(true));
    expect(first.result.current.showAll).toBe(true);
    first.unmount();
    expect(window.localStorage.getItem(KEY)).toBe("1");
    const second = renderHook(() => useShowAllParts());
    expect(second.result.current.showAll).toBe(true);
    act(() => second.result.current.setShowAll(false));
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("treats unknown stored values as off", () => {
    window.localStorage.setItem(KEY, "maybe");
    const { result } = renderHook(() => useShowAllParts());
    expect(result.current.showAll).toBe(false);
  });

  // Keep this last: a failed write switches the module to its in-memory value.
  it("still switches when storage throws", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { result } = renderHook(() => useShowAllParts());
    act(() => result.current.setShowAll(true));
    expect(result.current.showAll).toBe(true);
  });
});
