import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import { playNarration } from "../../narration/player";
import PhaseOverlay from "../PhaseOverlay";
import StoryTicker from "../StoryTicker";

jest.mock("../../narration/player", () => ({
  playNarration: jest.fn(),
  stopNarration: jest.fn(),
  useNarrationPlaying: () => null,
}));

const runWithStory = (story: string[], phase = 0): RunState => ({
  ...newRun(lightUniverse),
  phase,
  story,
});

function renderTicker(run: RunState) {
  return render(
    <StoryTicker def={lightUniverse} run={run} endingIds={["last-end-1"]} />
  );
}

describe("the story ticker", () => {
  it("shows the newest line and the count", () => {
    renderTicker(runWithStory(["coast-hello", "coast-first-ship"]));
    const ticker = screen.getByTestId("lm-story-ticker");
    expect(ticker).toHaveTextContent("A little boat sees the beam");
    expect(
      within(ticker).getByRole("button", { name: /Story \(2\)/ })
    ).toBeInTheDocument();
  });

  it("pulses NEW for a line that arrives, until the story is opened", async () => {
    const { rerender } = renderTicker(runWithStory(["coast-hello"]));
    expect(screen.queryByTestId("lm-story-new")).not.toBeInTheDocument();
    rerender(
      <StoryTicker
        def={lightUniverse}
        run={runWithStory(["coast-hello", "coast-first-ship"])}
        endingIds={[]}
      />
    );
    expect(screen.getByTestId("lm-story-new")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 new/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Story/ }));
    await userEvent.click(screen.getByRole("button", { name: "Close story" }));
    expect(screen.queryByTestId("lm-story-new")).not.toBeInTheDocument();
  });

  it("opens a labelled dialog and focuses the close button", async () => {
    renderTicker(runWithStory(["coast-hello", "coast-first-ship"]));
    await userEvent.click(screen.getByRole("button", { name: /Story/ }));
    const dialog = screen.getByRole("dialog", { name: "Story" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close story" })).toHaveFocus();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
  });

  it("closes with Escape, the close button and the backdrop, restoring focus", async () => {
    renderTicker(runWithStory(["coast-hello"]));
    const opener = () => screen.getByRole("button", { name: /Story \(/ });
    for (const close of [
      () => userEvent.keyboard("{Escape}"),
      () =>
        userEvent.click(screen.getByRole("button", { name: "Close story" })),
      () => userEvent.click(screen.getByTestId("lm-story-backdrop")),
    ]) {
      await userEvent.click(opener());
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      await close();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(opener()).toHaveFocus();
    }
  });

  it("leaves focus alone when the game re-renders while it is open", async () => {
    const run = runWithStory(["coast-hello"]);
    const { rerender } = renderTicker(run);
    await userEvent.click(screen.getByRole("button", { name: /Story/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.tab();
    const focused = document.activeElement as HTMLElement;
    expect(focused).not.toBe(
      screen.getByRole("button", { name: "Close story" })
    );
    expect(dialog).toContainElement(focused);
    rerender(
      <StoryTicker
        def={lightUniverse}
        run={{ ...run, time: run.time + 0.1 }}
        endingIds={["last-end-1"]}
      />
    );
    expect(focused).toHaveFocus();
  });

  it("closes when a full-screen moment covers the game", async () => {
    const run = runWithStory(["coast-hello"]);
    const { rerender } = renderTicker(run);
    await userEvent.click(screen.getByRole("button", { name: /Story/ }));
    rerender(
      <StoryTicker def={lightUniverse} run={run} endingIds={[]} isCovered />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps Tab inside the dialog", async () => {
    renderTicker(runWithStory(["coast-hello"]));
    await userEvent.click(screen.getByRole("button", { name: /Story/ }));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("lets a player re-read the intros of the parts reached", async () => {
    renderTicker(runWithStory(["coast-hello", "night-hello"], 1));
    await userEvent.click(screen.getByRole("button", { name: /Story/ }));
    const toggles = screen.getAllByRole("button", { name: /^Intro · Part/ });
    expect(toggles).toHaveLength(2);
    await userEvent.click(toggles[0]);
    expect(screen.getByTestId("lm-phase-goal")).toHaveTextContent(
      lightUniverse.phases[0].goal ?? ""
    );
    expect(
      screen.getByRole("button", { name: "Listen to this introduction" })
    ).toBeInTheDocument();
  });
});

describe("the phase intro", () => {
  it.each(lightUniverse.phases.map((p, i) => [i, p] as const))(
    "part %i has a goal and a few short sentences",
    (_i, phase) => {
      expect(phase.goal).toBeTruthy();
      const sentences = (phase.intro ?? "").split(/(?<=[.!?])\s+/);
      expect(sentences.length).toBeGreaterThanOrEqual(2);
      expect(sentences.length).toBeLessThanOrEqual(5);
    }
  );

  it("shows the title, sentences, goal and a Continue button", async () => {
    const onContinue = jest.fn();
    render(
      <PhaseOverlay
        phase={lightUniverse.phases[0]}
        clipId="light/intro-coast"
        number={1}
        total={4}
        onContinue={onContinue}
      />
    );
    expect(
      screen.getByRole("dialog", { name: "The Coast" })
    ).toBeInTheDocument();
    expect(screen.getByText("Part 1 of 4")).toBeInTheDocument();
    expect(screen.getByTestId("lm-phase-goal")).toHaveTextContent(
      "Guide ships home and light the whole coast."
    );
    expect(screen.getByRole("button", { name: "Continue" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("plays the narration clip", async () => {
    render(
      <PhaseOverlay
        phase={lightUniverse.phases[1]}
        clipId="light/intro-night"
        number={2}
        total={4}
        onContinue={jest.fn()}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Listen to this introduction" })
    );
    expect(playNarration).toHaveBeenCalledWith("light/intro-night");
  });
});
