import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlayerState } from "@/lib/jim/player";
import NowPlayingBar from "../NowPlayingBar";

const PLAYING: PlayerState = {
  key: "msg:1",
  status: "playing",
  title: "Course plotted, Captain. Three waypoints…",
  part: 1,
  parts: 4,
  partProgress: 0.5,
  speed: 1.25,
  engine: "audio",
  error: null,
};

function renderBar(state: Partial<PlayerState> = {}) {
  const handlers = {
    onTogglePause: jest.fn(),
    onSpeed: jest.fn(),
    onStop: jest.fn(),
    onDismiss: jest.fn(),
  };
  render(<NowPlayingBar state={{ ...PLAYING, ...state }} {...handlers} />);
  return handlers;
}

describe("NowPlayingBar", () => {
  it("is not there when nothing plays", () => {
    renderBar({ status: "idle" });
    expect(screen.queryByRole("region", { name: "Now playing" })).toBeNull();
  });

  it("shows the title, speed and progress by part", () => {
    renderBar();
    expect(screen.getByText(PLAYING.title)).toBeInTheDocument();
    expect(screen.getByText("1.25×")).toBeInTheDocument();
    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "38");
    expect(progress).toHaveAttribute("aria-valuetext", "Part 2 of 4");
  });

  it("pauses, steps the speed by 0.25 and stops", async () => {
    const handlers = renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(handlers.onTogglePause).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Faster" }));
    expect(handlers.onSpeed).toHaveBeenLastCalledWith(1.5);
    await userEvent.click(screen.getByRole("button", { name: "Slower" }));
    expect(handlers.onSpeed).toHaveBeenLastCalledWith(1);
    await userEvent.click(screen.getByRole("button", { name: "Stop reading" }));
    expect(handlers.onStop).toHaveBeenCalled();
  });

  it("offers Play when paused", () => {
    renderBar({ status: "paused" });
    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
  });

  it("can't go past the speed limits", () => {
    renderBar({ speed: 3 });
    expect(screen.getByRole("button", { name: "Faster" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Slower" })).toBeEnabled();
  });

  it("can't go below the slowest speed", () => {
    renderBar({ speed: 0.5 });
    expect(screen.getByRole("button", { name: "Slower" })).toBeDisabled();
  });

  it("disables play while loading", () => {
    renderBar({ status: "loading" });
    expect(screen.getByRole("button", { name: "Loading" })).toBeDisabled();
  });

  it("shows no part count for the browser's voice", () => {
    renderBar({ engine: "speech", parts: 1, part: 0 });
    expect(screen.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow"
    );
  });

  it("shows an error until closed", async () => {
    const handlers = renderBar({
      status: "error",
      key: null,
      error: "Couldn't load the rest of this reply.",
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load the rest of this reply."
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(handlers.onDismiss).toHaveBeenCalled();
  });

  it("keeps focus in the box when tapped (the keyboard stays up)", async () => {
    render(
      <>
        <textarea aria-label="Message" />
        <NowPlayingBar
          state={PLAYING}
          onTogglePause={jest.fn()}
          onSpeed={jest.fn()}
          onStop={jest.fn()}
          onDismiss={jest.fn()}
        />
      </>
    );
    const box = screen.getByLabelText("Message");
    box.focus();
    await userEvent.click(screen.getByRole("button", { name: "Faster" }));
    expect(box).toHaveFocus();
  });
});
