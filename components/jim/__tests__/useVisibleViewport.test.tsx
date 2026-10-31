import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import useVisibleViewport from "../useVisibleViewport";

/** A stand-in for window.visualViewport that a test can resize. */
class FakeViewport extends EventTarget {
  width = 393;
  height = 800;
  offsetTop = 0;
  scale = 1;
}

let vv: FakeViewport;

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const open = useVisibleViewport(ref);
  return (
    <div ref={ref} data-testid="root" data-keyboard={open ? "open" : "closed"}>
      <textarea aria-label="Box" />
      <button type="button">Elsewhere</button>
    </div>
  );
}

function resize(height: number, width = vv.width) {
  act(() => {
    vv.height = height;
    vv.width = width;
    // iOS 26 home-screen app: the layout viewport shrinks with the keyboard
    // too, so innerHeight is no use as the full height.
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: height,
    });
    vv.dispatchEvent(new Event("resize"));
  });
}

function keyboard() {
  return screen.getByTestId("root").dataset.keyboard;
}

beforeEach(() => {
  vv = new FakeViewport();
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: vv,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 800,
  });
});

it("sees the keyboard when innerHeight shrinks along with the viewport", () => {
  render(<Probe />);
  expect(keyboard()).toBe("closed");
  resize(460);
  expect(keyboard()).toBe("open");
  expect(screen.getByTestId("root").style.getPropertyValue("--jim-vh")).toBe(
    "460px"
  );
  resize(800);
  expect(keyboard()).toBe("closed");
});

it("sees a short keyboard while a text field has focus", () => {
  render(<Probe />);
  // A small shrink alone (a toolbar) is not the keyboard.
  resize(720);
  expect(keyboard()).toBe("closed");
  act(() => screen.getByLabelText("Box").focus());
  expect(keyboard()).toBe("open");
  act(() => screen.getByRole("button").focus());
  expect(keyboard()).toBe("closed");
});

it("keeps a separate full height for each orientation", () => {
  render(<Probe />);
  // Landscape is shorter than portrait, but that is not a keyboard.
  resize(393, 852);
  expect(keyboard()).toBe("closed");
  resize(150, 852);
  expect(keyboard()).toBe("open");
  resize(800, 393);
  expect(keyboard()).toBe("closed");
});

it("ignores a pinch-zoom", () => {
  render(<Probe />);
  act(() => {
    vv.scale = 2;
    vv.height = 400;
    vv.dispatchEvent(new Event("resize"));
  });
  expect(keyboard()).toBe("closed");
  expect(screen.getByTestId("root").style.getPropertyValue("--jim-vh")).toBe(
    ""
  );
});
