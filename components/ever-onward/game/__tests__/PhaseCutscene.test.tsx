import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { growUniverse } from "@/lib/ever-onward/universes/grow";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import GrowScene from "../../scenes/grow/GrowScene";
import LightScene from "../../scenes/light/LightScene";
import {
  applyNarrationRate,
  pauseNarration,
  playNarration,
  resumeNarration,
  stopNarration,
} from "../../narration/player";
import {
  getNarrationSettings,
  setNarrationSettings,
} from "../../narration/settings";
import PhaseCutscene, { FILM_TICK_MS, HOLD_MS, shotMs } from "../PhaseCutscene";
import StoryDrawer from "../StoryDrawer";
import { newRun } from "@/lib/ever-onward/engine/engine";

let nowPlaying: string | null = null;
jest.mock("../../narration/player", () => ({
  playNarration: jest.fn(),
  stopNarration: jest.fn(),
  applyNarrationRate: jest.fn(),
  pauseNarration: jest.fn(),
  resumeNarration: jest.fn(),
  useNarrationPlaying: () => nowPlaying,
}));
jest.mock("@/lib/ever-onward/narration/manifest", () => ({
  getClip: jest.fn(() => ({ file: "x.mp3", hash: "h", durationGuess: 1 })),
  allClips: () => ({}),
}));

const shot = () =>
  screen.getByTestId("lm-phase-overlay").getAttribute("data-film-shot");

const coast = lightUniverse.phases[0];
const shots = coast.cutscene ?? [];

function renderFilm(extra: Partial<Parameters<typeof PhaseCutscene>[0]> = {}) {
  const onContinue = jest.fn();
  const utils = render(
    <PhaseCutscene
      def={lightUniverse}
      phaseIndex={0}
      Scene={LightScene}
      onContinue={onContinue}
      {...extra}
    />
  );
  return { onContinue, ...utils };
}

/** A pointer event with a position (jsdom has no PointerEvent). */
function press(el: Element, type: "pointerdown" | "pointerup", x: number) {
  fireEvent(
    el,
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x })
  );
}

/** A quick tap on the film at a share of the screen's width (0 to 1). */
function tap(share: number) {
  const stage = screen.getByTestId("eo-film-stage");
  const x = window.innerWidth * share;
  press(stage, "pointerdown", x);
  press(stage, "pointerup", x);
}

/** Lets the film's clock run. */
function play(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe("the intro film", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nowPlaying = null;
    window.localStorage.clear();
    setNarrationSettings({ isEnabled: false, rate: 1 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("is a labelled dialog that opens on the universe's title card", () => {
    renderFilm();
    expect(screen.getByRole("dialog", { name: "The Coast" })).toHaveAttribute(
      "aria-modal",
      "true"
    );
    expect(shot()).toBe("1");
    expect(screen.getByTestId("eo-film-title")).toHaveTextContent(
      lightUniverse.title
    );
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });

  it("plays by itself: types each line, then moves to the next shot", () => {
    jest.useFakeTimers();
    renderFilm();
    const caption = screen.getByTestId("eo-film-caption");
    expect(caption.textContent).not.toContain(shots[0].text);
    play(shots[0].text.length * 40);
    expect(caption.textContent).toContain(shots[0].text);
    play(shotMs(shots[0]));
    expect(shot()).toBe("2");
    // The robot walks on in the second shot.
    expect(screen.getByTestId("eo-film-robot")).toHaveAttribute(
      "data-move",
      shots[1].robot?.move
    );
  });

  it("reaches the closing card on its own, with the goal, tips and Start", () => {
    jest.useFakeTimers();
    const { onContinue } = renderFilm();
    for (const s of shots) play(shotMs(s) + FILM_TICK_MS * 2);
    expect(shot()).toBe("end");
    expect(screen.getByTestId("lm-phase-goal")).toHaveTextContent(
      coast.goal ?? ""
    );
    expect(screen.getByTestId("lm-cutscene-tips").children).toHaveLength(
      coast.tips?.length ?? 0
    );
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Start" })).toHaveFocus();
  });

  it("skips to the closing card, starts, and can be watched again", async () => {
    const { onContinue } = renderFilm();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(shot()).toBe("end");
    await userEvent.click(screen.getByRole("button", { name: "Watch again" }));
    expect(shot()).toBe("1");
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("taps like a story: right for the next shot, left to go back and replay", () => {
    jest.useFakeTimers();
    renderFilm();
    expect(screen.getByTestId("eo-film-hint")).toBeInTheDocument();
    tap(0.8);
    expect(shot()).toBe("2");
    tap(0.8);
    expect(shot()).toBe("3");
    play(3000);
    tap(0.1);
    expect(shot()).toBe("2");
    // The shot plays again from its start.
    expect(screen.getByTestId("eo-film-caption").textContent).toBe("▌");
    tap(0.1);
    tap(0.1);
    expect(shot()).toBe("1");
    // Tapping all the way through reaches the closing card, which stays put.
    for (let i = 0; i < shots.length + 3; i += 1) tap(0.9);
    expect(shot()).toBe("end");
    tap(0.1);
    expect(shot()).toBe(String(shots.length));
  });

  it("taps on the buttons and the closing card are theirs, not the film's", async () => {
    renderFilm();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    const end = screen.getByTestId("lm-cutscene-end");
    press(end, "pointerdown", 10);
    press(end, "pointerup", 10);
    expect(shot()).toBe("end");
  });

  it("pauses while held, and carries on when let go", () => {
    jest.useFakeTimers();
    renderFilm();
    const stage = screen.getByTestId("eo-film-stage");
    press(stage, "pointerdown", 900);
    play(HOLD_MS + FILM_TICK_MS);
    expect(pauseNarration).toHaveBeenCalled();
    const before = screen.getByTestId("eo-film-caption").textContent;
    play(shotMs(shots[0]) * 2);
    expect(shot()).toBe("1");
    expect(screen.getByTestId("eo-film-caption").textContent).toBe(before);
    press(stage, "pointerup", 900);
    // Letting go of a hold does not skip.
    expect(shot()).toBe("1");
    expect(resumeNarration).toHaveBeenCalled();
    play(shotMs(shots[0]) + FILM_TICK_MS * 2);
    expect(shot()).toBe("2");
  });

  it("fills the playing shot's bar as it goes", () => {
    jest.useFakeTimers();
    renderFilm();
    const fill = () =>
      Number(
        screen
          .getByTestId("eo-film-progress")
          .querySelectorAll("svg")[0]
          .querySelectorAll("rect")[1]
          .getAttribute("width")
      );
    expect(fill()).toBe(0);
    play(shotMs(shots[0]) / 2);
    expect(fill()).toBeGreaterThan(30);
    expect(fill()).toBeLessThan(70);
  });

  it("pauses and plays", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderFilm();
    await user.click(screen.getByRole("button", { name: "Pause" }));
    play(shotMs(shots[0]) * 3);
    expect(shot()).toBe("1");
    await user.click(screen.getByRole("button", { name: "Play" }));
    play(shotMs(shots[0]) + FILM_TICK_MS * 2);
    expect(shot()).toBe("2");
  });

  it("reads each shot aloud and waits for the voice to finish", () => {
    setNarrationSettings({ isEnabled: true });
    jest.useFakeTimers();
    const { rerender } = renderFilm();
    expect(playNarration).toHaveBeenCalledWith("light/cut-coast-1");
    nowPlaying = "light/cut-coast-1";
    rerender(
      <PhaseCutscene
        def={lightUniverse}
        phaseIndex={0}
        Scene={LightScene}
        onContinue={jest.fn()}
      />
    );
    play(shotMs(shots[0]) + 1000);
    // Still speaking: the film waits.
    expect(shot()).toBe("1");
    nowPlaying = null;
    play(FILM_TICK_MS);
    play(2000);
    expect(shot()).toBe("2");
    expect(playNarration).toHaveBeenLastCalledWith("light/cut-coast-2");
  });

  it("does not wait forever for a voice that never starts", () => {
    setNarrationSettings({ isEnabled: true });
    jest.useFakeTimers();
    renderFilm();
    play(shotMs(shots[0]) + 3000);
    expect(shot()).toBe("2");
  });

  it("has an obvious Mute button that silences the film", async () => {
    setNarrationSettings({ isEnabled: true });
    renderFilm();
    const mute = screen.getByTestId("eo-film-mute");
    expect(mute).toHaveTextContent("Mute");
    expect(mute).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(stopNarration).toHaveBeenCalled();
    expect(screen.getByTestId("eo-film-mute")).toHaveTextContent("Muted");
    expect(screen.getByRole("button", { name: "Unmute" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await userEvent.click(screen.getByRole("button", { name: "Unmute" }));
    expect(screen.getByTestId("eo-film-mute")).toHaveTextContent("Mute");
  });

  it("steps the speed a quarter at a time, from 0.75x to 2x", async () => {
    renderFilm();
    const speed = screen.getByTestId("eo-film-speed");
    expect(speed).toHaveTextContent("1×");
    await userEvent.click(screen.getByRole("button", { name: "Faster" }));
    expect(speed).toHaveTextContent("1.25×");
    expect(getNarrationSettings().rate).toBe(1.25);
    expect(applyNarrationRate).toHaveBeenCalled();
    for (let i = 0; i < 6; i += 1)
      await userEvent.click(screen.getByRole("button", { name: "Faster" }));
    expect(speed).toHaveTextContent("2×");
    expect(screen.getByRole("button", { name: "Faster" })).toBeDisabled();
    for (let i = 0; i < 8; i += 1)
      await userEvent.click(screen.getByRole("button", { name: "Slower" }));
    expect(speed).toHaveTextContent("0.75×");
    expect(screen.getByRole("button", { name: "Slower" })).toBeDisabled();
  });

  it("plays twice as fast at 2x", () => {
    setNarrationSettings({ rate: 2 });
    jest.useFakeTimers();
    renderFilm();
    play(shotMs(shots[0]) / 2 + FILM_TICK_MS * 2);
    expect(shot()).toBe("2");
  });

  it("uses the arrow keys and Enter", async () => {
    const { onContinue } = renderFilm();
    await userEvent.keyboard("{ArrowRight}");
    expect(shot()).toBe("2");
    await userEvent.keyboard("{ArrowLeft}");
    expect(shot()).toBe("1");
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    await userEvent.keyboard("{ArrowRight}");
    expect(shot()).toBe("end");
    (document.activeElement as HTMLElement).blur();
    await userEvent.keyboard("{Enter}");
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("keeps focus inside and gives it back on close", async () => {
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
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByRole("button", { name: "Start" })).toHaveFocus();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("puts the extra opening question on the closing card only", async () => {
    renderFilm({ opening: <p>Pick a lantern</p> });
    expect(screen.queryByText("Pick a lantern")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByText("Pick a lantern")).toBeInTheDocument();
  });

  it("moves the camera, unless the player asked for less motion", () => {
    const { unmount } = render(
      <PhaseCutscene
        def={growUniverse}
        phaseIndex={1}
        Scene={GrowScene}
        onContinue={jest.fn()}
      />
    );
    const camera = growUniverse.phases[1].cutscene?.[0].camera ?? "drift";
    expect(screen.getByTestId("lm-cutscene-pan")).toHaveAttribute(
      "data-camera",
      camera
    );
    expect(screen.getByTestId("lm-cutscene-pan").className).toMatch(/eo-cam-/);
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
      "data-camera",
      "still"
    );
    expect(screen.getByTestId("lm-cutscene-pan").className).not.toMatch(
      /eo-cam-/
    );
    // With less motion the whole line shows at once.
    expect(screen.getByTestId("eo-film-caption").textContent).toContain(
      growUniverse.phases[1].cutscene?.[0].text
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
    await userEvent.click(
      screen.getByRole("button", { name: "Watch again · Part 2" })
    );
    expect(
      screen.getByRole("dialog", { name: "No More Night" })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByTestId("lm-phase-overlay")).toBeNull();
    expect(screen.getByTestId("lm-story-drawer")).toBeInTheDocument();
  });

  it("keeps arrow keys for a radiogroup inside the closing card", async () => {
    renderFilm({
      opening: (
        <div role="radiogroup" aria-label="Pick">
          <button type="button" role="radio" aria-checked="true">
            One
          </button>
        </div>
      ),
    });
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    await userEvent.click(screen.getByRole("radio", { name: "One" }));
    await userEvent.keyboard("{ArrowLeft}");
    expect(shot()).toBe("end");
  });

  it("closes on Escape only when it is a replay (Done)", async () => {
    const { onContinue: start } = renderFilm();
    await userEvent.keyboard("{Escape}");
    expect(start).not.toHaveBeenCalled();
    document.body.innerHTML = "";
    const { onContinue: replay } = renderFilm({ finishLabel: "Done" });
    await userEvent.keyboard("{Escape}");
    expect(replay).toHaveBeenCalledTimes(1);
  });

  it("gives the film's picture its own test id", () => {
    render(
      <div>
        <LightScene run={newRun(lightUniverse)} />
        <PhaseCutscene
          def={lightUniverse}
          phaseIndex={1}
          Scene={LightScene}
          onContinue={jest.fn()}
        />
      </div>
    );
    expect(screen.getAllByTestId("lm-scene")).toHaveLength(1);
    expect(screen.getByTestId("lm-cutscene-scene")).toBeInTheDocument();
  });

  it("names each Watch again button after its part", async () => {
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
      screen.getByRole("button", { name: /^Intro · Part 1/ })
    );
    expect(
      screen.getByRole("button", { name: "Watch again · Part 1" })
    ).toBeInTheDocument();
  });
});
