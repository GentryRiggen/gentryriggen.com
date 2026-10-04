import { act, fireEvent, render, screen } from "@testing-library/react";
import Terminal from "../Terminal";
import { SOCIAL_LINKS } from "../constants";

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
  el.textContent ===
    "⚓ I also love building fun things for my kids, like a ship-building game. Type 'ships' to set sail.";

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

  it("shows the prompt only after the `cat links.txt` block has finished", () => {
    render(<Terminal />);
    let promptShownEarly = false;
    advanceUntil(() => {
      const linksShown =
        screen.queryByText(SOCIAL_LINKS[SOCIAL_LINKS.length - 1].url) !== null;
      if (!linksShown && queryPrompt()) promptShownEarly = true;
      return linksShown;
    });

    expect(promptShownEarly).toBe(false);
    advance(100);
    expect(queryPrompt()).toBeInTheDocument();
  });

  it("points visitors at the `ships` command from the hobbies section", () => {
    render(<Terminal />);
    advanceUntil(() => false);

    expect(screen.getByText(SHIPS_LINE)).toBeInTheDocument();
    expect(screen.queryByText("cat ships.txt")).not.toBeInTheDocument();
    expect(queryPrompt()).toBeInTheDocument();
  });

  it("no longer lists `cat ships.txt` in the command history", () => {
    render(<Terminal />);
    advanceUntil(() => false);
    const input = screen.getByLabelText("Terminal command input");
    fireEvent.change(input, { target: { value: "history" } });
    fireEvent.submit(input);

    const history = screen.getByText(
      (_, el) =>
        el?.tagName === "PRE" && !!el.textContent?.includes("cat links.txt")
    );
    expect(history.textContent).not.toContain("cat ships.txt");
  });
});
