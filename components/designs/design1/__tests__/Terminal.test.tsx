import { act, fireEvent, render, screen } from "@testing-library/react";
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

const SHIPS_LINE = (_: string, el: Element | null) =>
  el?.tagName === "P" &&
  el.textContent === "⚓ New: a ship-building game. Type 'ships' to set sail.";

const queryPrompt = () => screen.queryByLabelText("Terminal command input");

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

/** Advances in small steps so each chained boot timer can schedule the next. */
function advanceUntil(done: () => boolean, limitMs = 30000) {
  for (let elapsed = 0; elapsed < limitMs && !done(); elapsed += 100) {
    advance(100);
  }
}

describe("Terminal boot sequence", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the prompt only after the `cat ships.txt` block has finished", () => {
    render(<Terminal />);
    let promptShownEarly = false;
    let sawShipsBlockTyping = false;
    advanceUntil(() => {
      const hasShipsLine = screen.queryByText(SHIPS_LINE) !== null;
      const isTypingShips = document.body.textContent?.includes("cat ship");
      if (isTypingShips && !hasShipsLine) {
        sawShipsBlockTyping = true;
        if (queryPrompt()) promptShownEarly = true;
      }
      return hasShipsLine;
    });

    expect(sawShipsBlockTyping).toBe(true);
    expect(promptShownEarly).toBe(false);
    expect(screen.getByText(SHIPS_LINE)).toBeInTheDocument();
    advance(100);
    expect(queryPrompt()).toBeInTheDocument();
  });

  it("ends with a line pointing visitors at the `ships` command", () => {
    render(<Terminal />);
    advanceUntil(() => false);

    expect(screen.getByText("cat ships.txt")).toBeInTheDocument();
    expect(screen.getByText(SHIPS_LINE)).toBeInTheDocument();
    expect(queryPrompt()).toBeInTheDocument();
  });

  it("lists `cat ships.txt` in the command history", () => {
    render(<Terminal />);
    advanceUntil(() => false);
    const input = screen.getByLabelText("Terminal command input");
    fireEvent.change(input, { target: { value: "history" } });
    fireEvent.submit(input);

    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "PRE" && !!el.textContent?.includes("cat ships.txt")
      )
    ).toBeInTheDocument();
  });
});
