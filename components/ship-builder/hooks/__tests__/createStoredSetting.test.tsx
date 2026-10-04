import { act, renderHook } from "@testing-library/react";
import { createStoredSetting } from "../createStoredSetting";

interface Prefs {
  n: number;
}

function makeSetting(key: string) {
  return createStoredSetting<Prefs>({
    key,
    parse: (raw) => ({ n: raw === null ? 0 : Number(raw) || 0 }),
    serialize: (value) => String(value.n),
    fallback: { n: 0 },
  });
}

afterEach(() => {
  jest.restoreAllMocks();
  window.localStorage.clear();
});

describe("createStoredSetting", () => {
  it("returns a stable object snapshot until the stored text changes", () => {
    const setting = makeSetting("test:stable");
    const { result, rerender } = renderHook(() => setting.useValue());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    act(() => setting.set({ n: 2 }));
    expect(result.current).toEqual({ n: 2 });
  });

  it("uses the fallback as the server snapshot", () => {
    const setting = makeSetting("test:server");
    expect(setting.getServerSnapshot()).toEqual({ n: 0 });
  });

  it("follows changes made in another tab", () => {
    const setting = makeSetting("test:storage");
    const { result } = renderHook(() => setting.useValue());
    act(() => {
      window.localStorage.setItem("test:storage", "7");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "test:storage" })
      );
    });
    expect(result.current).toEqual({ n: 7 });
  });

  it("keeps the written value when storage throws on write", () => {
    const setting = makeSetting("test:throws");
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const { result } = renderHook(() => setting.useValue());
    act(() => setting.set({ n: 3 }));
    expect(result.current).toEqual({ n: 3 });
  });

  it("removes the key when serialize returns null", () => {
    const setting = createStoredSetting<boolean>({
      key: "test:remove",
      parse: (raw) => raw === "1",
      serialize: (value) => (value ? "1" : null),
      fallback: false,
    });
    setting.set(true);
    expect(window.localStorage.getItem("test:remove")).toBe("1");
    setting.set(false);
    expect(window.localStorage.getItem("test:remove")).toBeNull();
  });
});
