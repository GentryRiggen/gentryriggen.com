import { act, fireEvent, renderHook } from "@testing-library/react";
import { createFakeAudio } from "../testing/fakeAudio";
import { useResilientAudio } from "../useResilientAudio";

const fake = createFakeAudio();
beforeEach(() => {
  fake.reset();
  fake.install();
});
afterEach(() => fake.uninstall());

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useResilientAudio", () => {
  it.each(["touchend", "click", "pointerdown", "keydown"])(
    "unlocks on %s",
    (type) => {
      const { result } = renderHook(() => useResilientAudio());
      expect(result.current.engine()).toBeNull();
      act(() => {
        window.dispatchEvent(new Event(type));
      });
      expect(result.current.engine()).not.toBeNull();
    }
  );

  it("suspends when hidden and resumes when visible again", () => {
    const { result } = renderHook(() => useResilientAudio());
    fireEvent.click(window);
    act(() => setVisibility("hidden"));
    expect(fake.contexts[0].suspend).toHaveBeenCalled();
    expect(result.current.engine()).toBeNull();
    act(() => setVisibility("visible"));
    expect(result.current.engine()).not.toBeNull();
  });

  it("repairs an interrupted context on the next tap", () => {
    renderHook(() => useResilientAudio());
    fireEvent.click(window);
    fake.contexts[0].setState("interrupted");
    fireEvent.click(window);
    expect(fake.contexts).toHaveLength(2);
  });

  it("closes the context and stops listening on unmount", () => {
    const { unmount } = renderHook(() => useResilientAudio());
    fireEvent.click(window);
    unmount();
    expect(fake.contexts[0].close).toHaveBeenCalled();
    fireEvent.click(window);
    expect(fake.contexts).toHaveLength(1);
  });
});
