import { render } from "@testing-library/react";
import useBlockPinchZoom from "../useBlockPinchZoom";

function Probe() {
  useBlockPinchZoom();
  return null;
}

function touchMove(touchCount: number): Event {
  const e = new Event("touchmove", { bubbles: true, cancelable: true });
  Object.defineProperty(e, "touches", {
    value: Array.from({ length: touchCount }, () => ({})),
  });
  document.dispatchEvent(e);
  return e;
}

describe("useBlockPinchZoom", () => {
  it("cancels WebKit gesture events", () => {
    render(<Probe />);
    for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
      const e = new Event(type, { cancelable: true });
      document.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(true);
    }
  });

  it("cancels multi-touch moves but leaves one-finger scrolling", () => {
    render(<Probe />);
    expect(touchMove(2).defaultPrevented).toBe(true);
    expect(touchMove(1).defaultPrevented).toBe(false);
  });

  it("registers non-passive listeners and removes them on unmount", () => {
    const add = jest.spyOn(document, "addEventListener");
    const remove = jest.spyOn(document, "removeEventListener");
    const { unmount } = render(<Probe />);
    expect(add).toHaveBeenCalledWith("touchmove", expect.any(Function), {
      passive: false,
    });
    unmount();
    expect(remove).toHaveBeenCalledWith("touchmove", expect.any(Function));
    const e = new Event("gesturestart", { cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(touchMove(2).defaultPrevented).toBe(false);
    add.mockRestore();
    remove.mockRestore();
  });
});
