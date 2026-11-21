import { act, renderHook } from "@testing-library/react";
import { SAVE_KEY, emptySave } from "../save";
import { resetSaveStore, useShipwreckSave } from "../useSave";

beforeEach(() => {
  window.localStorage.clear();
  resetSaveStore();
});

describe("useShipwreckSave", () => {
  it("loads the stored save after mount", () => {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ ...emptySave(), settings: { speed: 30 } })
    );
    const { result } = renderHook(() => useShipwreckSave());
    expect(result.current.save.settings.speed).toBe(30);
  });

  it("writes an update on persist", () => {
    const { result } = renderHook(() => useShipwreckSave());
    act(() => {
      result.current.update((s) => ({
        ...s,
        settings: { ...s.settings, sound: false },
      }));
    });
    act(() => result.current.persist());
    expect(
      JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "{}").settings.sound
    ).toBe(false);
  });

  it("never writes over a save it could not read or back up", () => {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 2 }));
    const { result } = renderHook(() => useShipwreckSave());
    act(() => {
      result.current.update((s) => ({ ...s, lastWhatIf: ["x"] }));
    });
    act(() => result.current.persist());
    expect(window.localStorage.getItem(SAVE_KEY)).toBe('{"v":2}');
  });
});
