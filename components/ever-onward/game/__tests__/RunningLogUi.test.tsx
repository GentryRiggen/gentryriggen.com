import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import type { LogEntry, RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import StoryTicker from "../StoryTicker";
import { storyEntries } from "../storyEntries";

jest.mock("../../narration/player", () => ({
  playNarration: jest.fn(),
  stopNarration: jest.fn(),
  useNarrationPlaying: () => null,
}));

const storm: LogEntry = {
  text: "The storm hit Harbor, and your crew was ready: +120 power!",
  at: 125,
  after: 1,
  tone: "good",
};

const runWith = (log: LogEntry[], story = ["coast-hello"]): RunState => ({
  ...newRun(lightUniverse),
  story,
  log,
});

describe("the running log", () => {
  it("puts log lines among the story in the order they happened", () => {
    const entries = storyEntries(
      lightUniverse,
      runWith([storm], ["coast-hello", "coast-first-ship"])
    );
    expect(entries.map((e) => e.text.slice(0, 20))).toEqual([
      expect.stringContaining("A little boat"),
      storm.text.slice(0, 20),
      expect.any(String),
    ]);
    expect(entries[1].event).toEqual({ tone: "good", at: 125 });
  });

  it("shows the newest log line in the ticker and keeps every line in the drawer", async () => {
    render(
      <StoryTicker def={lightUniverse} run={runWith([storm])} endingIds={[]} />
    );
    const ticker = screen.getByTestId("lm-story-ticker");
    expect(ticker).toHaveTextContent("The storm hit Harbor");
    await userEvent.click(
      within(ticker).getByRole("button", { name: /Log \(2\)/ })
    );
    const drawer = screen.getByRole("dialog", { name: "Story & log" });
    expect(drawer).toHaveTextContent("The storm hit Harbor");
    expect(drawer).toHaveTextContent("2m 05s");
  });
});
