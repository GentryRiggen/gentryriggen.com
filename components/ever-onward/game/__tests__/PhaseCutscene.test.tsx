import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { growUniverse } from "@/lib/ever-onward/universes/grow";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import GrowScene from "../../scenes/grow/GrowScene";
import LightScene from "../../scenes/light/LightScene";
import { playNarration } from "../../narration/player";
import PhaseCutscene from "../PhaseCutscene";
import StoryDrawer from "../StoryDrawer";
import { newRun } from "@/lib/ever-onward/engine/engine";

jest.mock("../../narration/player", () => ({
  playNarration: jest.fn(),
  stopNarration: jest.fn(),
  useNarrationPlaying: () => null,
}));
jest.mock("@/lib/ever-onward/narration/manifest", () => ({
  getClip: jest.fn(() => ({ file: "x.mp3", hash: "h", durationGuess: 1 })),
  allClips: () => ({}),
}));

const frameNumber = () =>
  Number(screen.getByTestId("lm-cutscene-frame").getAttribute("data-frame"));

function renderCutscene(
  extra: Partial<Parameters<typeof PhaseCutscene>[0]> = {}
) {
  const onContinue = jest.fn();
  render(
    <PhaseCutscene
      def={lightUniverse}
      phaseIndex={0}
      Scene={LightScene}
      onContinue={onContinue}
      {...extra}
    />
  );
  return onContinue;
}

describe("the phase cutscene", () => {
  beforeEach(() => jest.clearAllMocks());

  it("is a labelled dialog that starts on frame 1", () => {
    renderCutscene();
    expect(screen.getByRole("dialog", { name: "The Coast" })).toHaveAttribute(
      "aria-modal",
      "true"
    );
    expect(frameNumber()).toBe(1);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
  });

  it("goes forward, back and skips to the goal", async () => {
    const onContinue = renderCutscene();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(frameNumber()).toBe(2);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(frameNumber()).toBe(3);
    expect(
      screen.getByTestId("lm-cutscene-tips").children.length
    ).toBeGreaterThanOrEqual(2);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(frameNumber()).toBe(2);
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(frameNumber()).toBe(4);
    expect(screen.getByTestId("lm-phase-goal")).toHaveTextContent(
      lightUniverse.phases[0].goal ?? ""
    );
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    expect(onContinue).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("uses the arrow keys and Enter", async () => {
    const onContinue = renderCutscene();
    await userEvent.keyboard("{ArrowRight}");
    expect(frameNumber()).toBe(2);
    await userEvent.keyboard("{ArrowLeft}");
    expect(frameNumber()).toBe(1);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(frameNumber()).toBe(4);
    await userEvent.keyboard("{ArrowRight}");
    expect(frameNumber()).toBe(4);
    await userEvent.keyboard("{Enter}");
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("keeps focus inside, on the main button, and gives it back on close", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(
      <PhaseCutscene
        def={lightUniverse}
        phaseIndex={0}
        Scene={LightScene}
        onContinue={jest.fn()}
      />
    );
    const dialog = screen.getByRole("dialog");
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    for (let i = 0; i < 8; i += 1) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    // Skip left the screen; focus did not fall out of the dialog.
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("offers a Listen button per frame for its own clip", async () => {
    renderCutscene();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Listen to this part" })
    );
    expect(playNarration).toHaveBeenCalledWith("light/cut-coast-2");
  });

  it("puts the extra opening question on the goal frame only", async () => {
    renderCutscene({ opening: <p>Pick a lantern</p> });
    expect(screen.queryByText("Pick a lantern")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByText("Pick a lantern")).toBeInTheDocument();
  });

  it("pans and zooms, unless the player asked for less motion", () => {
    const { unmount } = render(
      <PhaseCutscene
        def={growUniverse}
        phaseIndex={1}
        Scene={GrowScene}
        onContinue={jest.fn()}
      />
    );
    expect(screen.getByTestId("lm-cutscene-pan")).toHaveAttribute(
      "data-moving",
      "yes"
    );
    expect(screen.getByTestId("lm-cutscene-pan").className).toMatch(
      /lm-cut-pan/
    );
    unmount();
    const matchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    render(
      <PhaseCutscene
        def={growUniverse}
        phaseIndex={1}
        Scene={GrowScene}
        onContinue={jest.fn()}
      />
    );
    expect(screen.getByTestId("lm-cutscene-pan")).toHaveAttribute(
      "data-moving",
      "no"
    );
    expect(screen.getByTestId("lm-cutscene-pan").className).not.toMatch(
      /lm-cut-pan/
    );
    window.matchMedia = matchMedia;
  });

  it("can be watched again from the story drawer", async () => {
    const run = { ...newRun(lightUniverse), phase: 1 };
    render(
      <StoryDrawer
        def={lightUniverse}
        run={run}
        entries={[]}
        endingIds={[]}
        onClose={jest.fn()}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^Intro · Part 2/ })
    );
    await userEvent.click(screen.getByRole("button", { name: "Watch again" }));
    expect(
      screen.getByRole("dialog", { name: "No More Night" })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByTestId("lm-phase-overlay")).toBeNull();
    expect(screen.getByTestId("lm-story-drawer")).toBeInTheDocument();
  });
});
