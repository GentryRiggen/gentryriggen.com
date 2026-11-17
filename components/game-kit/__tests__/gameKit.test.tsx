import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import GameShell from "../GameShell";
import usePrefersReducedMotion from "../usePrefersReducedMotion";
import useVisibilityPause from "../useVisibilityPause";

describe("GameShell", () => {
  it("fills the dynamic viewport and suppresses touch behaviours", () => {
    render(
      <GameShell testId="shell">
        <p>game</p>
      </GameShell>
    );
    const shell = screen.getByTestId("shell");
    for (const cls of [
      "h-[100dvh]",
      "overscroll-none",
      "touch-manipulation",
      "select-none",
      "[-webkit-touch-callout:none]",
    ]) {
      expect(shell).toHaveClass(cls);
    }
    expect(screen.getByText("game")).toBeInTheDocument();
  });

  it("blocks gesture zoom, unless zoom is allowed", () => {
    const blocked = render(<GameShell>x</GameShell>);
    const event = new Event("gesturestart", { cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    blocked.unmount();
    render(<GameShell allowZoom>x</GameShell>);
    const free = new Event("gesturestart", { cancelable: true });
    document.dispatchEvent(free);
    expect(free.defaultPrevented).toBe(false);
  });

  it("lets text be selected when asked", () => {
    render(
      <GameShell testId="s" allowSelection>
        x
      </GameShell>
    );
    expect(screen.getByTestId("s")).not.toHaveClass("select-none");
  });
});

describe("usePrefersReducedMotion", () => {
  it("follows the media query live", () => {
    let listener: () => void = () => {};
    let matches = false;
    window.matchMedia = jest.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, l: () => void) => {
        listener = l;
      },
      removeEventListener: jest.fn(),
    })) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    matches = true;
    act(() => listener());
    expect(result.current).toBe(true);
  });
});

describe("useVisibilityPause", () => {
  function setVisibility(state: "hidden" | "visible") {
    Object.defineProperty(document, "visibilityState", {
      value: state,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }

  it("calls hidden and persist, then visible, and persists on pagehide", () => {
    const onHidden = jest.fn();
    const onVisible = jest.fn();
    const onPersist = jest.fn();
    renderHook(() => useVisibilityPause({ onHidden, onVisible, onPersist }));
    setVisibility("hidden");
    expect(onHidden).toHaveBeenCalledTimes(1);
    expect(onPersist).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    expect(onVisible).toHaveBeenCalledTimes(1);
    fireEvent(window, new Event("pagehide"));
    expect(onPersist).toHaveBeenCalledTimes(2);
  });

  it("uses the latest callbacks without resubscribing", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(
      ({ cb }) => useVisibilityPause({ onHidden: cb }),
      { initialProps: { cb: first } }
    );
    rerender({ cb: second });
    setVisibility("hidden");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
