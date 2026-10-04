import { act, renderHook } from "@testing-library/react";
import useCollapsedPanels from "../useCollapsedPanels";

const KEY = "ship-builder:ui:collapsed";

afterEach(() => {
  jest.restoreAllMocks();
  window.localStorage.clear();
});

describe("useCollapsedPanels", () => {
  it("starts expanded and toggles each side independently", () => {
    const { result } = renderHook(() => useCollapsedPanels());
    expect(result.current).toMatchObject({ left: false, right: false });
    act(() => result.current.toggle("left"));
    expect(result.current).toMatchObject({ left: true, right: false });
    act(() => result.current.toggle("right"));
    expect(result.current).toMatchObject({ left: true, right: true });
    act(() => result.current.toggle("left"));
    expect(result.current).toMatchObject({ left: false, right: true });
  });

  it("persists across remounts", () => {
    const first = renderHook(() => useCollapsedPanels());
    act(() => first.result.current.toggle("right"));
    first.unmount();
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    const second = renderHook(() => useCollapsedPanels());
    expect(second.result.current).toMatchObject({ left: false, right: true });
  });

  it("ignores corrupt stored values", () => {
    window.localStorage.setItem(KEY, "{not json");
    const { result } = renderHook(() => useCollapsedPanels());
    expect(result.current).toMatchObject({ left: false, right: false });
  });

  it("stays expanded and still toggles when storage throws", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { result } = renderHook(() => useCollapsedPanels());
    expect(result.current).toMatchObject({ left: false, right: false });
    act(() => result.current.toggle("left"));
    expect(result.current.left).toBe(true);
    act(() => result.current.toggle("left"));
    expect(result.current.left).toBe(false);
  });

  // Keep this last: a failed write switches the module to its in-memory value
  // for the rest of the file.
  it("still toggles when only writing to storage throws", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const { result } = renderHook(() => useCollapsedPanels());
    act(() => result.current.toggle("left"));
    expect(result.current.left).toBe(true);
    act(() => result.current.toggle("right"));
    expect(result.current).toMatchObject({ left: true, right: true });
    act(() => result.current.toggle("left"));
    act(() => result.current.toggle("right"));
    expect(result.current).toMatchObject({ left: false, right: false });
  });
});
