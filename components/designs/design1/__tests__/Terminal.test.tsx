import { act, fireEvent, render, screen } from "@testing-library/react";
import Terminal from "../Terminal";
import { SOCIAL_LINKS } from "../constants";
import { GAMES } from "../games";

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

  it("shows the prompt only after the `Read(links.txt)` step", () => {
    render(<Terminal />);
    let promptShownEarly = false;
    advanceUntil(() => {
      const linksShown =
        screen.queryByText(SOCIAL_LINKS[SOCIAL_LINKS.length - 1].url) !== null;
      if (!linksShown && queryPrompt()) promptShownEarly = true;
      return linksShown;
    });

    expect(promptShownEarly).toBe(false);
    expect(queryPrompt()).toBeInTheDocument();
  });

  it("skips straight to the prompt on any key", () => {
    render(<Terminal />);
    expect(queryPrompt()).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "a" });
    expect(queryPrompt()).toBeInTheDocument();
    expect(
      screen.getByText(SOCIAL_LINKS[SOCIAL_LINKS.length - 1].url)
    ).toBeInTheDocument();
    // Each step appears once.
    expect(screen.getAllByText("(links.txt)")).toHaveLength(1);
  });

  it("lists every game with its version and a link", () => {
    render(<Terminal />);
    advanceUntil(() => false);

    for (const game of GAMES) {
      expect(screen.getByRole("link", { name: `${game.id}/` })).toHaveAttribute(
        "href",
        game.href
      );
      expect(screen.getByText(`v${game.version}`)).toBeInTheDocument();
    }
    expect(queryPrompt()).toBeInTheDocument();
  });

  it("runs a suggestion when tapped", () => {
    render(<Terminal />);
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "hire me" }));
    expect(screen.getByText(/Let's connect/)).toBeInTheDocument();
  });

  it("lists the boot steps in the command history", () => {
    render(<Terminal />);
    advanceUntil(() => false);
    const input = screen.getByLabelText("Terminal command input");
    fireEvent.change(input, { target: { value: "history" } });
    fireEvent.submit(input);

    const history = screen.getByText(
      (_, el) =>
        el?.tagName === "PRE" && !!el.textContent?.includes("cat links.txt")
    );
    expect(history.textContent).toContain("ls ~/side-projects/");
  });

  it("seeds the input with the printable key that skipped the boot", () => {
    render(<Terminal />);
    fireEvent.keyDown(window, { key: "h" });
    expect(queryPrompt()).toHaveValue("h");
    expect(queryPrompt()).toHaveFocus();
  });

  it.each(["Escape", "Tab"])("does not skip on %s", (key) => {
    render(<Terminal />);
    fireEvent.keyDown(window, { key });
    expect(queryPrompt()).not.toBeInTheDocument();
  });

  it("does not skip on keys aimed at a button", () => {
    render(
      <>
        <button type="button">menu</button>
        <Terminal />
      </>
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "menu" }), {
      key: "Enter",
    });
    expect(queryPrompt()).not.toBeInTheDocument();
  });

  it("a tap during boot skips without focusing the input", () => {
    render(<Terminal />);
    fireEvent.click(screen.getByText("who is gentry riggen?"));
    expect(queryPrompt()).toBeInTheDocument();
    expect(queryPrompt()).not.toHaveFocus();
  });

  it("a chip keeps half-typed input", () => {
    render(<Terminal />);
    fireEvent.keyDown(window, { key: "Enter" });
    const input = screen.getByLabelText("Terminal command input");
    fireEvent.change(input, { target: { value: "theme dra" } });
    fireEvent.click(screen.getByRole("button", { name: "skills" }));
    expect(input).toHaveValue("theme dra");
  });
});
