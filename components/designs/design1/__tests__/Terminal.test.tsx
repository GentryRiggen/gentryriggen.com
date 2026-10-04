import { act, render, screen } from "@testing-library/react";
import Terminal from "../Terminal";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    unoptimized: _unoptimized, // eslint-disable-line @typescript-eslint/no-unused-vars
    ...props
  }: React.ComponentPropsWithoutRef<"img"> & { unoptimized?: boolean }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

describe("Terminal boot sequence", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("ends with a line pointing visitors at the `ships` command", () => {
    render(<Terminal />);
    // Advance in small steps so each chained boot timer can schedule the next
    for (let elapsed = 0; elapsed < 30000; elapsed += 100) {
      act(() => {
        jest.advanceTimersByTime(100);
      });
    }

    expect(screen.getByText("cat ships.txt")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "P" &&
          el.textContent ===
            "⚓ New: a ship-building game. Type 'ships' to set sail."
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Terminal command input")).toBeInTheDocument();
  });
});
